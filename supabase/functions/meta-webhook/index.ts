// meta-webhook
// Webhook de recebimento da API OFICIAL do WhatsApp (Meta Cloud API).
// Espelha o evolution-webhook no transporte Meta, para lojas com
// whatsapp_mode='official':
//  - grava TODAS as mensagens recebidas em whatsapp_inbound_log (a aba
//    Conversas lê dessa tabela — ela é neutra de transporte), ANTES de
//    qualquer skip, igual ao modo observação da Evolution;
//  - despacha pro bot guiado (whatsapp-bot-handler) quando a loja tem
//    whatsapp_bot_config.enabled — handled=false cai pra saudação;
//  - saudação com o link do cardápio portada do evolution-webhook v75
//    (texto aberto/fechado pelos horários, silêncio 24h, opt-out "PARAR"),
//    enviada via official-whatsapp-send em texto livre (o cliente sempre
//    inicia a conversa → janela de 24h aberta).
//
// FAIL-CLOSED: sem META_WEBHOOK_VERIFY_TOKEN, o GET de verificação é
// recusado; sem META_APP_SECRET, nenhum POST é processado (a assinatura
// X-Hub-Signature-256 é obrigatória).
//
// Limitação conhecida (B4): se uma sessão do bot ficar mais de 24h sem
// interação no meio de um pedido, retomar a conversa por iniciativa da loja
// exigiria um template de utilidade aprovado — o bot NÃO retoma
// proativamente; a conversa recomeça quando o cliente chamar de novo.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage, x-hub-signature-256"
};
const json = (b, s = 200)=>new Response(JSON.stringify(b), {
    status: s,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
const sleep = (ms)=>new Promise((resolve)=>setTimeout(resolve, ms));
const normalize = (text)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const isOptOut = (text)=>/(^|\s)(parar|stop|cancelar|sair|remover|nao receber)(\s|$|!|\.|,)/i.test(normalize(text));
// P2 — "placa de entre aqui": bot fala 1x por número / 16h e some.
const SILENCE_AFTER_LINK_MS = 16 * 60 * 60_000; // 16h
// Pega hora atual no fuso de São Paulo (UTC-3)
const spHour = ()=>{
  const now = new Date();
  return (now.getUTCHours() - 3 + 24) % 24;
};
const greetingPrefix = (h)=>h >= 6 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
// Fase 3 — rotação de templates + micro-variação invisível para evitar
// detecção de "mesma mensagem" pela Meta. Cada envio combina um template
// aleatório com pequenas variações de emoji/pontuação e um caractere
// zero-width no fim (invisível), gerando hash único a cada envio.
const pick = (arr)=>arr[Math.floor(Math.random() * arr.length)];
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
const buildOneShot = (storeName, link)=>{
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
const buildClosedOneShot = (storeName, link, nextOpen)=>{
  const opt = pick(OPT_OUT);
  const zw = pick(ZW);
  const templates = [
    `Olá! Aqui é da *${storeName}*. No momento estamos *fechados* — voltamos ${nextOpen}.\n\nEnquanto isso, dá pra ver o cardápio:\n${link}\n\n${opt}`,
    `Oi! A *${storeName}* está *fechada* agora, voltamos ${nextOpen}.\n\nJá deixe seu pedido separado no cardápio:\n${link}\n\n${opt}`,
    `Olá 👋 Estamos *fora do horário* na *${storeName}*, retornamos ${nextOpen}.\n\nCardápio para adiantar:\n${link}\n\n${opt}`
  ];
  return pick(templates) + zw;
};
// Assinatura do webhook Meta: HMAC-SHA256 do corpo cru com o app secret.
const hmacSha256Hex = async (secret, raw)=>{
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(sig)).map((b)=>b.toString(16).padStart(2, "0")).join("");
};
const timingSafeEqual = (a, b)=>{
  if (a.length !== b.length) return false;
  let diff = 0;
  for(let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
// Baixa mídia recebida via Graph API (B3) — usado para comprovantes Pix
// Direto do bot. Falha suave: sem token ou com erro, retorna null e a
// mensagem segue sem imagem.
const fetchMediaBase64 = async (mediaId)=>{
  const token = Deno.env.get("META_WHATSAPP_TOKEN") || "";
  if (!token || !mediaId) return null;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!r.ok) return null;
    const meta = await r.json().catch(()=>null);
    const url = meta?.url;
    const mime = String(meta?.mime_type || "image/jpeg");
    if (!url) return null;
    const r2 = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!r2.ok) return null;
    const buf = new Uint8Array(await r2.arrayBuffer());
    let bin = "";
    const CHUNK = 0x8000;
    for(let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
    return {
      base64: btoa(bin),
      mime
    };
  } catch (e) {
    console.warn("[meta-webhook] fetchMediaBase64 error", e?.message);
    return null;
  }
};
// Mesma janela anti-backlog do evolution-webhook (5 min).
const isRecentTs = (tsSeconds)=>{
  const ts = Number(tsSeconds);
  if (!Number.isFinite(ts) || ts <= 0) return true;
  return Date.now() - ts * 1000 <= 5 * 60_000;
};
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  try {
    // GET — verificação do webhook na Meta (hub.challenge).
    // FAIL-CLOSED: sem o segredo configurado, recusa sempre.
    if (req.method === "GET") {
      const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "";
      const url = new URL(req.url);
      const okGet = !!verifyToken && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === verifyToken;
      const challenge = url.searchParams.get("hub.challenge");
      if (!okGet || !challenge) return new Response("Forbidden", {
        status: 403
      });
      return new Response(challenge, {
        status: 200,
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }
    if (req.method !== "POST") return json({
      ok: true
    });
    // POST — assinatura obrigatória. FAIL-CLOSED: sem META_APP_SECRET,
    // nenhum POST é processado.
    const appSecret = Deno.env.get("META_APP_SECRET") || "";
    if (!appSecret) {
      console.error("[meta-webhook] META_APP_SECRET não configurado — rejeitando");
      return json({
        error: "Webhook not configured"
      }, 500);
    }
    const raw = await req.text();
    const signature = req.headers.get("x-hub-signature-256") || "";
    const expectedSig = "sha256=" + await hmacSha256Hex(appSecret, raw);
    if (!timingSafeEqual(signature, expectedSig)) return json({
      error: "Forbidden"
    }, 403);
    const body = JSON.parse(raw || "{}");
    if (body?.object !== "whatsapp_business_account") return json({
      ok: true
    });
    const admin = createClient(Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"), Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    // Functions são chamadas pelo host de functions atual (SUPABASE_URL) —
    // mesma observação do evolution-webhook v75.
    const functionsBase = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL");
    const internalToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    const callFunction = async (slug, payload)=>{
      const r = await fetch(`${functionsBase}/functions/v1/${slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "x-internal-token": internalToken
        },
        body: JSON.stringify(payload)
      });
      const out = await r.json().catch(()=>({}));
      return {
        r,
        out
      };
    };
    // Saudação (A3) — portada do evolution-webhook v75, trocando só o canal
    // de envio (official-whatsapp-send, texto livre). Retorna o desfecho.
    const sendGreeting = async (storeId, cfg, number, text)=>{
      // Se auto-reply está desligado, para aqui (o bot já teve a chance).
      if (!cfg.auto_reply_enabled) return "auto_reply_off";
      // P2 — opt-out: cliente digita PARAR -> registra blacklist e não responde
      if (isOptOut(text)) {
        await admin.from("whatsapp_send_log").insert({
          store_id: storeId,
          phone: number,
          message_hash: "optout",
          kind: "opt_out",
          sent_at: new Date().toISOString()
        });
        return "opt_out_registered";
      }
      // Verifica blacklist (opt-out anterior)
      const { data: blocked } = await admin.from("whatsapp_send_log").select("id").eq("store_id", storeId).eq("phone", number).eq("kind", "opt_out").limit(1).maybeSingle();
      if (blocked) return "blacklisted";
      // P2 — silêncio 24h: se já mandamos (ou estamos mandando) saudação
      // nas últimas 24h, some. INCLUI greet_pending para bloquear rajada.
      const silenceSince = new Date(Date.now() - SILENCE_AFTER_LINK_MS).toISOString();
      const { data: recentGreet } = await admin.from("whatsapp_send_log").select("id").eq("store_id", storeId).eq("phone", number).eq("kind", "auto_reply").gte("sent_at", silenceSince).limit(1).maybeSingle();
      if (recentGreet) return "silence_24h";
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
        const { data: hours } = await admin.from("opening_hours").select("day_of_week, open_time, close_time, is_closed_all_day").eq("store_id", storeId);
        const dayNames = [
          "domingo",
          "segunda",
          "terça",
          "quarta",
          "quinta",
          "sexta",
          "sábado"
        ];
        const findNextOpen = (list)=>{
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
          const isOpenAt = (day, minutes)=>{
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
      const { data: store } = await admin.from("stores").select("slug, slug_aliases, name").eq("id", storeId).maybeSingle();
      const storeName = store?.name || "nossa loja";
      // Anti-spam: sorteia entre slug principal e aliases para variar o link.
      const slugPool = [
        store?.slug,
        ...store?.slug_aliases || []
      ].filter((s)=>typeof s === "string" && s.length > 0);
      const pickedSlug = slugPool.length > 0 ? slugPool[Math.floor(Math.random() * slugPool.length)] : "";
      const link = pickedSlug ? `https://itasuper.com.br/${pickedSlug}` : "";
      if (!link) return "no_link_configured";
      const oneShotMessage = storeClosedInfo ? buildClosedOneShot(storeName, link, storeClosedInfo.nextOpenLabel) : buildOneShot(storeName, link);
      const sendMsg = async (message)=>{
        const { r, out } = await callFunction("official-whatsapp-send", {
          store_id: storeId,
          phone: number,
          text: message,
          kind: "auto_reply"
        });
        if (!r.ok || out?.ok === false || out?.error) {
          console.error("[meta-webhook] auto-reply send failed", {
            store_id: storeId,
            phone: number,
            status: r.status,
            out
          });
          throw new Error(`auto_reply_send_failed_${r.status}`);
        }
      };
      // Pré-registra IMEDIATAMENTE (greet_pending) para bloquear rajada
      // via unique index (store_id, phone, kind, sent_bucket_min) da Fase 1.
      // Se o insert falhar (conflito unique), outra invocação já está enviando
      // — ABORTA para não gerar 2 respostas.
      const { error: pendingLogError } = await admin.from("whatsapp_send_log").insert({
        store_id: storeId,
        phone: number,
        message_hash: "greet_pending",
        kind: "auto_reply",
        sent_at: new Date().toISOString()
      });
      if (pendingLogError) {
        console.warn("[meta-webhook] pending log conflict — skipping duplicate send", pendingLogError.message);
        return "concurrent_send_in_progress";
      }
      // Um envio só, com pequeno delay humano (2-4s).
      await sleep(2_000 + Math.floor(Math.random() * 2_000));
      await sendMsg(oneShotMessage);
      return storeClosedInfo ? "closed_oneshot" : "oneshot";
    };
    // Uma mensagem recebida (field "messages" da Cloud API).
    const handleMessage = async (storeId, cfg, pushName, msg)=>{
      const number = String(msg?.from || "").replace(/\D/g, "");
      if (!number) return;
      if (!isRecentTs(msg?.timestamp)) return; // backlog/retry antigo: nem loga (paridade "old_message" do v75)
      const type = String(msg?.type || "");
      const text = String(msg?.text?.body || msg?.image?.caption || msg?.video?.caption || "");
      // Registro de recebidas: guarda número + mensagem ANTES de qualquer
      // skip (inclusive com auto-reply desligado) — a loja pode estar em
      // modo observação (só recebe, não dispara).
      const { error: inboundLogError } = await admin.from("whatsapp_inbound_log").insert({
        store_id: storeId,
        phone: number,
        message: text || "[mensagem sem texto]",
        push_name: pushName || ""
      });
      if (inboundLogError) console.warn("[meta-webhook] inbound log skipped", inboundLogError.message);
      // Modo observação (send_disabled): registra e NÃO dispara nada —
      // nem bot, nem saudação (paridade com o funil Evolution).
      if (cfg.send_disabled) return;
      const { data: botCfg } = await admin.from("whatsapp_bot_config").select("enabled").eq("store_id", storeId).maybeSingle();
      const isImage = type === "image";
      const hasText = text.trim().length > 0;
      // Conteúdo humano (paridade com hasHumanContent do v75): texto/legenda,
      // áudio, documento e sticker contam; imagem SEM legenda só conta quando
      // o bot está aguardando comprovante Pix.
      let humanish = hasText || type === "audio" || type === "document" || type === "sticker";
      let awaitingProof = false;
      if (isImage && botCfg?.enabled) {
        const { data: sessPeek } = await admin.from("whatsapp_bot_sessions").select("current_step").eq("store_id", storeId).eq("phone", number).maybeSingle();
        awaitingProof = sessPeek?.current_step === "awaiting_pix_proof";
        if (!hasText && awaitingProof) humanish = true;
      }
      if (!humanish) return;
      // ── Bot de menu guiado (B1) ─────────────────────────────────────
      // Roda ANTES do auto-reply e independe de auto_reply_enabled.
      if (botCfg?.enabled) {
        try {
          let image_base64;
          let image_mime;
          if (isImage && awaitingProof) {
            const img = await fetchMediaBase64(msg?.image?.id);
            if (img) {
              image_base64 = img.base64;
              image_mime = img.mime;
            }
          }
          const { out: botOut } = await callFunction("whatsapp-bot-handler", {
            store_id: storeId,
            phone: number,
            text,
            image_base64,
            image_mime
          });
          console.log("[meta-webhook] bot dispatch", {
            store: storeId,
            phone: number,
            out: botOut
          });
          if (botOut?.handled) return;
        // handled=false → cai pra fluxo auto-reply normal (ex.: mensagem sem gatilho)
        } catch (e) {
          console.error("[meta-webhook] bot dispatch failed", e?.message);
        }
      }
      await sendGreeting(storeId, cfg, number, text);
    };
    // Coexistência: o que o LOJISTA digita no app WhatsApp Business chega
    // pelo field "smb_message_echoes" (não pelo "messages") — registramos
    // com direction='out' pra conversa ficar completa na aba Conversas,
    // igual ao fromMe da Evolution. Best-effort: formato de echo sem
    // destinatário/texto é simplesmente ignorado.
    const handleEchoes = async (storeId, value)=>{
      for (const echo of value?.message_echoes || []){
        try {
          const to = String(echo?.to || "").replace(/\D/g, "");
          if (!to) continue;
          if (!isRecentTs(echo?.timestamp)) continue;
          const text = String(echo?.text?.body || echo?.image?.caption || echo?.video?.caption || "");
          await admin.from("whatsapp_inbound_log").insert({
            store_id: storeId,
            phone: to,
            message: text || "[mensagem sem texto]",
            push_name: "",
            direction: "out"
          });
        } catch (e) {
          console.warn("[meta-webhook] echo log skipped", e?.message);
        }
      }
    };
    for (const entry of body?.entry || []){
      for (const change of entry?.changes || []){
        const value = change?.value || {};
        const phoneNumberId = value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;
        // Lookup da loja pelo número da Meta — exige config oficial ATIVA.
        const { data: ocfg } = await admin.from("store_whatsapp_official_config").select("store_id, status").eq("phone_number_id", String(phoneNumberId)).maybeSingle();
        if (!ocfg?.store_id || ocfg.status !== "connected") {
          console.warn("[meta-webhook] phone_number_id sem config oficial ativa", {
            phoneNumberId
          });
          continue;
        }
        const storeId = ocfg.store_id;
        const { data: cfg } = await admin.from("store_whatsapp_config").select("store_id, auto_reply_enabled, send_disabled").eq("store_id", storeId).maybeSingle();
        if (!cfg) continue;
        if (change.field === "messages") {
          const names: Record<string, string> = {};
          for (const c of value?.contacts || []) names[String(c?.wa_id || "")] = String(c?.profile?.name || "");
          for (const msg of value?.messages || []){
            try {
              await handleMessage(storeId, cfg, names[String(msg?.from || "")] || "", msg);
            } catch (e) {
              console.error("[meta-webhook] message failed", e?.message);
            }
          }
        } else if (change.field === "smb_message_echoes") {
          await handleEchoes(storeId, value);
        }
      // fields de status (entregue/lido) e demais: ignorados de propósito.
      }
    }
    return json({
      ok: true
    });
  } catch (e) {
    console.error("meta-webhook error:", e);
    return json({
      ok: false
    }, 200);
  }
});
