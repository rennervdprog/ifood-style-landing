import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const GREETING_COOLDOWN_MS = 6 * 60 * 60_000; // 6h
const FAST_COOLDOWN_MS = 2 * 60_000;

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
    // FAIL-CLOSED: se secret não configurado, rejeita todas as chamadas.
    if (!expected) {
      console.error("[evolution-webhook] EVOLUTION_WEBHOOK_TOKEN não configurado — rejeitando");
      return json({ error: "Webhook not configured" }, 500);
    }
    // Aceita token via header (preferido) OU query string (compat com configs existentes)
    const receivedToken =
      req.headers.get("x-webhook-token") ||
      req.headers.get("x-internal-token") ||
      url.searchParams.get("token") ||
      "";
    if (receivedToken !== expected) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const event: string = body?.event || body?.type || "";
    const instance: string = body?.instance || body?.instanceName || body?.sender || "";
    const data: any = body?.data || body;

    console.log("[evolution-webhook] incoming", {
      event,
      instance,
      hasData: Boolean(data),
      remoteJid: data?.key?.remoteJid || data?.messages?.[0]?.key?.remoteJid || null,
      fromMe: data?.key?.fromMe ?? data?.messages?.[0]?.key?.fromMe ?? null,
    });

    if (!instance) return json({ ok: true });

    const admin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: cfg } = await admin
      .from("store_whatsapp_config")
      .select("store_id, auto_reply_enabled, auto_reply_message, evolution_api_url, evolution_instance_name, status")
      .eq("evolution_instance_name", instance)
      .maybeSingle();
    if (!cfg) {
      console.warn("[evolution-webhook] instance without config", { instance, event });
      return json({ ok: true });
    }

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
      const key = data?.key || data?.messages?.[0]?.key || {};
      const fromMe = key?.fromMe;
      const remoteJid: string = key?.remoteJid || "";
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
          });
          return json({ ok: true, skipped: "opt_out_registered" });
        }

        // Verifica blacklist (opt-out anterior)
        const { data: blocked } = await admin
          .from("whatsapp_send_log")
          .select("id").eq("store_id", cfg.store_id).eq("phone", number).eq("kind", "opt_out")
          .limit(1).maybeSingle();
        if (blocked) return json({ ok: true, skipped: "blacklisted" });

        // P1.4 — janela de operação baseada nos horários do lojista (fuso SP).
        // Se não houver horários cadastrados, cai no fallback 08h-22h.
        // Quando fechado, envia 1 aviso "estamos fechados" por cliente (cooldown 6h).
        let storeClosedInfo: { nextOpenLabel: string } | null = null;
        {
          const now = new Date();
          const brParts = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
          }).formatToParts(now);
          const brHour = Number(brParts.find(p => p.type === "hour")?.value ?? 0);
          const brMin = Number(brParts.find(p => p.type === "minute")?.value ?? 0);
          const brDay = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();
          const curMin = brHour * 60 + brMin;

          const { data: hours } = await admin
            .from("opening_hours")
            .select("day_of_week, open_time, close_time, is_closed_all_day")
            .eq("store_id", cfg.store_id);

          const dayNames = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
          const findNextOpen = (list: any[]) => {
            for (let off = 0; off <= 7; off++) {
              const d = (brDay + off) % 7;
              const h = list.find((x: any) => x.day_of_week === d);
              if (!h || h.is_closed_all_day) continue;
              const [oH, oM] = String(h.open_time).split(":").map(Number);
              const o = oH * 60 + oM;
              if (off === 0 && curMin >= o) continue;
              const label = off === 0 ? "hoje" : off === 1 ? "amanhã" : dayNames[d];
              return `${label} às ${String(h.open_time).slice(0,5)}`;
            }
            return "em breve";
          };

          if (hours && hours.length > 0) {
            const isOpenAt = (day: number, minutes: number) => {
              const h = hours.find((x: any) => x.day_of_week === day);
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
            const isOpenOvernightFromPrev = () => {
              const prev = (brDay + 6) % 7;
              const h = hours.find((x: any) => x.day_of_week === prev);
              if (!h || h.is_closed_all_day) return false;
              const [oH, oM] = String(h.open_time).split(":").map(Number);
              const [cH, cM] = String(h.close_time).split(":").map(Number);
              const o = oH * 60 + oM;
              const c = cH * 60 + cM;
              return c <= o && curMin < c;
            };
            const open = isOpenAt(brDay, curMin) || isOpenOvernightFromPrev();
            if (!open) storeClosedInfo = { nextOpenLabel: findNextOpen(hours) };
          } else {
            if (brHour < 8 || brHour >= 22) storeClosedInfo = { nextOpenLabel: "amanhã às 08:00" };
          }
        }

        // P0.3 + P0.5 — saudação SEM link, com pergunta. Link só quando o cliente pedir.
        const { data: store } = await admin
          .from("stores").select("slug, name").eq("id", cfg.store_id).maybeSingle();
        const storeName = store?.name || "nossa loja";
        const link = store?.slug ? `https://itasuper.com.br/${store.slug}` : "";
        const greeting = `${buildGreeting(storeName)}\n\n_Responda PARAR para não receber._`;
        const closedMessage = storeClosedInfo
          ? `Olá! 😊 Aqui é da *${storeName}*. No momento estamos *fechados*. Voltamos a atender ${storeClosedInfo.nextOpenLabel}. Assim que abrirmos, te respondemos por aqui! 🙏\n\n_Responda PARAR para não receber._`
          : "";
        const sendLinkNow = asksForMenu(text) && !!link;
        const menuMessage = `Aqui está nosso cardápio:\n${link}`;

        const sendMsg = async (message: string) => {
          const functionBaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
          const functionKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
          const response = await fetch(`${functionBaseUrl}/functions/v1/evolution-send-message`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: functionKey,
              Authorization: `Bearer ${functionKey}`,
              "x-internal-token": Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "",
            },
            body: JSON.stringify({ store_id: cfg.store_id, phone: number, message, kind: "auto_reply" }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || (result as any)?.error) {
            console.error("auto-reply send failed", { store_id: cfg.store_id, phone: number, status: response.status, result });
            throw new Error(`auto_reply_send_failed_${response.status}`);
          }
        };

        // Não repetir saudação na mesma conversa. Se o cliente responder "sim"
        // depois da saudação, manda só o cardápio/link.
        const fastCooldownAgo = new Date(Date.now() - FAST_COOLDOWN_MS).toISOString();
        const greetingCooldownAgo = new Date(Date.now() - GREETING_COOLDOWN_MS).toISOString();
        const { data: recentReplies } = await admin
          .from("whatsapp_send_log")
          .select("id, sent_at")
          .eq("store_id", cfg.store_id).eq("phone", number).eq("kind", "auto_reply")
          .neq("message_hash", "greet_pending")
          .gte("sent_at", greetingCooldownAgo)
          .order("sent_at", { ascending: false })
          .limit(1);
        const lastAutoReply = recentReplies?.[0];
        const hasFastRecentReply = !!lastAutoReply && new Date(lastAutoReply.sent_at).getTime() >= Date.now() - FAST_COOLDOWN_MS;
        if (lastAutoReply) {
          if (storeClosedInfo) return json({ ok: true, skipped: "closed_cooldown" });
          if (sendLinkNow) {
            await sleep(hasFastRecentReply ? 1_200 + Math.floor(Math.random() * 1_500) : 400);
            await sendMsg(menuMessage);
            return json({ ok: true, sent: "menu_only_after_greeting" });
          }
          return json({ ok: true, skipped: hasFastRecentReply ? "fast_cooldown" : "greeting_cooldown" });
        }

        // Pré-registra IMEDIATAMENTE para evitar saudação duplicada quando o
        // cliente manda 2 mensagens em sequência (a 2ª chega antes da 1ª
        // resposta terminar o sleep e ser logada).
        await admin.from("whatsapp_send_log").insert({
          store_id: cfg.store_id, phone: number, message_hash: "greet_pending",
          kind: "auto_reply", sent_at: new Date().toISOString(),
        });

        // Loja fechada → envia 1 aviso (sem cardápio) e encerra.
        if (storeClosedInfo) {
          await sleep(1_000 + Math.floor(Math.random() * 1_500));
          await sendMsg(closedMessage);
          return json({ ok: true, sent: "closed_notice" });
        }

        // Humaniza: aguarda antes da saudação; só envia link se cliente já pediu.
        // P0.6 — NÃO mandar a saudação em background: em runs curtos do
        // EdgeRuntime a task era morta antes do fetch, deixando só o
        // `greet_pending` no log e o cliente sem resposta. Aguardamos aqui
        // (3-8s cabe no timeout) e qualquer envio extra também aguarda confirmação.
        await sleep(800 + Math.floor(Math.random() * 700));
        await sendMsg(greeting);
        if (sendLinkNow) {
          await sleep(1_200 + Math.floor(Math.random() * 800));
          await sendMsg(menuMessage);
        }
      }
    }

    return json({ ok: true });
  } catch (e) {
    console.error("evolution-webhook error:", e);
    return json({ ok: false }, 200);
  }
});