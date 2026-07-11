// Envia mensagem via WhatsApp da PLATAFORMA (instância dedicada 'itasuper-platform').
// Usa mesmo Evolution server (EVOLUTION_API_URL/EVOLUTION_GLOBAL_API_KEY) mas
// lê config em platform_whatsapp_config. Dedupe por (phone, kind, store_id, dia).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const EXT_KEY =
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
      Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!baseUrl || !apiKey) return json({ error: "Evolution não configurado" }, 500);

    const body = await req.json().catch(() => ({}));
    const phone: string = String(body?.phone || "").replace(/\D/g, "");
    const message: string = String(body?.message || "");
    const kind: string = String(body?.kind || "generic");
    const store_id: string | null = body?.store_id || null;
    const force: boolean = body?.force === true;
    if (!phone || !message) return json({ error: "phone e message obrigatórios" }, 400);

    const sb = createClient(EXT_URL, EXT_KEY);
    const { data: cfg } = await sb
      .from("platform_whatsapp_config")
      .select("instance_name, status, avisos_ativos")
      .limit(1)
      .maybeSingle();
    if (!cfg) return json({ error: "platform_whatsapp_config vazio" }, 500);
    if (!force && cfg.avisos_ativos === false) return json({ skipped: "avisos_desativados" });
    if (cfg.status !== "connected") return json({ error: "WhatsApp plataforma desconectado", status: cfg.status }, 409);

    let number = phone;
    if (number.length <= 11) number = "55" + number;

    // Dedupe por (phone, kind, store_id, dia BRT) via unique index
    const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: existing } = await sb
      .from("platform_whatsapp_log")
      .select("id")
      .eq("phone", number).eq("kind", kind).eq("sent_day", today)
      .filter("store_id", store_id ? "eq" : "is", store_id ?? null)
      .limit(1).maybeSingle();
    if (existing && !force) return json({ success: true, skipped: "dedupe_daily" });

    const r = await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${cfg.instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number, text: message }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      await sb.from("platform_whatsapp_log").insert({
        phone: number, kind, store_id, message, status: "error", error: JSON.stringify(data).slice(0, 500),
      }).then(() => {}, () => {});
      return json({ error: "Falha Evolution", details: data }, 502);
    }
    await sb.from("platform_whatsapp_log").insert({
      phone: number, kind, store_id, message, status: "sent",
    }).then(() => {}, () => {});
    return json({ success: true, data });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});