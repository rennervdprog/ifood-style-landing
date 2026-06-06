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
      .select("store_id, auto_reply_enabled, auto_reply_message, evolution_api_url, evolution_instance_name, status")
      .eq("evolution_instance_name", instance)
      .maybeSingle();
    if (!cfg) return json({ ok: true });

    // CONNECTION_UPDATE
    if (/connection/i.test(event)) {
      const state: string = data?.state || data?.status || "";
      const statusReason: number = Number(data?.statusReason || data?.reason || 0);
      const phone: string | undefined = data?.wuid?.split("@")?.[0] || data?.number || data?.owner;
      // Evolution/Baileys emits transient "close"/"connecting" events even
      // right after a successful pairing (socket reconnect). Only flip the
      // status to "disconnected" when the device was actually logged out
      // (statusReason 401) — otherwise we'd kick a healthy connection.
      let newStatus: string | null = null;
      if (state === "open" || state === "connected") newStatus = "connected";
      else if ((state === "close" || state === "disconnected") && statusReason === 401) newStatus = "disconnected";
      else if (cfg.status !== "connected") newStatus = "connecting";
      if (newStatus) {
        await admin.from("store_whatsapp_config").update({
          status: newStatus,
          phone_number: phone ?? undefined,
          qr_code: newStatus === "connected" ? null : undefined,
          updated_at: new Date().toISOString(),
        }).eq("store_id", cfg.store_id);
      }
    }

    // MESSAGES_UPSERT (auto-reply)
    if (/messages.?upsert/i.test(event) && cfg.auto_reply_enabled) {
      const fromMe = data?.key?.fromMe;
      const remoteJid: string = data?.key?.remoteJid || "";
      const number = remoteJid.split("@")[0];
      if (!fromMe && number && /^\d+$/.test(number) && !remoteJid.includes("@g.us")) {
        const baseUrl = cfg.evolution_api_url || Deno.env.get("EVOLUTION_API_URL");
        const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
        // Append store link to the auto-reply
        const { data: store } = await admin
          .from("stores").select("slug").eq("id", cfg.store_id).maybeSingle();
        const link = store?.slug ? `https://itasuper.com.br/${store.slug}` : "";
        const baseMsg = (cfg.auto_reply_message || "Olá! 😊 Acesse nosso cardápio e faça seu pedido:").trim();
        const text = link && !baseMsg.includes(link) ? `${baseMsg}\n${link}` : baseMsg;
        if (baseUrl && apiKey) {
          await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${cfg.evolution_instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ number, text }),
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