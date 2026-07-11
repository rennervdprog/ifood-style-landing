import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";

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
  })
  .refine((v) => v.is_platform === true || !!v.store_id, {
    message: "store_id required when is_platform is not true",
    path: ["store_id"],
  });

const setWebhook = async (baseUrl: string, instance: string, apiKey: string, webhookUrl: string) => {
  const payload = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
    },
  };
  const r = await fetch(`${baseUrl.replace(/\/$/, "")}/webhook/set/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) console.error("[evolution-qr-code] webhook set failed", { instance, status: r.status, data });
  return { ok: r.ok, status: r.status, data };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const isPlatform = "is_platform" in parsed.data && parsed.data.is_platform === true;
    const store_id = isPlatform ? null : (parsed.data as any).store_id as string;
    const force_reconnect = (parsed.data as any).force_reconnect ?? false;

    const externalAdmin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (isPlatform) {
      // apenas super_admin/admin podem gerar QR da instância da plataforma
      const { data: roleRows } = await externalAdmin
        .from("user_roles").select("role").eq("user_id", userData.user.id);
      const roles = (roleRows || []).map((r: any) => r.role);
      const privileged = roles.some((r) => ["admin", "super_admin"].includes(r));
      if (!privileged) return json({ error: "Forbidden — apenas admin" }, 403);
    } else {
      const { data: store } = await externalAdmin
        .from("stores").select("id, owner_id").eq("id", store_id!).maybeSingle();
      if (!store) return json({ error: "Store not found" }, 404);
      if (store.owner_id !== userData.user.id) {
        const { data: roleRows } = await externalAdmin
          .from("user_roles").select("role").eq("user_id", userData.user.id);
        const roles = (roleRows || []).map((r: any) => r.role);
        const privileged = roles.some((r) => ["admin", "super_admin", "moderator"].includes(r));
        if (!privileged) return json({ error: "Forbidden" }, 403);
      }
    }

    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    const webhookToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    // Webhook must point to the current Cloud functions host; EXTERNAL_SUPABASE_URL
    // is used only for the production data backend.
    const functionBaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    if (!baseUrl || !apiKey) return json({ error: "Servidor Evolution não configurado" }, 500);

    const instance = isPlatform
      ? ((parsed.data as any).instance_name || "itasuper-platform")
      : `store-${store_id!.slice(0, 8)}`;
    const webhookUrl = `${functionBaseUrl}/functions/v1/evolution-webhook?token=${webhookToken}`;

    if (force_reconnect) {
      await fetch(`${baseUrl.replace(/\/$/, "")}/instance/logout/${instance}`, {
        method: "DELETE",
        headers: { apikey: apiKey },
      }).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    // 1) cria instância (ignora erro se já existir)
    await fetch(`${baseUrl.replace(/\/$/, "")}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        instanceName: instance,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
        },
      }),
    }).catch(() => {});

    // 1.0) regrava explicitamente o webhook; em instâncias já existentes,
    // o /instance/create não atualiza o webhook e as mensagens não chegam.
    await setWebhook(baseUrl, instance, apiKey, webhookUrl);

    // 1.1) aplica settings anti-ban recomendados (best-effort)
    await fetch(`${baseUrl.replace(/\/$/, "")}/settings/set/${instance}`, {
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
    }).catch(() => {});

    // 2) conecta e pega QR — com retry automático via logout se falhar
    const root = baseUrl.replace(/\/$/, "");
    const doConnect = async () => {
      const r = await fetch(`${root}/instance/connect/${instance}`, { headers: { apikey: apiKey } });
      const data = await r.json().catch(() => ({}));
      return { r, data };
    };
    let { r, data } = await doConnect();
    let qrPeek: string | null = (data?.base64 || data?.qrcode?.base64 || data?.code || data?.qrcode?.code) ?? null;
    if (!r.ok || !qrPeek) {
      // instância provavelmente presa em "connecting" antigo — força logout + delete e recria
      await fetch(`${root}/instance/logout/${instance}`, { method: "DELETE", headers: { apikey: apiKey } }).catch(() => {});
      await fetch(`${root}/instance/delete/${instance}`, { method: "DELETE", headers: { apikey: apiKey } }).catch(() => {});
      await new Promise((res) => setTimeout(res, 1500));
      await fetch(`${root}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          instanceName: instance,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: {
            enabled: true, url: webhookUrl, webhook_by_events: false, webhook_base64: false,
            events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
          },
        }),
      }).catch(() => {});
      await setWebhook(baseUrl, instance, apiKey, webhookUrl);
      ({ r, data } = await doConnect());
    }
    if (!r.ok) return json({ error: "Falha ao gerar QR", details: data }, 502);

    // IMPORTANT: only use the base64 IMAGE; `code` is the raw QR text (not an image)
    // and rendering it as <img src="data:image/png;base64,<code>"> produces an invalid
    // QR that WhatsApp reads but fails to pair.
    let qr: string | null = data?.base64 || data?.qrcode?.base64 || null;
    const rawCode: string | null = data?.code || data?.qrcode?.code || null;
    if (!qr && rawCode) {
      // Render the raw QR text into a PNG via an external QR service as fallback
      try {
        const qrRes = await fetch(
          `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(rawCode)}`,
        );
        if (qrRes.ok) {
          const buf = new Uint8Array(await qrRes.arrayBuffer());
          let bin = "";
          for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
          qr = `data:image/png;base64,${btoa(bin)}`;
        }
      } catch (_) {}
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

    return json({ success: true, qr_code: qr, qr_base64: qr, instance });
  } catch (e) {
    console.error("evolution-qr-code error:", e);
    return json({ error: "Internal error" }, 500);
  }
});