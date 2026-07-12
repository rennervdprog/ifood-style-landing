import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Busca o ownerJid real da instância no Evolution (fonte de verdade).
// Usado no CONNECTION_UPDATE quando state='open' — data.wuid/number vem
// do que o usuário digitou no pairing, não do chip que realmente pareou.
async function resolveOwnerJid(instance: string): Promise<string | null> {
  const baseUrl = Deno.env.get("EVOLUTION_API_URL");
  const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
  if (!baseUrl || !apiKey) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(
      `${baseUrl.replace(/\/$/, "")}/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`,
      { headers: { apikey: apiKey }, signal: ctrl.signal },
    );
    const arr: any = await r.json().catch(() => []);
    const inst = Array.isArray(arr) ? arr[0] : arr;
    const owner = inst?.ownerJid || inst?.instance?.owner || inst?.owner || inst?.instance?.ownerJid;
    if (typeof owner === "string" && owner.includes("@")) {
      const num = owner.split("@")[0].replace(/\D/g, "");
      return num || null;
    }
  } catch (e) {
    console.warn("[evolution-webhook] resolveOwnerJid failed", instance, (e as any)?.message);
  } finally {
    clearTimeout(timer);
  }
  return null;
}

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

const isOptOut = (text: string) =>
  /(^|\s)(parar|stop|cancelar|sair|remover|nao receber)(\s|$|!|\.|,)/i.test(normalize(text));

// P2 — "placa de entre aqui": bot fala 1x por número / 24h e some.
const SILENCE_AFTER_LINK_MS = 24 * 60 * 60_000; // 24h
// P2 — pula 1º contato: só responde se cliente mandar ≥2 msgs em 10min
// (filtra desengano/erro de digitação sem gastar envio).
const FIRST_CONTACT_WINDOW_MS = 10 * 60_000;

// Pega hora atual no fuso de São Paulo (UTC-3)
const spHour = () => {
  const now = new Date();
  return (now.getUTCHours() - 3 + 24) % 24;
};

const greetingPrefix = (h: number) =>
  h >= 6 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";

// Fase 3 — rotação de templates + micro-variação invisível para evitar
// detecção de "mesma mensagem" pela Meta. Cada envio combina um template
// aleatório com pequenas variações de emoji/pontuação e um caractere
// zero-width no fim (invisível), gerando hash único a cada envio.
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const ZW = ["\u200B", "\u200C", "\u200D", "\uFEFF"]; // zero-width chars
const EMOJIS_OPEN = ["🍽️", "🍕", "🍔", "😋", "🛵", "✨", "🥘"];
const OPT_OUT = [
  "_(Responda PARAR para não receber mais mensagens)_",
  "_(Envie PARAR se não quiser mais receber)_",
  "_(Digite PARAR para sair desta lista)_",
];

const buildOneShot = (storeName: string, link: string) => {
  const prefix = greetingPrefix(spHour());
  const emoji = pick(EMOJIS_OPEN);
  const opt = pick(OPT_OUT);
  const zw = pick(ZW);
  const templates = [
    `${prefix}! Aqui é da *${storeName}*. ${emoji}\n\nNosso cardápio com preços e pedidos:\n${link}\n\n${opt}`,
    `${prefix}! ${emoji} Somos a *${storeName}*.\n\nDá uma olhada no cardápio e peça por aqui:\n${link}\n\n${opt}`,
    `${prefix}, tudo bem? ${emoji}\nAqui é a *${storeName}* — cardápio, preços e pedido online:\n${link}\n\n${opt}`,
    `${prefix}! Obrigado pelo contato com a *${storeName}* ${emoji}\n\nVeja o cardápio completo:\n${link}\n\n${opt}`,
  ];
  return pick(templates) + zw;
};

