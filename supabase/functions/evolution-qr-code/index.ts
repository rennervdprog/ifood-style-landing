import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";
import QRCode from "npm:qrcode@1.5.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BodySchema = z
  .object({
    store_id: z.string().uuid().optional(),
    is_platform: z.boolean().optional(),
    instance_name: z.string().min(3).optional(),
    force_reconnect: z.boolean().optional(),
    pairing_number: z.string().min(10).max(20).optional(),
    action: z.enum(["logout"]).optional(),
  })
  .refine((v) => v.is_platform === true || !!v.store_id, {
    message: "store_id required when is_platform is not true",
    path: ["store_id"],
  });

const parseJson = async (response: Response) => {
  const text = await response.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 1_000) };
  }
};

const evolutionFetch = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });

const compact = (value: unknown) => JSON.stringify(value).slice(0, 1_500);

const fail = (step: string, status: number, details?: unknown) => {
  console.error(`[evolution-qr-code] ${step}`, { status, details });
  return json({ error: step, status, details }, status >= 400 && status < 600 ? status : 502);
};

const getQrPayload = (data: any): string | null =>
  data?.base64 || data?.qrCode || data?.qr_code || data?.qrcode?.base64 || data?.qrcode?.base64Image || null;

const getRawQrCode = (data: any): string | null =>
  data?.qrcode?.code || (typeof data?.code === "string" && data.code.length > 20 ? data.code : null) || null;

const getPairingCode = (data: any): string | null => {
  const code = data?.pairingCode || data?.pairing_code || data?.pairing?.code || data?.qrcode?.pairingCode || data?.qrcode?.pairing_code || data?.code;
  if (typeof code !== "string") return null;
  const trimmed = code.replace(/[^A-Za-z0-9]/g, "").trim();
  return trimmed.length >= 4 && trimmed.length <= 12 ? trimmed : null;
};

const responseFromFetch = async (r: Response) => ({ ok: r.ok, status: r.status, data: await parseJson(r) });

const getBearerToken = (req: Request): string | null => {
  const authHeader = req.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || "";
  if (!token || token === "undefined" || token === "null") return null;
  return token;
};

const authenticateUser = async (jwt: string) => {
  const supabase = createClient(
    Deno.env.get("EXTERNAL_SUPABASE_URL")!,
    Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );

  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(jwt);
  if (claimsData?.claims?.sub) {
    return { user: { id: String(claimsData.claims.sub), email: claimsData.claims.email as string | undefined }, error: null };
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userData?.user) return { user: userData.user, error: null };

  return { user: null, error: claimsErr?.message || userErr?.message || "no_user" };
};

const instanceExists = async (root: string, instance: string, apiKey: string) => {
  const r = await evolutionFetch(`${root}/instance/connectionState/${instance}`, { headers: { apikey: apiKey } });
  const data = await parseJson(r);
  if (r.status === 404) return { exists: false, status: r.status, data };
  return { exists: r.ok, status: r.status, data };
};

