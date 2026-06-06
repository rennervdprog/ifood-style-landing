import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const expected = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN");
    if (expected && url.searchParams.get("token") !== expected) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const event: string = body?.event || body?.type || "";
    const instance: string = body?.instance || body?.instanceName || body?.sender || "";
    const data: any = body?.data || body;

    if (!instance) return json({ ok: true });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await admin
      .from("store_whatsapp_config")
      .select("store_id, auto_reply_enabled, auto_reply_message, evolution_api_url, evolution_instance_name")
      .eq("evolution_instance_name", instance)
      .maybeSingle();
    if (!cfg) return json({ ok: true });

    // CONNECTION_UPDATE
    if (/connection/i.test(event)) {
      const state: string = data?.state || data?.status || "";
      const phone: string | undefined = data?.wuid?.split("@")?.[0] || data?.number || data?.owner;
      const status = state === "open" || state === "connected"
        ? "connected"
        : state === "close" || state === "disconnected"
        ? "disconnected"
        : "connecting";
      await admin.from("store_whatsapp_config").update({
        status,
        phone_number: phone ?? undefined,
        qr_code: status === "connected" ? null : undefined,
        updated_at: new Date().toISOString(),
      }).eq("store_id", cfg.store_id);
    }

    // MESSAGES_UPSERT (auto-reply)
    if (/messages.?upsert/i.test(event) && cfg.auto_reply_enabled) {
      const fromMe = data?.key?.fromMe;
      const remoteJid: string = data?.key?.remoteJid || "";
      const number = remoteJid.split("@")[0];
      if (!fromMe && number && /^\d+$/.test(number) && !remoteJid.includes("@g.us")) {
        const baseUrl = cfg.evolution_api_url || Deno.env.get("EVOLUTION_API_URL");
        const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
        if (baseUrl && apiKey) {
          await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${cfg.evolution_instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ number, text: cfg.auto_reply_message || "Olá! 😊" }),
          }).catch(() => {});
        }
      }
    }

    return json({ ok: true });
  } catch (e) {
    console.error("evolution-webhook error:", e);
    return json({ ok: false }, 200);
  }
});