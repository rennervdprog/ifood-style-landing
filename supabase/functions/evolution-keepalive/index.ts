import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const parseJson = async (r: Response) => {
  const text = await r.text().catch(() => "");
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 1000) }; }
};

const webhookUrlOf = (body: any): string => String(body?.url || body?.webhook?.url || "");
const webhookEnabledOf = (body: any): boolean => Boolean(body?.enabled ?? body?.webhook?.enabled);

const fetchJson = async (url: string, init: RequestInit = {}) => {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  return { ok: r.ok, status: r.status, data: await parseJson(r) };
};

const setWebhook = async (root: string, instance: string, apiKey: string, webhookUrl: string) => {
  const modernPayload = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: false,
      events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
    },
  };
  const modern = await fetchJson(`${root}/webhook/set/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(modernPayload),
  });

  let verified = await fetchJson(`${root}/webhook/find/${instance}`, { headers: { apikey: apiKey } }).catch(() => null);
  if (modern.ok && verified?.ok && webhookEnabledOf(verified.data) && webhookUrlOf(verified.data) === webhookUrl) {
    return { action: "repaired", ok: true, status: modern.status, verified: true };
  }

  const legacyPayload = {
    enabled: true,
    url: webhookUrl,
    webhook_by_events: false,
    webhook_base64: false,
    events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
  };
  const legacy = await fetchJson(`${root}/webhook/set/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(legacyPayload),
  });
  verified = await fetchJson(`${root}/webhook/find/${instance}`, { headers: { apikey: apiKey } }).catch(() => null);
  const ok = legacy.ok && verified?.ok && webhookEnabledOf(verified.data) && webhookUrlOf(verified.data) === webhookUrl;
  return { action: "repaired", ok, status: legacy.status, verified: ok, currentUrl: webhookUrlOf(verified?.data) || null };
};

const ensureWebhook = async (root: string, instance: string, apiKey: string, webhookUrl: string) => {
  const found = await fetchJson(`${root}/webhook/find/${instance}`, { headers: { apikey: apiKey } }).catch((e) => ({ ok: false, status: 0, data: { error: String(e) } }));
  const currentUrl = webhookUrlOf(found.data);
  const valid = found.ok && webhookEnabledOf(found.data) && currentUrl === webhookUrl;
  if (valid) return { action: "ok", ok: true, status: found.status, currentUrl };
  const repaired = await setWebhook(root, instance, apiKey, webhookUrl);
  console.warn("[evolution-keepalive] webhook auto-repair", { instance, previousUrl: currentUrl || null, ok: repaired.ok });
  return { ...repaired, previousUrl: currentUrl || null };
};