const buildClosedOneShot = (storeName: string, link: string, nextOpen: string) => {
  const opt = pick(OPT_OUT);
  const zw = pick(ZW);
  const templates = [
    `Olá! Aqui é da *${storeName}*. No momento estamos *fechados* — voltamos ${nextOpen}.\n\nEnquanto isso, dá pra ver o cardápio:\n${link}\n\n${opt}`,
    `Oi! A *${storeName}* está *fechada* agora, voltamos ${nextOpen}.\n\nJá deixe seu pedido separado no cardápio:\n${link}\n\n${opt}`,
    `Olá 👋 Estamos *fora do horário* na *${storeName}*, retornamos ${nextOpen}.\n\nCardápio para adiantar:\n${link}\n\n${opt}`,
  ];
  return pick(templates) + zw;
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
      // Instância da plataforma (ItaSuper) — sincroniza status em platform_whatsapp_config.
      if (/connection/i.test(event)) {
        const state: string = data?.state || data?.status || "";
        const statusReason: number = Number(data?.statusReason || data?.reason || 0);
        const phone: string | undefined = data?.wuid?.split("@")?.[0] || data?.number || data?.owner;
        const { data: pcfg } = await admin
          .from("platform_whatsapp_config")
          .select("id, status")
          .eq("instance_name", instance)
          .maybeSingle();
        if (pcfg) {
          let newStatus: string | null = null;
          if (state === "open" || state === "connected") newStatus = "connected";
          else if ((state === "close" || state === "disconnected") && statusReason === 401) newStatus = "disconnected";
          else if (pcfg.status !== "connected") newStatus = "connecting";
          if (newStatus) {
            const patch: any = {
              status: newStatus,
              phone_number: phone ?? undefined,
              updated_at: new Date().toISOString(),
            };
            if (newStatus === "connected" && pcfg.status !== "connected") {
              patch.connected_at = new Date().toISOString();
            }
            await admin.from("platform_whatsapp_config").update(patch).eq("id", pcfg.id);
          }
          return json({ ok: true, platform: true });
        }
      }
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

        // Log inbound SEMPRE (antes de qualquer skip) — usado para first-contact.
        const { error: inboundLogError } = await admin.from("whatsapp_inbound_log").insert({
          store_id: cfg.store_id, phone: number,
        });
        if (inboundLogError) console.warn("[evolution-webhook] inbound log skipped", inboundLogError.message);

        // P2 — opt-out: cliente digita PARAR -> registra blacklist e não responde
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

        // P2 — silêncio 24h: se já mandamos saudação nas últimas 24h, some.
        //  Bot é placa de "entre aqui" — não é atendente.
        const silenceSince = new Date(Date.now() - SILENCE_AFTER_LINK_MS).toISOString();
        const { data: recentGreet } = await admin
          .from("whatsapp_send_log")
          .select("id").eq("store_id", cfg.store_id).eq("phone", number).eq("kind", "auto_reply")
          .neq("message_hash", "greet_pending")
          .gte("sent_at", silenceSince).limit(1).maybeSingle();
        if (recentGreet) return json({ ok: true, skipped: "silence_24h" });

        // P2 — 1º contato: agora respondemos imediatamente na 1ª mensagem.
        //  Camadas anti-ban restantes: dedupe 24h, opt-out, limite diário,
        //  delay 2-4s, rotação de templates + zero-width e slug alias rotativo.

        // Janela de operação baseada nos horários do lojista (fuso SP).
        // Se não houver horários cadastrados, cai no fallback 08h-22h.
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

        // P2 — UMA mensagem só (saudação + link) ou aviso de fechado com link.
        const { data: store } = await admin
          .from("stores").select("slug, slug_aliases, name").eq("id", cfg.store_id).maybeSingle();
        const storeName = store?.name || "nossa loja";
        // Anti-spam: sorteia entre slug principal e aliases para variar o link.
        const slugPool: string[] = [store?.slug, ...((store as any)?.slug_aliases || [])]
          .filter((s: any) => typeof s === "string" && s.length > 0);
        const pickedSlug = slugPool.length > 0
          ? slugPool[Math.floor(Math.random() * slugPool.length)]
          : "";
        const link = pickedSlug ? `https://itasuper.com.br/${pickedSlug}` : "";
        if (!link) return json({ ok: true, skipped: "no_link_configured" });
        const oneShotMessage = storeClosedInfo
          ? buildClosedOneShot(storeName, link, storeClosedInfo.nextOpenLabel)
          : buildOneShot(storeName, link);

        const sendMsg = async (message: string) => {
          // Functions must call the current Cloud functions host. EXTERNAL_SUPABASE_URL
          // is only the production data backend; using it here can route webhooks to
          // stale external functions and make incoming WhatsApp messages disappear.
          const functionBaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
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

        // Pré-registra IMEDIATAMENTE (greet_pending) para bloquear rajada
        // via unique index (store_id, phone, kind, sent_bucket_min) da Fase 1.
        const { error: pendingLogError } = await admin.from("whatsapp_send_log").insert({
          store_id: cfg.store_id, phone: number, message_hash: "greet_pending",
          kind: "auto_reply", sent_at: new Date().toISOString(),
        });
        if (pendingLogError) console.warn("[evolution-webhook] pending log skipped", pendingLogError.message);

        // Um envio só, com pequeno delay humano (2-4s).
        await sleep(2_000 + Math.floor(Math.random() * 2_000));
        await sendMsg(oneShotMessage);
        return json({ ok: true, sent: storeClosedInfo ? "closed_oneshot" : "oneshot" });
      }
    }

    return json({ ok: true });
  } catch (e) {
    console.error("evolution-webhook error:", e);
    return json({ ok: false }, 200);
  }
});