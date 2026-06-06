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

const incomingPhone = (data: any) => {
  const key = data?.key || data?.messages?.[0]?.key || {};
  const jid = String(key.remoteJid || "");
  const altJid = String(key.remoteJidAlt || key.participant || "");
  const best = altJid.includes("@s.whatsapp.net") ? altJid : jid;
  return best.split("@")[0].replace(/\D/g, "");
};

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const asksForMenu = (text: string) =>
  /(^|\s)(1|sim|s|cardapio|catalogo|menu|pedido|pedir|comprar|link|quero|manda|envia|ok)(\s|$|!|\.|,|\?)/i.test(normalize(text));

const isOptOut = (text: string) =>
  /(^|\s)(parar|stop|cancelar|sair|remover|nao receber)(\s|$|!|\.|,)/i.test(normalize(text));

// Pega hora atual no fuso de São Paulo (UTC-3)
const spHour = () => {
  const now = new Date();
  return (now.getUTCHours() - 3 + 24) % 24;
};

const greetingPrefix = (h: number) =>
  h >= 6 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// 5 variações de saudação (spintax) — SEM link, com pergunta p/ forçar resposta
const buildGreeting = (storeName: string) => {
  const prefix = greetingPrefix(spHour());
  const templates = [
    `${prefix}! 😊 Aqui é da ${storeName}. Posso te ajudar com seu pedido?`,
    `${prefix}! Tudo bem? 👋 Seja bem-vindo(a) à ${storeName}. Gostaria de ver nosso cardápio?`,
    `Olá! ${prefix} 🙂 Aqui é a ${storeName}. Me diz, posso te mandar o cardápio de hoje?`,
    `${prefix}! 🍽️ ${storeName} na escuta. Quer dar uma olhada no nosso menu?`,
    `Oi! ${prefix} 😄 Sou da ${storeName}. Posso te enviar o cardápio com os preços?`,
  ];
  return pick(templates);
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
      const number = incomingPhone(data);
      if (!fromMe && number && /^\d+$/.test(number) && !remoteJid.includes("@g.us") && !remoteJid.includes("status@broadcast")) {
        if (!isRecentIncomingMessage(data)) return json({ ok: true, skipped: "old_message" });
        if (!hasHumanContent(data)) return json({ ok: true, skipped: "non_human_message" });

        const text = incomingText(data);

        // P1.5 — opt-out: cliente digita PARAR -> registra blacklist e não responde
        if (isOptOut(text)) {
          await admin.from("whatsapp_send_log").insert({
            store_id: cfg.store_id, phone: number, message_hash: "optout",
            kind: "opt_out", sent_at: new Date().toISOString(),
          }).catch(() => undefined);
          return json({ ok: true, skipped: "opt_out_registered" });
        }

        // Verifica blacklist (opt-out anterior)
        const { data: blocked } = await admin
          .from("whatsapp_send_log")
          .select("id").eq("store_id", cfg.store_id).eq("phone", number).eq("kind", "opt_out")
          .limit(1).maybeSingle();
        if (blocked) return json({ ok: true, skipped: "blacklisted" });

        // P1.4 — janela de operação 08h-22h (fuso SP)
        const h = spHour();
        if (h < 8 || h >= 22) return json({ ok: true, skipped: "out_of_hours" });

        // P0.3 + P0.5 — saudação SEM link, com pergunta. Link só quando o cliente pedir.
        const { data: store } = await admin
          .from("stores").select("slug, name").eq("id", cfg.store_id).maybeSingle();
        const storeName = store?.name || "nossa loja";
        const link = store?.slug ? `https://itasuper.com.br/${store.slug}` : "";
        const greeting = `${buildGreeting(storeName)}\n\n_Responda PARAR para não receber._`;
        const sendLinkNow = asksForMenu(text) && !!link;
        const menuMessage = `Aqui está nosso cardápio:\n${link}`;

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

        // Cooldown curto: evita saudação duplicada quando o cliente manda várias
        // mensagens seguidas, mas não deixa o bot "mudo" durante testes/atendimento.
        const twoMinutesAgo = new Date(Date.now() - 2 * 60_000).toISOString();
        const { data: recent } = await admin
          .from("whatsapp_send_log")
          .select("id")
          .eq("store_id", cfg.store_id).eq("phone", number).eq("kind", "auto_reply")
          .gte("sent_at", twoMinutesAgo).limit(1).maybeSingle();
        if (recent) {
          if (sendLinkNow) {
            runInBackground((async () => {
              await sleep(2_000 + Math.floor(Math.random() * 3_000));
              await sendMsg(menuMessage);
            })());
            return json({ ok: true, queued: "menu_after_cooldown" });
          }
          return json({ ok: true, skipped: "cooldown" });
        }

        // Pré-registra IMEDIATAMENTE para evitar saudação duplicada quando o
        // cliente manda 2 mensagens em sequência (a 2ª chega antes da 1ª
        // resposta terminar o sleep e ser logada).
        await admin.from("whatsapp_send_log").insert({
          store_id: cfg.store_id, phone: number, message_hash: "greet_pending",
          kind: "auto_reply", sent_at: new Date().toISOString(),
        }).catch(() => undefined);

        // Humaniza: aguarda antes da saudação; só envia link se cliente já pediu.
        runInBackground((async () => {
          // Delay curto e natural (3-8s) — suficiente p/ parecer humano sem irritar.
          await sleep(3_000 + Math.floor(Math.random() * 5_000));
          await sendMsg(greeting);
          if (sendLinkNow) {
            await sleep(4_000 + Math.floor(Math.random() * 3_000));
            await sendMsg(menuMessage);
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