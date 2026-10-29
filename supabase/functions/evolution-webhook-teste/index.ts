import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
interface EvolutionProtocolKey {
  id?: string; remoteJid?: string; fromMe?: boolean;
}
interface EvolutionMessage {
  conversation?: string; extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; mimetype?: string }; videoMessage?: { caption?: string };
  // protocolMessage.type 0 = REVOKE ("apagar para todos"); key.id = id da
  // mensagem original apagada. Baileys pode serializar o tipo como número
  // ou como nome do enum ("REVOKE").
  protocolMessage?: { type?: number | string; key?: EvolutionProtocolKey };
  reactionMessage?: unknown; senderKeyDistributionMessage?: unknown;
  audioMessage?: unknown; documentMessage?: unknown; stickerMessage?: unknown;
}
interface EvolutionIncoming {
  messageTimestamp?: number | string; timestamp?: number | string; date_time?: number | string;
  message?: EvolutionMessage;
  key?: { id?: string; remoteJid?: string; remoteJidAlt?: string; participant?: string; fromMe?: boolean };
  messages?: EvolutionIncoming[];
}
interface ConnectionPatch {
  status: string; phone_number?: string | null; updated_at: string;
  qr_code?: string | null; connected_at?: string | null;
}
interface OpeningHour { day_of_week: number; open_time: string | null; close_time: string | null; is_closed_all_day: boolean; }
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage"
};
const json = (b: unknown, s = 200)=>new Response(JSON.stringify(b), {
    status: s,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
const sleep = (ms: number)=>new Promise((resolve)=>setTimeout(resolve, ms));
// Busca o ownerJid real da instância no Evolution (fonte de verdade).
// Usado no CONNECTION_UPDATE quando state='open' — data.wuid/number vem
// do que o usuário digitou no pairing, não do chip que realmente pareou.
async function resolveOwnerJid(instance: string) {
  const baseUrl = Deno.env.get("EVOLUTION_API_URL");
  const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
  if (!baseUrl || !apiKey) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), 4000);
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, "")}/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`, {
      headers: {
        apikey: apiKey
      },
      signal: ctrl.signal
    });
    const arr = await r.json().catch(()=>[]);
    const inst = Array.isArray(arr) ? arr[0] : arr;
    const owner = inst?.ownerJid || inst?.instance?.owner || inst?.owner || inst?.instance?.ownerJid;
    if (typeof owner === "string" && owner.includes("@")) {
      const num = owner.split("@")[0].replace(/\D/g, "");
      return num || null;
    }
  } catch (e) {
    console.warn("[evolution-webhook] resolveOwnerJid failed", instance, e instanceof Error ? e.message : String(e));
  } finally{
    clearTimeout(timer);
  }
  return null;
}
const isRecentIncomingMessage = (data: EvolutionIncoming)=>{
  const rawTimestamp = data?.messageTimestamp || data?.timestamp || data?.date_time;
  if (!rawTimestamp) return true;
  const ts = typeof rawTimestamp === "number" ? rawTimestamp : Number(rawTimestamp);
  if (!Number.isFinite(ts)) return true;
  const tsMs = ts > 10_000_000_000 ? ts : ts * 1000;
  return Date.now() - tsMs <= 5 * 60_000;
};
const hasHumanContent = (data: EvolutionIncoming)=>{
  const msg = data?.message || data?.messages?.[0]?.message;
  if (!msg) return true;
  if (msg.protocolMessage || msg.reactionMessage || msg.senderKeyDistributionMessage) return false;
  return Boolean(msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || msg.audioMessage || msg.documentMessage || msg.stickerMessage);
};
const incomingText = (data: EvolutionIncoming)=>{
  const msg = data?.message || data?.messages?.[0]?.message || {};
  return String(msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || "");
};
const incomingPhone = (data: EvolutionIncoming)=>{
  const key = data?.key || data?.messages?.[0]?.key || {};
  const jid = String(key.remoteJid || "");
  const altJid = String(key.remoteJidAlt || key.participant || "");
  const best = altJid.includes("@s.whatsapp.net") ? altJid : jid;
  return best.split("@")[0].replace(/\D/g, "");
};
const hasImageMessage = (data: EvolutionIncoming)=>{
  const msg = data?.message || data?.messages?.[0]?.message || {};
  return Boolean(msg.imageMessage);
};
// ID da mensagem no WhatsApp (key.id) — gravado junto do registro para a
// mensagem poder ser localizada depois (ex.: quando for apagada).
const incomingMessageId = (data: EvolutionIncoming)=>{
  const key = data?.key || data?.messages?.[0]?.key;
  const id = key?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
};
// "Apagar para todos" chega como messages.upsert com
// message.protocolMessage (type REVOKE) apontando para a mensagem original
// em protocolMessage.key.id. Retorna esse id, ou null se não for revoke.
const extractRevokeId = (data: EvolutionIncoming)=>{
  const msg = data?.message || data?.messages?.[0]?.message;
  const proto = msg?.protocolMessage;
  if (!proto) return null;
  const t = proto.type;
  const isRevoke = t === 0 || t === "0" || (typeof t === "string" && t.toUpperCase() === "REVOKE");
  if (!isRevoke) return null;
  const rid = proto.key?.id;
  return typeof rid === "string" && rid.length > 0 ? rid : null;
};
// Baixa imagem via Evolution API (base64) — usado para comprovantes Pix Direto do bot.
const fetchImageBase64 = async (instance: string, data: EvolutionIncoming)=>{
  const baseUrl = Deno.env.get("EVOLUTION_API_URL");
  const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
  if (!baseUrl || !apiKey) return null;
  const key = data?.key || data?.messages?.[0]?.key;
  const msg = data?.message || data?.messages?.[0]?.message;
  if (!key || !msg) return null;
  const mime = String(msg?.imageMessage?.mimetype || "image/jpeg");
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey
      },
      body: JSON.stringify({
        message: {
          key,
          message: msg
        },
        convertToMp4: false
      })
    });
    if (!r.ok) {
      console.warn("[evolution-webhook] getBase64 failed", r.status);
      return null;
    }
    const out = await r.json().catch(()=>null);
    const base64 = out?.base64 || out?.data || out?.body || null;
    if (typeof base64 !== "string" || base64.length < 32) return null;
    return {
      base64,
      mime
    };
  } catch (e) {
    console.warn("[evolution-webhook] getBase64 error", e instanceof Error ? e.message : String(e));
    return null;
  }
};
const normalize = (text: string)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const isOptOut = (text: string)=>/(^|\s)(parar|stop|cancelar|sair|remover|nao receber)(\s|$|!|\.|,)/i.test(normalize(text));
// Opt-out EXPLÍCITO ("PARAR"/"STOP", palavra exata): é o único que
// registra a blacklist ANTES do bot. "cancelar"/"sair" NÃO entram aqui —
// durante o bot, são só "encerrar atendimento" e seguem pro handler.
const isExplicitOptOut = (text: string)=>/^(parar|stop)[!.,\s]*$/i.test(normalize(text));
// P2 — "placa de entre aqui": bot fala 1x por número / 16h e some.
const SILENCE_AFTER_LINK_MS = 16 * 60 * 60_000; // 16h
// P2 — pula 1º contato: só responde se cliente mandar ≥2 msgs em 10min
// (filtra desengano/erro de digitação sem gastar envio).
const FIRST_CONTACT_WINDOW_MS = 10 * 60_000;
// Pega hora atual no fuso de São Paulo (UTC-3)
const spHour = ()=>{
  const now = new Date();
  return (now.getUTCHours() - 3 + 24) % 24;
};
const greetingPrefix = (h: number)=>h >= 6 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
// Fase 3 — rotação de templates + micro-variação invisível para evitar
// detecção de "mesma mensagem" pela Meta. Cada envio combina um template
// aleatório com pequenas variações de emoji/pontuação e um caractere
// zero-width no fim (invisível), gerando hash único a cada envio.
const pick = (arr: readonly string[])=>arr[Math.floor(Math.random() * arr.length)];
const ZW = [
  "\u200B",
  "\u200C",
  "\u200D",
  "\uFEFF"
]; // zero-width chars
const EMOJIS_OPEN = [
  "🍽️",
  "🍕",
  "🍔",
  "😋",
  "🛵",
  "✨",
  "🥘"
];
const OPT_OUT = [
  "_(Responda PARAR para não receber mais mensagens)_",
  "_(Envie PARAR se não quiser mais receber)_",
  "_(Digite PARAR para sair desta lista)_"
];
const buildOneShot = (storeName: string, link: string)=>{
  const prefix = greetingPrefix(spHour());
  const emoji = pick(EMOJIS_OPEN);
  const opt = pick(OPT_OUT);
  const zw = pick(ZW);
  const templates = [
    `${prefix}! Aqui é da *${storeName}*. ${emoji}\n\nNosso cardápio com preços e pedidos:\n${link}\n\n${opt}`,
    `${prefix}! ${emoji} Somos a *${storeName}*.\n\nDá uma olhada no cardápio e peça por aqui:\n${link}\n\n${opt}`,
    `${prefix}, tudo bem? ${emoji}\nAqui é a *${storeName}* — cardápio, preços e pedido online:\n${link}\n\n${opt}`,
    `${prefix}! Obrigado pelo contato com a *${storeName}* ${emoji}\n\nVeja o cardápio completo:\n${link}\n\n${opt}`
  ];
  return pick(templates) + zw;
};
const buildClosedOneShot = (storeName: string, link: string, nextOpen: string)=>{
  const opt = pick(OPT_OUT);
  const zw = pick(ZW);
  const templates = [
    `Olá! Aqui é da *${storeName}*. No momento estamos *fechados* — voltamos ${nextOpen}.\n\nEnquanto isso, dá pra ver o cardápio:\n${link}\n\n${opt}`,
    `Oi! A *${storeName}* está *fechada* agora, voltamos ${nextOpen}.\n\nJá deixe seu pedido separado no cardápio:\n${link}\n\n${opt}`,
    `Olá 👋 Estamos *fora do horário* na *${storeName}*, retornamos ${nextOpen}.\n\nCardápio para adiantar:\n${link}\n\n${opt}`
  ];
  return pick(templates) + zw;
};
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  try {
    const url = new URL(req.url);
    const expected = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN");
    // FAIL-CLOSED: se secret não configurado, rejeita todas as chamadas.
    if (!expected) {
      console.error("[evolution-webhook] EVOLUTION_WEBHOOK_TOKEN não configurado — rejeitando");
      return json({
        error: "Webhook not configured"
      }, 500);
    }
    // Aceita token via header (preferido) OU query string (compat com configs existentes)
    const receivedToken = req.headers.get("x-webhook-token") || req.headers.get("x-internal-token") || url.searchParams.get("token") || "";
    if (receivedToken !== expected) return json({
      error: "Forbidden"
    }, 403);
    const body = await req.json().catch(()=>({}));
    const event = body?.event || body?.type || "";
    const instance = body?.instance || body?.instanceName || body?.sender || "";
    const data = body?.data || body;
    console.log("[evolution-webhook] incoming", {
      event,
      instance,
      hasData: Boolean(data),
      remoteJid: data?.key?.remoteJid || data?.messages?.[0]?.key?.remoteJid || null,
      fromMe: data?.key?.fromMe ?? data?.messages?.[0]?.key?.fromMe ?? null
    });
    if (!instance) return json({
      ok: true
    });
    const backendUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const backendKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!backendUrl || !backendKey) return json({ error: "Backend não configurado" }, 500);
    const admin = createClient(backendUrl, backendKey);
    const { data: cfg } = await admin.from("store_whatsapp_config").select("store_id, auto_reply_enabled, auto_reply_message, evolution_api_url, evolution_instance_name, status, send_disabled").eq("evolution_instance_name", instance).maybeSingle();
    if (!cfg) {
      // Instância da plataforma (ItaSuper) — sincroniza status em platform_whatsapp_config.
      if (/connection/i.test(event)) {
        const state = data?.state || data?.status || "";
        const statusReason = Number(data?.statusReason || data?.reason || 0);
        let phone = data?.wuid?.split("@")?.[0] || data?.number || data?.owner;
        const { data: pcfg } = await admin.from("platform_whatsapp_config").select("id, status, phone_number").eq("instance_name", instance).maybeSingle();
        if (pcfg) {
          let newStatus = null;
          if (state === "open" || state === "connected") newStatus = "connected";
          else if ((state === "close" || state === "disconnected") && statusReason === 401) newStatus = "disconnected";
          else if (pcfg.status !== "connected") newStatus = "connecting";
          if (newStatus === "connected") {
            const real = await resolveOwnerJid(instance);
            if (real) phone = real;
          }
          if (newStatus) {
            const norm = (v: unknown)=>String(v || "").replace(/\D/g, "");
            const phoneChanged = !!phone && norm(phone) !== norm(pcfg.phone_number);
            const patch: ConnectionPatch = {
              status: newStatus,
              phone_number: phone ?? undefined,
              updated_at: new Date().toISOString()
            };
            if (newStatus === "connected" && (pcfg.status !== "connected" || phoneChanged)) {
              patch.connected_at = new Date().toISOString();
            }
            if (newStatus === "disconnected") {
              patch.phone_number = null;
              patch.connected_at = null;
            }
            await admin.from("platform_whatsapp_config").update(patch).eq("id", pcfg.id);
            console.log("[evolution-webhook] platform connection", {
              instance,
              newStatus,
              phone,
              phoneChanged
            });
          }
          return json({
            ok: true,
            platform: true
          });
        }
      }
      console.warn("[evolution-webhook] instance without config", {
        instance,
        event
      });
      return json({
        ok: true
      });
    }
    // CONNECTION_UPDATE
    if (/connection/i.test(event)) {
      const state = data?.state || data?.status || "";
      const statusReason = Number(data?.statusReason || data?.reason || 0);
      let phone = data?.wuid?.split("@")?.[0] || data?.number || data?.owner;
      // Evolution/Baileys emits transient "close"/"connecting" events even
      // right after a successful pairing (socket reconnect). Only flip the
      // status to "disconnected" when the device was actually logged out
      // (statusReason 401) — otherwise we'd kick a healthy connection.
      let newStatus = null;
      if (state === "open" || state === "connected") newStatus = "connected";
      else if ((state === "close" || state === "disconnected") && statusReason === 401) newStatus = "disconnected";
      else if (cfg.status !== "connected") newStatus = "connecting";
      if (newStatus === "connected") {
        const real = await resolveOwnerJid(instance);
        if (real) phone = real;
      }
      if (newStatus) {
        const { data: cur } = await admin.from("store_whatsapp_config").select("phone_number, status").eq("store_id", cfg.store_id).maybeSingle();
        const norm = (v: unknown)=>String(v || "").replace(/\D/g, "");
        const phoneChanged = !!phone && norm(phone) !== norm(cur?.phone_number);
        const patch: ConnectionPatch = {
          status: newStatus,
          phone_number: phone ?? undefined,
          qr_code: newStatus === "connected" ? null : undefined,
          updated_at: new Date().toISOString()
        };
        if (newStatus === "connected" && (cfg.status !== "connected" || phoneChanged)) {
          patch.connected_at = new Date().toISOString();
        }
        if (newStatus === "disconnected") {
          patch.phone_number = null;
          patch.connected_at = null;
        }
        await admin.from("store_whatsapp_config").update(patch).eq("store_id", cfg.store_id);
        console.log("[evolution-webhook] store connection", {
          instance,
          newStatus,
          phone,
          phoneChanged
        });
      }
    }
    // MESSAGES_UPSERT
    if (/messages.?upsert/i.test(event)) {
      // "Apagar para todos" (REVOKE) — inclusive quando é a própria loja
      // (fromMe) apagando uma mensagem que ela enviou: marca deleted_at no
      // registro já salvo, SEM apagar o texto. O lojista continua vendo a
      // mensagem, com o selo "Apagada". Se a mensagem original não estiver
      // no registro (antiga, sem ID), responde ok e segue sem erro.
      const revokedId = extractRevokeId(data);
      if (revokedId) {
        const { data: marked, error: revokeError } = await admin.from("whatsapp_inbound_log")
          .update({ deleted_at: new Date().toISOString() })
          .eq("store_id", cfg.store_id)
          .eq("wa_message_id", revokedId)
          .is("deleted_at", null)
          .select("id");
        if (revokeError) console.warn("[evolution-webhook] revoke mark failed", revokeError.message);
        console.log("[evolution-webhook] revoke handled", {
          store: cfg.store_id,
          wa_message_id: revokedId,
          marked: marked?.length ?? 0
        });
        return json({
          ok: true,
          revoked: revokedId,
          marked: marked?.length ?? 0
        });
      }
      const key = data?.key || data?.messages?.[0]?.key || {};
      const fromMe = key?.fromMe;
      const remoteJid = key?.remoteJid || "";
      const number = incomingPhone(data);
      // Mensagens que a propria loja digita (fromMe): tambem registradas
      // (direction='out') — a conversa fica completa no historico da loja.
      if (fromMe && number && /^\d+$/.test(number) && !remoteJid.includes("@g.us") && !remoteJid.includes("status@broadcast")) {
        if (isRecentIncomingMessage(data)) {
          const outText = incomingText(data);
          const { error: outLogError } = await admin.from("whatsapp_inbound_log").insert({
            store_id: cfg.store_id,
            phone: number,
            message: outText || "[mensagem sem texto]",
            push_name: "",
            direction: "out",
            wa_message_id: incomingMessageId(data)
          });
          if (outLogError) console.warn("[evolution-webhook] outbound log skipped", outLogError.message);
        }
        return json({ ok: true, skipped: "from_me_logged" });
      }
      if (!fromMe && number && /^\d+$/.test(number) && !remoteJid.includes("@g.us") && !remoteJid.includes("status@broadcast")) {
        if (!isRecentIncomingMessage(data)) return json({
          ok: true,
          skipped: "old_message"
        });
        const text = incomingText(data);
        // Registro de recebidas: guarda número + mensagem ANTES de qualquer
        // skip (inclusive com auto-reply desligado) — a loja pode estar em
        // modo observação (só recebe, não dispara).
        const { error: inboundLogError } = await admin.from("whatsapp_inbound_log").insert({
          store_id: cfg.store_id,
          phone: number,
          message: text || "[mensagem sem texto]",
          push_name: String((data as any)?.pushName || ""),
          wa_message_id: incomingMessageId(data)
        });
        if (inboundLogError) console.warn("[evolution-webhook] inbound log skipped", inboundLogError.message);
        // Modo observação (send_disabled): registra e NÃO dispara nada —
        // nem bot, nem saudação (paridade com o meta-webhook).
        if ((cfg as any).send_disabled) return json({
          ok: true,
          skipped: "send_disabled"
        });
        // Conteúdo humano: texto/legenda, áudio, documento e sticker
        // contam; imagem SEM legenda só conta quando o bot está aguardando
        // comprovante Pix (paridade com o meta-webhook).
        let humanish = hasHumanContent(data);
        let awaitingProof = false;
        if (!humanish && hasImageMessage(data)) {
          const { data: sessPeek } = await admin.from("whatsapp_bot_sessions")
            .select("current_step").eq("store_id", cfg.store_id).eq("phone", number).maybeSingle();
          awaitingProof = (sessPeek as any)?.current_step === "awaiting_pix_proof";
          if (awaitingProof) humanish = true;
        }
        if (!humanish) return json({
          ok: true,
          skipped: "non_human_message"
        });
        // ── Opt-out ANTES do bot ─────────────────────────────────────
        // "PARAR"/"STOP" registra a blacklist e não despacha nada; quem
        // já optou antes também não chega ao bot (paridade com o
        // meta-webhook). "cancelar"/"sair" NÃO entram aqui: no bot, são
        // só "encerrar atendimento" e seguem pro handler.
        if (isExplicitOptOut(text)) {
          await admin.from("whatsapp_send_log").insert({
            store_id: cfg.store_id,
            phone: number,
            message_hash: "optout",
            kind: "opt_out",
            sent_at: new Date().toISOString()
          });
          await admin.from("whatsapp_bot_sessions").delete().eq("store_id", cfg.store_id).eq("phone", number);
          return json({
            ok: true,
            skipped: "opt_out_registered"
          });
        }
        {
          const { data: blocked } = await admin.from("whatsapp_send_log").select("id").eq("store_id", cfg.store_id).eq("phone", number).eq("kind", "opt_out").limit(1).maybeSingle();
          if (blocked) return json({
            ok: true,
            skipped: "blacklisted"
          });
        }
        // ── Bot de menu guiado (Fase 1) ──────────────────────────────
        // Restaurado na reativação (2026-10-24): o bloco foi removido no
        // commit 9affd874 (22/10) e volta idêntico, com o portão de
        // opt-out/blacklist acima. Roda ANTES do auto-reply e independe
        // de auto_reply_enabled.
        try {
          const { data: botCfg } = await admin
            .from("whatsapp_bot_config")
            .select("enabled").eq("store_id", cfg.store_id).maybeSingle();
          if (botCfg?.enabled) {
            // Se a sessão do bot está aguardando comprovante e chegou imagem,
            // baixamos base64 e passamos junto pro handler processar.
            let image_base64: string | undefined;
            let image_mime: string | undefined;
            if (hasImageMessage(data) && awaitingProof) {
              const img = await fetchImageBase64(instance, data);
              if (img) { image_base64 = img.base64; image_mime = img.mime; }
            }
            const botBase = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
            const botKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
            const botRes = await fetch(`${botBase}/functions/v1/whatsapp-bot-handler`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: botKey,
                Authorization: `Bearer ${botKey}`,
                "x-internal-token": Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "",
              },
              body: JSON.stringify({ store_id: cfg.store_id, phone: number, text, image_base64, image_mime }),
            });
            const botOut = await botRes.json().catch(() => ({} as any));
            console.log("[evolution-webhook] bot dispatch", { store: cfg.store_id, phone: number, status: botRes.status, out: botOut });
            if (botOut?.handled) {
              return json({ ok: true, bot: botOut.action || "handled" });
            }
            // handled=false → cai pra fluxo auto-reply normal (ex.: mensagem sem gatilho)
          }
        } catch (e) {
          console.error("[evolution-webhook] bot dispatch failed", e instanceof Error ? e.message : String(e));
        }

        // Se auto-reply está desligado, para aqui (bot já teve a chance).
        if (!cfg.auto_reply_enabled) return json({
          ok: true,
          skipped: "auto_reply_off"
        });
        // P2 — opt-out: cliente digita PARAR -> registra blacklist e não responde
        if (isOptOut(text)) {
          await admin.from("whatsapp_send_log").insert({
            store_id: cfg.store_id,
            phone: number,
            message_hash: "optout",
            kind: "opt_out",
            sent_at: new Date().toISOString()
          });
          return json({
            ok: true,
            skipped: "opt_out_registered"
          });
        }
        // Verifica blacklist (opt-out anterior)
        const { data: blocked } = await admin.from("whatsapp_send_log").select("id").eq("store_id", cfg.store_id).eq("phone", number).eq("kind", "opt_out").limit(1).maybeSingle();
        if (blocked) return json({
          ok: true,
          skipped: "blacklisted"
        });
        // P2 — silêncio 16h: se já mandamos (ou estamos mandando) saudação
        // nas últimas 16h, some. INCLUI greet_pending para bloquear rajada
        // de mensagens que chegam em segundos (bug: 2 respostas seguidas).
        const silenceSince = new Date(Date.now() - SILENCE_AFTER_LINK_MS).toISOString();
        const { data: recentGreet } = await admin.from("whatsapp_send_log").select("id").eq("store_id", cfg.store_id).eq("phone", number).eq("kind", "auto_reply").gte("sent_at", silenceSince).limit(1).maybeSingle();
        if (recentGreet) return json({
          ok: true,
          skipped: "silence_24h"
        });
        // P2 — 1º contato: agora respondemos imediatamente na 1ª mensagem.
        //  Camadas anti-ban restantes: dedupe 16h, opt-out, limite diário,
        //  delay 2-4s, rotação de templates + zero-width e slug alias rotativo.
        // Janela de operação baseada nos horários do lojista (fuso SP).
        // Se não houver horários cadastrados, cai no fallback 08h-22h.
        let storeClosedInfo = null;
        {
          const now = new Date();
          const brParts = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          }).formatToParts(now);
          const brHour = Number(brParts.find((p)=>p.type === "hour")?.value ?? 0);
          const brMin = Number(brParts.find((p)=>p.type === "minute")?.value ?? 0);
          const brDay = new Date(now.toLocaleString("en-US", {
            timeZone: "America/Sao_Paulo"
          })).getDay();
          const curMin = brHour * 60 + brMin;
          const { data: hours } = await admin.from("opening_hours").select("day_of_week, open_time, close_time, is_closed_all_day").eq("store_id", cfg.store_id);
          const dayNames = [
            "domingo",
            "segunda",
            "terça",
            "quarta",
            "quinta",
            "sexta",
            "sábado"
          ];
          const findNextOpen = (list: OpeningHour[])=>{
            for(let off = 0; off <= 7; off++){
              const d = (brDay + off) % 7;
              const h = list.find((x)=>x.day_of_week === d);
              if (!h || h.is_closed_all_day) continue;
              const [oH, oM] = String(h.open_time).split(":").map(Number);
              const o = oH * 60 + oM;
              if (off === 0 && curMin >= o) continue;
              const label = off === 0 ? "hoje" : off === 1 ? "amanhã" : dayNames[d];
              return `${label} às ${String(h.open_time).slice(0, 5)}`;
            }
            return "em breve";
          };
          if (hours && hours.length > 0) {
            const isOpenAt = (day: number, minutes: number)=>{
              const h = hours.find((x)=>x.day_of_week === day);
              if (!h || h.is_closed_all_day) return false;
              const [oH, oM] = String(h.open_time).split(":").map(Number);
              const [cH, cM] = String(h.close_time).split(":").map(Number);
              const o = oH * 60 + oM;
              let c = cH * 60 + cM;
              if (c <= o) {
                // overnight: open today after o OR today before c (carry from previous day handled separately)
                return minutes >= o;
              }
              return minutes >= o && minutes < c;
            };
            const isOpenOvernightFromPrev = ()=>{
              const prev = (brDay + 6) % 7;
              const h = hours.find((x)=>x.day_of_week === prev);
              if (!h || h.is_closed_all_day) return false;
              const [oH, oM] = String(h.open_time).split(":").map(Number);
              const [cH, cM] = String(h.close_time).split(":").map(Number);
              const o = oH * 60 + oM;
              const c = cH * 60 + cM;
              return c <= o && curMin < c;
            };
            const open = isOpenAt(brDay, curMin) || isOpenOvernightFromPrev();
            if (!open) storeClosedInfo = {
              nextOpenLabel: findNextOpen(hours)
            };
          } else {
            if (brHour < 8 || brHour >= 22) storeClosedInfo = {
              nextOpenLabel: "amanhã às 08:00"
            };
          }
        }
        // P2 — UMA mensagem só (saudação + link) ou aviso de fechado com link.
        const { data: store } = await admin.from("stores").select("slug, slug_aliases, name").eq("id", cfg.store_id).maybeSingle();
        const storeName = store?.name || "nossa loja";
        // Anti-spam: sorteia entre slug principal e aliases para variar o link.
        const slugPool = [
          store?.slug,
          ...store?.slug_aliases || []
        ].filter((s)=>typeof s === "string" && s.length > 0);
        const pickedSlug = slugPool.length > 0 ? slugPool[Math.floor(Math.random() * slugPool.length)] : "";
        const link = pickedSlug ? `https://itasuper.com.br/${pickedSlug}` : "";
        if (!link) return json({
          ok: true,
          skipped: "no_link_configured"
        });
        const oneShotMessage = storeClosedInfo ? buildClosedOneShot(storeName, link, storeClosedInfo.nextOpenLabel) : buildOneShot(storeName, link);
        const sendMsg = async (message: string)=>{
          // Functions must call the current Cloud functions host. EXTERNAL_SUPABASE_URL
          // is only the production data backend; using it here can route webhooks to
          // stale external functions and make incoming WhatsApp messages disappear.
          const functionBaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL");
          const functionKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
          const response = await fetch(`${functionBaseUrl}/functions/v1/evolution-send-message`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: functionKey,
              Authorization: `Bearer ${functionKey}`,
              "x-internal-token": Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || ""
            },
            body: JSON.stringify({
              store_id: cfg.store_id,
              phone: number,
              message,
              kind: "auto_reply"
            })
          });
          const result = await response.json().catch(()=>({}));
          if (!response.ok || result?.error) {
            console.error("auto-reply send failed", {
              store_id: cfg.store_id,
              phone: number,
              status: response.status,
              result
            });
            throw new Error(`auto_reply_send_failed_${response.status}`);
          }
        };
        // Pré-registra IMEDIATAMENTE (greet_pending) para bloquear rajada
        // via unique index (store_id, phone, kind, sent_bucket_min) da Fase 1.
        // Se o insert falhar (conflito unique), outra invocação já está enviando
        // — ABORTA para não gerar 2 respostas.
        const { error: pendingLogError } = await admin.from("whatsapp_send_log").insert({
          store_id: cfg.store_id,
          phone: number,
          message_hash: "greet_pending",
          kind: "auto_reply",
          sent_at: new Date().toISOString()
        });
        if (pendingLogError) {
          console.warn("[evolution-webhook] pending log conflict — skipping duplicate send", pendingLogError.message);
          return json({
            ok: true,
            skipped: "concurrent_send_in_progress"
          });
        }
        // Um envio só, com pequeno delay humano (2-4s).
        await sleep(2_000 + Math.floor(Math.random() * 2_000));
        await sendMsg(oneShotMessage);
        return json({
          ok: true,
          sent: storeClosedInfo ? "closed_oneshot" : "oneshot"
        });
      }
    }
    return json({
      ok: true
    });
  } catch (e) {
    console.error("evolution-webhook error:", e);
    return json({
      ok: false
    }, 200);
  }
});