const setWebhook = async (baseUrl: string, instance: string, apiKey: string, webhookUrl: string) => {
  const payload = {
    enabled: true,
    url: webhookUrl,
    webhook_by_events: false,
    webhook_base64: false,
    events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
  };
  const r = await evolutionFetch(`${baseUrl.replace(/\/$/, "")}/webhook/set/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(r);
  if (!r.ok) console.error("[evolution-qr-code] webhook set failed", { instance, status: r.status, data });
  return { ok: r.ok, status: r.status, data };
};

const createInstance = async (root: string, instance: string, apiKey: string, webhookUrl: string, withQr: boolean) => {
  const payload = {
    instanceName: instance,
    token: apiKey,
    qrcode: withQr,
    integration: "WHATSAPP-BAILEYS",
    webhookUrl,
    webhookByEvents: false,
    webhookBase64: false,
    webhookEvents: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
    rejectCall: true,
    msgCall: "Olá! No momento não consigo atender chamadas. Por favor envie uma mensagem 😊",
    groupsIgnore: true,
    alwaysOnline: false,
    readMessages: false,
    readStatus: false,
    syncFullHistory: false,
  };
  const r = await evolutionFetch(`${root}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(r);
  return { ok: r.ok, status: r.status, data };
};

const applySettings = async (root: string, instance: string, apiKey: string) =>
  evolutionFetch(`${root}/settings/set/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({
      rejectCall: true,
      msgCall: "Olá! No momento não consigo atender chamadas. Por favor envie uma mensagem 😊",
      groupsIgnore: true,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    }),
  }).catch((e) => console.warn("[evolution-qr-code] settings ignored", String(e)));

const connectInstance = async (root: string, instance: string, apiKey: string, pairingNumber: string | null) => {
  const headers = { apikey: apiKey };
  const primary = pairingNumber
    ? `${root}/instance/connect/${instance}?number=${pairingNumber}`
    : `${root}/instance/connect/${instance}`;
  const first = await evolutionFetch(primary, { headers }).then(responseFromFetch);
  if (!pairingNumber || (first.ok && getPairingCode(first.data))) return first;

  // Algumas builds/forks da Evolution v2 expõem uma rota dedicada para pairing code.
  const fallback = await evolutionFetch(`${root}/instance/connect/pairingCode/${instance}?number=${pairingNumber}`, { headers })
    .then(responseFromFetch)
    .catch(() => first);
  return fallback.ok || getPairingCode(fallback.data) ? fallback : first;
};

const deleteInstance = async (root: string, instance: string, apiKey: string) => {
  const headers = { apikey: apiKey };
  await evolutionFetch(`${root}/instance/logout/${instance}`, { method: "DELETE", headers }).catch(() => undefined);
  await evolutionFetch(`${root}/instance/delete/${instance}`, { method: "DELETE", headers }).catch(() => undefined);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const jwt = getBearerToken(req);
    if (!jwt || jwt === Deno.env.get("SUPABASE_ANON_KEY")) {
      return json({ error: "Unauthorized", reason: "Auth session missing!" }, 401);
    }

    const auth = await authenticateUser(jwt);
    if (!auth.user) {
      console.error("[evolution-qr-code] auth failed", { err: auth.error });
      return json({ error: "Unauthorized", reason: auth.error }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const isPlatform = "is_platform" in parsed.data && parsed.data.is_platform === true;
    const store_id = isPlatform ? null : (parsed.data as any).store_id as string;
    const force_reconnect = (parsed.data as any).force_reconnect ?? false;
    const pairingNumberRaw = (parsed.data as any).pairing_number as string | undefined;
    const pairingNumber = pairingNumberRaw ? pairingNumberRaw.replace(/\D/g, "") : null;

    const externalAdmin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL")!,
      (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY"))!,
    );

    if (isPlatform) {
      // apenas super_admin/admin podem gerar QR da instância da plataforma
      const { data: roleRows } = await externalAdmin
        .from("user_roles").select("role").eq("user_id", auth.user.id);
      const roles = (roleRows || []).map((r: any) => r.role);
      const privileged = roles.some((r) => ["admin", "super_admin"].includes(r));
      if (!privileged) return json({ error: "Forbidden — apenas admin" }, 403);
    } else {
      const { data: store } = await externalAdmin
        .from("stores").select("id, owner_id").eq("id", store_id!).maybeSingle();
      if (!store) return json({ error: "Store not found" }, 404);
      if (store.owner_id !== auth.user.id) {
        const { data: roleRows } = await externalAdmin
          .from("user_roles").select("role").eq("user_id", auth.user.id);
        const roles = (roleRows || []).map((r: any) => r.role);
        const privileged = roles.some((r) => ["admin", "super_admin", "moderator"].includes(r));
        if (!privileged) return json({ error: "Forbidden" }, 403);
      }
    }

    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    const webhookToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    // Webhook deve chamar o host atual das funções; o backend externo é usado
    // apenas como banco de dados de produção.
    const functionBaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    if (!baseUrl || !apiKey) return json({ error: "Servidor Evolution não configurado" }, 500);

    const instance = isPlatform
      ? ((parsed.data as any).instance_name || "itasuper-platform")
      : `store-${store_id!.slice(0, 8)}`;
    const webhookUrl = `${functionBaseUrl}/functions/v1/evolution-webhook?token=${webhookToken}`;

    const root = baseUrl.replace(/\/$/, "");

    const action = (parsed.data as any).action as string | undefined;
    if (action === "logout") {
      await evolutionFetch(`${root}/instance/logout/${instance}`, {
        method: "DELETE",
        headers: { apikey: apiKey },
      }).catch(() => undefined);
      const table = isPlatform ? "platform_whatsapp_config" : "store_whatsapp_config";
      const patch: any = { status: "disconnected", updated_at: new Date().toISOString() };
      if (isPlatform) {
        await externalAdmin.from(table).update(patch).eq("instance_name", instance);
      } else {
        await externalAdmin.from(table).update(patch).eq("store_id", store_id!);
      }
      return json({ success: true, status: "disconnected", instance });
    }

    if (force_reconnect) {
      await deleteInstance(root, instance, apiKey);
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }

    const exists = force_reconnect ? { exists: false } : await instanceExists(root, instance, apiKey).catch((e) => ({ exists: false, data: { error: String(e) } }));
    let createResult: { ok: boolean; status: number; data: any } | null = null;
    if (!exists.exists) {
      createResult = await createInstance(root, instance, apiKey, webhookUrl, !pairingNumber);
      const alreadyExists = !createResult.ok && /exist|already|duplicate|já existe/i.test(compact(createResult.data));
      if (!createResult.ok && !alreadyExists) {
        return fail("Falha ao criar instância Evolution", 502, { evolution_status: createResult.status, response: createResult.data });
      }
    }

    await setWebhook(baseUrl, instance, apiKey, webhookUrl);
    await applySettings(root, instance, apiKey);

    let data: any = createResult?.ok && !pairingNumber && (getQrPayload(createResult.data) || getRawQrCode(createResult.data))
      ? createResult.data
      : null;
    let connectResult: { ok: boolean; status: number; data: any } | null = null;
    if (!data) {
      connectResult = await connectInstance(root, instance, apiKey, pairingNumber);
      data = connectResult.data;
    }

    const hasUsefulPayload = pairingNumber ? !!getPairingCode(data) : !!(getQrPayload(data) || getRawQrCode(data));
    if ((!connectResult?.ok && connectResult) || !hasUsefulPayload) {
      await deleteInstance(root, instance, apiKey);
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      createResult = await createInstance(root, instance, apiKey, webhookUrl, !pairingNumber);
      if (!createResult.ok) {
        return fail("Falha ao recriar instância Evolution", 502, { evolution_status: createResult.status, response: createResult.data });
      }
      await setWebhook(baseUrl, instance, apiKey, webhookUrl);
      await applySettings(root, instance, apiKey);
      data = !pairingNumber && (getQrPayload(createResult.data) || getRawQrCode(createResult.data)) ? createResult.data : null;
      if (!data) {
        connectResult = await connectInstance(root, instance, apiKey, pairingNumber);
        data = connectResult.data;
      }
    }

    if (connectResult && !connectResult.ok) {
      return fail(pairingNumber ? "Falha ao gerar código por número" : "Falha ao gerar QR", 502, {
        evolution_status: connectResult.status,
        response: connectResult.data,
      });
    }

    // Pairing code path — retorna código de 8 chars, não QR
    const pairingCode: string | null = getPairingCode(data);
    if (pairingNumber && pairingCode) {
      if (isPlatform) {
        await externalAdmin.from("platform_whatsapp_config").update({
          status: "connecting", updated_at: new Date().toISOString(),
        }).eq("instance_name", instance);
      } else {
        await externalAdmin.from("store_whatsapp_config").upsert({
          store_id, evolution_api_url: baseUrl, evolution_instance_name: instance,
          status: "connecting", updated_at: new Date().toISOString(),
        }, { onConflict: "store_id" });
      }
      return json({ success: true, pairing_code: pairingCode, instance });
    }

    // IMPORTANT: only render an actual image. Evolution may return `code` as raw QR text;
    // convert it locally instead of depending on an external QR service.
    let qr: string | null = getQrPayload(data);
    const rawCode: string | null = getRawQrCode(data);
    if (!qr && rawCode) {
      try {
        qr = await QRCode.toDataURL(rawCode, { width: 512, margin: 2, errorCorrectionLevel: "M" });
      } catch (e) {
        console.error("[evolution-qr-code] local qr render failed", { instance, error: String(e) });
      }
    }
    if (!qr) {
      console.error("[evolution-qr-code] no qr returned", { instance, keys: Object.keys(data || {}) });
      return json({ error: "Evolution não retornou QR Code", details: { keys: Object.keys(data || {}), response: data } }, 502);
    }

    // 3) persiste
    if (isPlatform) {
      await externalAdmin.from("platform_whatsapp_config").update({
        status: "connecting",
        updated_at: new Date().toISOString(),
      }).eq("instance_name", instance);
    } else {
      await externalAdmin.from("store_whatsapp_config").upsert({
        store_id,
        evolution_api_url: baseUrl,
        evolution_instance_name: instance,
        qr_code: qr,
        status: "connecting",
        updated_at: new Date().toISOString(),
      }, { onConflict: "store_id" });
    }

    return json({ success: true, qr_code: qr, qr_base64: qr, raw_qr_code: rawCode, instance });
  } catch (e) {
    console.error("evolution-qr-code error:", e);
    return json({ error: "Falha interna ao conectar Evolution", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});