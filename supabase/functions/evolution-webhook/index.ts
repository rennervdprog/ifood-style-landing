import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runInBackground = (task: Promise<unknown>) => {
  const runtime = globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil?: (task: Promise<unknown>) => void } };
  if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(task);
  else task.catch((error) => console.error("background auto-reply error:", error));
};

const isRecentIncomingMessage = (data: any) => {
  const rawTimestamp = data?.messageTimestamp || data?.timestamp || data?.date_time;
  if (!rawTimestamp) return true;
  const ts = typeof rawTimestamp === "number" ? rawTimestamp : Number(rawTimestamp);
  if (!Number.isFinite(ts)) return true;
  const tsMs = ts > 10_000_000_000 ? ts : ts * 1000;
  return Date.now() - tsMs <= 5 * 60_000;
};

const hasHumanContent = (data: any) => {
  const msg = data?.message || data?.messages?.[0]?.message;
  if (!msg) return true;
  if (msg.protocolMessage || msg.reactionMessage || msg.senderKeyDistributionMessage) return false;
  return Boolean(
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.audioMessage ||
    msg.documentMessage ||
    msg.stickerMessage
  );
};

const incomingText = (data: any) => {
  const msg = data?.message || data?.messages?.[0]?.message || {};
  return String(msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || "");
};

const asksForMenu = (text: string) => {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return /(^|\s)(1|cardapio|catalogo|menu|pedido|pedir|comprar|link)(\s|$)/i.test(normalized);
};

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
        const patch: any = {
          status: newStatus,
          phone_number: phone ?? undefined,
          qr_code: newStatus === "connected" ? null : undefined,
          updated_at: new Date().toISOString(),
        };
        if (newStatus === "connected" && cfg.status !== "connected") {
          patch.connected_at = new Date().toISOString();
        }
        await admin.from("store_whatsapp_config").update(patch).eq("store_id", cfg.store_id);
      }
    }

    // MESSAGES_UPSERT (auto-reply)
    if (/messages.?upsert/i.test(event) && cfg.auto_reply_enabled) {
      const fromMe = data?.key?.fromMe;
      const remoteJid: string = data?.key?.remoteJid || "";
      const number = remoteJid.split("@")[0];
      if (!fromMe && number && /^\d+$/.test(number) && !remoteJid.includes("@g.us") && !remoteJid.includes("status@broadcast")) {
        if (!isRecentIncomingMessage(data)) return json({ ok: true, skipped: "old_message" });
        if (!hasHumanContent(data)) return json({ ok: true, skipped: "non_human_message" });

        // Cooldown: 1 auto-reply por contato a cada 6h
        const sixHAgo = new Date(Date.now() - 6 * 3600_000).toISOString();
        const { data: recent } = await admin
          .from("whatsapp_send_log")
          .select("id")
          .eq("store_id", cfg.store_id).eq("phone", number).eq("kind", "auto_reply")
          .gte("sent_at", sixHAgo).limit(1).maybeSingle();
        if (recent) return json({ ok: true, skipped: "cooldown" });

        // Envia em DUAS mensagens para parecer humano: primeiro a saudação,
        // depois (~10-15s) o link. Reduz o risco de classificação como spam.
        const { data: store } = await admin
          .from("stores").select("slug").eq("id", cfg.store_id).maybeSingle();
        const link = store?.slug ? `https://itasuper.com.br/${store.slug}` : "";
        const rawMsg = (cfg.auto_reply_message || "Olá! 😊 Acesse nosso cardápio e faça seu pedido:").trim();
        // Remove o link de dentro da saudação para não enviar junto.
        const greeting = link ? rawMsg.split(link).join("").replace(/\s+$/g, "").trim() : rawMsg;

        const sendMsg = async (message: string) => {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-send-message`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
            },
            body: JSON.stringify({ store_id: cfg.store_id, phone: number, message, kind: "auto_reply" }),
          });
        };

        // Humaniza: aguarda antes da saudação, depois 10-15s antes do link.
        runInBackground((async () => {
          await sleep(25_000 + Math.floor(Math.random() * 45_000));
          if (greeting) await sendMsg(greeting);
          if (link) {
            await sleep(10_000 + Math.floor(Math.random() * 5_000));
            await sendMsg(link);
          }
        })());
      }
    }

    return json({ ok: true });
  } catch (e) {
    console.error("evolution-webhook error:", e);
    return json({ ok: false }, 200);
  }
});