/**
 * Mantém sessões Evolution vivas. Para cada loja com status "connected",
 * consulta o estado real e, se cair, dispara /instance/connect (que reusa o
 * auth salvo do Baileys — não pede QR de novo, a menos que a sessão tenha
 * sido invalidada do lado do WhatsApp).
 * Atualiza store_whatsapp_config.status para refletir o estado real.
 * Pode ser chamado de cron externo ou pelo próprio app a cada poucos min.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    const webhookToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    const functionBaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
    if (!baseUrl || !apiKey || !webhookToken || !functionBaseUrl) return json({ error: "Evolution/backend não configurado" }, 500);

    const admin = createClient(
      (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!,
      (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!,
    );

    const url = new URL(req.url);
    const onlyStoreId = url.searchParams.get("store_id");

    let q = admin
      .from("store_whatsapp_config")
      .select("store_id, evolution_instance_name, status")
      .not("evolution_instance_name", "is", null);
    if (onlyStoreId) q = q.eq("store_id", onlyStoreId);
    const { data: configs } = await q;

    const root = baseUrl.replace(/\/$/, "");
    const webhookUrl = `${functionBaseUrl.replace(/\/$/, "")}/functions/v1/evolution-webhook?token=${webhookToken}`;
    const results: any[] = [];
    const seen = new Set<string>();

    for (const cfg of (configs ?? [])) {
      const inst = (cfg as any).evolution_instance_name as string;
      if (!inst) continue;
      seen.add(inst);
      try {
        const r = await fetch(`${root}/instance/connectionState/${inst}`, { headers: { apikey: apiKey } });
        const j: any = await r.json().catch(() => ({}));
        const state: string = j?.instance?.state || j?.state || "";
        const isOpen = state === "open";
        const webhook = await ensureWebhook(root, inst, apiKey, webhookUrl);

        if (!isOpen) {
          // tenta reconectar usando auth salvo — não exige QR novo se a sessão ainda existir
          await fetch(`${root}/instance/connect/${inst}`, { headers: { apikey: apiKey } }).catch(() => {});
          await ensureWebhook(root, inst, apiKey, webhookUrl).catch(() => undefined);
        }

        const newStatus = isOpen ? "connected" : (state === "connecting" ? "connecting" : "disconnected");
        // Quando aberto, também confere o ownerJid real — se o chip trocou
        // (ou o webhook não disparou), corrige phone_number e connected_at.
        let realPhone: string | undefined;
        if (isOpen) {
          try {
            const fr = await fetch(`${root}/instance/fetchInstances?instanceName=${inst}`, { headers: { apikey: apiKey } });
            const arr: any = await fr.json().catch(() => []);
            const info = Array.isArray(arr) ? arr[0] : arr;
            const owner = info?.ownerJid || info?.owner;
            if (typeof owner === "string") realPhone = owner.split("@")[0].replace(/\D/g, "");
          } catch { /* ignore */ }
        }
        const { data: cur } = await admin
          .from("store_whatsapp_config")
          .select("phone_number, status, connected_at")
          .eq("store_id", (cfg as any).store_id)
          .maybeSingle();
        const norm = (v?: string | null) => String(v || "").replace(/\D/g, "");
        const phoneChanged = !!realPhone && norm(realPhone) !== norm(cur?.phone_number);
        const patch: any = {};
        if (newStatus !== (cfg as any).status) patch.status = newStatus;
        if (realPhone && phoneChanged) patch.phone_number = realPhone;
        if (isOpen && (cur?.status !== "connected" || phoneChanged || !cur?.connected_at)) {
          patch.connected_at = new Date().toISOString();
        }
        if (Object.keys(patch).length > 0) {
          patch.updated_at = new Date().toISOString();
          await admin.from("store_whatsapp_config").update(patch).eq("store_id", (cfg as any).store_id);
        }
        results.push({ kind: "store", store_id: (cfg as any).store_id, instance: inst, state, action: isOpen ? "noop" : "reconnect", phoneChanged, webhook });
      } catch (e) {
        results.push({ kind: "store", store_id: (cfg as any).store_id, instance: inst, error: String(e) });
      }
    }

    const { data: platformConfigs } = await admin
      .from("platform_whatsapp_config")
      .select("id, instance_name, status")
      .not("instance_name", "is", null);
    for (const cfg of (platformConfigs ?? [])) {
      const inst = String((cfg as any).instance_name || "");
      if (!inst) continue;
      seen.add(inst);
      try {
        const stateRes = await fetchJson(`${root}/instance/connectionState/${inst}`, { headers: { apikey: apiKey } });
        const state = stateRes.data?.instance?.state || stateRes.data?.state || "";
        const isOpen = state === "open";
        const webhook = await ensureWebhook(root, inst, apiKey, webhookUrl);
        if (!isOpen) {
          await fetch(`${root}/instance/connect/${inst}`, { headers: { apikey: apiKey } }).catch(() => {});
          await ensureWebhook(root, inst, apiKey, webhookUrl).catch(() => undefined);
        }
        const newStatus = isOpen ? "connected" : (state === "connecting" ? "connecting" : "disconnected");
        if (newStatus !== (cfg as any).status) {
          await admin.from("platform_whatsapp_config").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", (cfg as any).id);
        }
        results.push({ kind: "platform", id: (cfg as any).id, instance: inst, state, action: isOpen ? "noop" : "reconnect", webhook });
      } catch (e) {
        results.push({ kind: "platform", id: (cfg as any).id, instance: inst, error: String(e) });
      }
    }

    try {
      const instances = await fetchJson(`${root}/instance/fetchInstances`, { headers: { apikey: apiKey } });
      const list = Array.isArray(instances.data) ? instances.data : [];
      for (const item of list) {
        const inst = String(item?.name || item?.instance?.instanceName || item?.instanceName || "");
        if (!inst || seen.has(inst)) continue;
        if (!inst.startsWith("store-") && inst !== "itasuper-platform") continue;
        const webhook = await ensureWebhook(root, inst, apiKey, webhookUrl);
        results.push({ kind: "orphan-instance", instance: inst, state: item?.connectionStatus || item?.instance?.state || null, action: "webhook-check", webhook });
      }
    } catch (e) {
      results.push({ kind: "instance-audit", error: String(e) });
    }

    return json({ success: true, count: results.length, results });
  } catch (e) {
    console.error("evolution-keepalive error:", e);
    return json({ error: "Internal error", message: e.message, stack: e.stack }, 500);
  }
});