import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
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
const BodySchema = z.object({
  store_id: z.string().uuid(),
  phone: z.string().min(10).max(20),
  message: z.string().min(1).max(4000),
  kind: z.enum([
    "manual",
    "auto_reply",
    "order_status",
    "bot"
  ]).optional(),
  force: z.boolean().optional()
});
const sleep = (ms: number)=>new Promise((r)=>setTimeout(r, ms));
const hashMsg = async (s: string)=>{
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b)=>b.toString(16).padStart(2, "0")).join("").slice(0, 16);
};
const sendPresence = async (baseUrl: string, instance: string, apiKey: string, number: string)=>{
  await fetch(`${baseUrl.replace(/\/$/, "")}/chat/sendPresence/${instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey
    },
    body: JSON.stringify({
      number,
      presence: "composing",
      delay: 400
    })
  }).catch(()=>undefined);
};
// A fábrica concreta preserva os padrões genéricos do cliente (schema public).
const createAdminClient = (url: string, key: string) => createClient(url, key);
const isAuthorizedForStore = async (admin: ReturnType<typeof createAdminClient>, req: Request, storeId: string)=>{
  const authHeader = req.headers.get("Authorization") || "";
  const externalServiceRole = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (externalServiceRole && authHeader === `Bearer ${externalServiceRole}`) return true;
  const internalToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
  if (internalToken && req.headers.get("x-internal-token") === internalToken) return true;
  if (!authHeader.startsWith("Bearer ")) return false;
  // Autenticação SEMPRE contra o Supabase EXTERNO (onde os lojistas fazem login).
  const extUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
  const extAnon = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (!extUrl || !extAnon) return false;
  let userId = null;
  try {
    const client = createClient(extUrl, extAnon, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const { data, error: err } = await client.auth.getUser(authHeader.replace("Bearer ", ""));
    if (err || !data?.user?.id) return false;
    userId = data.user.id;
  } catch  {
    return false;
  }
  const { data: store } = await admin.from("stores").select("owner_id").eq("id", storeId).maybeSingle();
  if (store?.owner_id === userId) return true;
  const { data: linkedDriver } = await admin.from("store_drivers").select("store_id").eq("store_id", storeId).eq("driver_user_id", userId).limit(1).maybeSingle();
  if (linkedDriver) return true;
  const { data: isAdmin } = await admin.rpc("is_platform_admin", {
    _user_id: userId
  });
  return !!isAdmin;
};
// Anti-spam params
const DEDUPE_WINDOW_SEC = 3600; // mesma msg p/ mesmo número
const AUTO_REPLY_DEDUPE_WINDOW_SEC = 57600; // P0: saudação 1x por número / 16h
const PER_STORE_MIN_GAP_MS = 12_000; // gap mínimo entre envios da loja
const PER_PHONE_MIN_GAP_MS = 3_000; // gap mínimo entre envios p/ mesmo número (anti-burst de status)
const EVOLUTION_MAX_RETRIES = 2; // tentativas extras em falha transitória
const EVOLUTION_RETRY_DELAY_MS = 2_000; // base de espera entre retries
// P1.3 — limites diários por fase do chip (dias após connected_at)
// Escada atualizada em 2026-10-24 (decisão do dono do produto): 60/120/200/300/300.
// Semana 1 fica em 60, ABAIXO do precedente de ban: chip novo disparando
// 80/dia já foi banido (ver comentário no warm-up abaixo) — por isso o
// aquecimento continua gradual e o limite sobe sozinho com o tempo de uso.
// O lojista pode AUMENTAR o teto (coluna daily_limit_override, máx. 500),
// mas nunca diminuí-lo abaixo do teto da idade: o efetivo é o maior entre
// os dois, travado em 500 (ver cálculo em "2) Limite diário" abaixo).
const DAILY_LIMIT_OVERRIDE_MAX = 500;
const dailyLimitForAge = (days: number)=>{
  if (days < 7) return 60; // semana 1
  if (days < 14) return 120; // semana 2
  if (days < 30) return 200; // semana 3-4
  if (days < 60) return 300; // mês 2
  return 300; // mês 3+
};
// Fila de envios (2026-10-22): cap/falha transitoria enfileira em vez de perder.
const QUEUE_TTL_MS: Record<string, number> = { auto_reply: 2 * 3600_000, order_status: 6 * 3600_000, manual: 6 * 3600_000 };
const QUEUE_PRIORITY: Record<string, number> = { order_status: 1, manual: 2, auto_reply: 3 };
async function enqueueForLater(admin: any, storeId: string, phone: string, message: string, kind: string, reason: string): Promise<boolean> {
  try {
    const { error } = await admin.from("whatsapp_send_queue").insert({
      store_id: storeId, phone, message, kind,
      priority: QUEUE_PRIORITY[kind] ?? 2,
      expires_at: new Date(Date.now() + (QUEUE_TTL_MS[kind] ?? 6 * 3600_000)).toISOString(),
      last_error: reason,
    });
    return !error;
  } catch { return false; }
}
// P1.2 — delay log-normal (mais natural que range fixo)
const logNormalDelay = ()=>{
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  // média ~ 40s, cauda longa até ~3min, mínimo 15s
  const ms = Math.exp(3.6 + z * 0.6) * 1000;
  return Math.min(180_000, Math.max(15_000, Math.floor(ms)));
};
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  try {
    console.log("[evolution-send-message] 📥 incoming request", {
      method: req.method
    });
    const rawBody = await req.json().catch((e)=>{
      console.error("[evolution-send-message] bad json", e);
      return null;
    });
    console.log("[evolution-send-message] body keys:", rawBody && Object.keys(rawBody));
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      console.error("[evolution-send-message] ❌ validation failed", parsed.error.flatten().fieldErrors);
      return json({
        error: parsed.error.flatten().fieldErrors
      }, 400);
    }
    const { store_id, phone, message, kind = "manual" } = parsed.data;
    // Número normalizado (55 + DDD + número) — é o formato gravado no
    // whatsapp_send_log e o que o opt-out usa.
    const digits = phone.replace(/\D/g, "");
    const number = digits.length <= 11 ? "55" + digits : digits;
    // Cópia de teste (`evolution-send-message-teste`, Fase 6C): allowlist —
    // só a loja de teste e só o número do Renner. Mesmo padrão do
    // whatsapp-bot-handler-teste. A função original fica intacta.
    const TEST_STORE_ID = "8197bdd8-f041-410d-acc0-af9ecb448f55";
    const TEST_PHONE_DIGITS = "5514991624997";
    if (new URL(req.url).pathname.endsWith("-teste") && (store_id !== TEST_STORE_ID || number !== TEST_PHONE_DIGITS)) {
      return json({
        error: "test_function_allowlist"
      }, 403);
    }
    const internalToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    const requestedForce = parsed.data.force === true;
    const force = requestedForce && !!internalToken && req.headers.get("x-internal-token") === internalToken;
    const fromQueueWorker = !!internalToken && req.headers.get("x-queue-worker") === "1" && req.headers.get("x-internal-token") === internalToken;
    const maskedPhone = phone ? `${phone.slice(0, 4)}****${phone.slice(-2)}` : "";
    console.log("[evolution-send-message] ▶ store_id=", store_id, "phone=", maskedPhone, "kind=", kind, "msgLen=", message.length);
    const backendUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const backendKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!backendUrl || !backendKey) return json({ error: "Backend não configurado" }, 500);
    const admin = createAdminClient(backendUrl, backendKey);
    if (!await isAuthorizedForStore(admin, req, store_id)) {
      console.error("[evolution-send-message] ⛔ Forbidden — auth check failed for store", store_id);
      return json({
        error: "Forbidden"
      }, 403);
    }
    const { data: cfg } = await admin.from("store_whatsapp_config").select("evolution_instance_name, status, connected_at, established_number, daily_limit_override, send_disabled, whatsapp_mode").eq("store_id", store_id).maybeSingle();
    console.log("[evolution-send-message] cfg:", cfg);
    // Fase 6C (P2-3): opt-out absoluto — quem digitou PARAR nunca mais
    // recebe envio por aqui, de nenhum kind e nem com `force` (é o PARAR
    // do cliente). Mesmo padrão de consulta dos webhooks
    // (whatsapp_send_log por store_id + phone + kind='opt_out'). O
    // bloqueio é registrado no log (upsert com ignoreDuplicates: um
    // bloqueio por minuto basta — o índice único é por bucket de minuto).
    const { data: optedOut } = await admin.from("whatsapp_send_log").select("id").eq("store_id", store_id).eq("phone", number).eq("kind", "opt_out").limit(1).maybeSingle();
    if (optedOut) {
      console.log("[evolution-send-message] ⛔ opt-out — envio bloqueado", {
        store_id,
        phone: maskedPhone,
        kind
      });
      await admin.from("whatsapp_send_log").upsert({
        store_id,
        phone: number,
        message_hash: "optout_blocked",
        kind: "opt_out",
        sent_at: new Date().toISOString()
      }, {
        onConflict: "store_id,phone,kind,sent_bucket_min",
        ignoreDuplicates: true
      });
      return json({
        success: false,
        skipped: "opt_out"
      });
    }
    // Migração API oficial: loja com whatsapp_mode='official' não envia NADA
    // pela Evolution (a instância é desligada na virada). Retorno cedo, antes
    // de qualquer envio — os chamadores roteiam pro canal oficial.
    if ((cfg as any)?.whatsapp_mode === "official") {
      return json({
        success: false,
        skipped: "store_on_official_mode",
        error: "store_on_official_mode"
      });
    }
    if (!cfg?.evolution_instance_name) {
      console.error("[evolution-send-message] ❌ sem instance_name");
      return json({
        error: "Evolution não configurado"
      }, 400);
    }
    // Trava por loja (2026-10-22): loja em modo observacao nao dispara NADA
    // (saudacao, avisos de pedido, manual, fila) — tudo passa por aqui.
    if ((cfg as any).send_disabled) {
      return json({ success: false, muted: true, error: "Envios desativados para esta loja" });
    }
    if (cfg.status !== "connected") {
      console.error("[evolution-send-message] ❌ status !=connected:", cfg.status);
      return json({
        error: "WhatsApp não conectado",
        status: cfg.status
      }, 400);
    }
    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!baseUrl || !apiKey) return json({
      error: "Servidor Evolution não configurado"
    }, 500);
    // === ANTI-SPAM ===
    const msgHash = await hashMsg(message);
    const nowIso = new Date().toISOString();
    // 1) Dedupe: P0 — saudação vira 1x por número / 16h (bot fala pouco, chip dura muito).
    const dedupeWindowSec = kind === "auto_reply" ? AUTO_REPLY_DEDUPE_WINDOW_SEC : DEDUPE_WINDOW_SEC;
    const dedupeSince = new Date(Date.now() - dedupeWindowSec * 1000).toISOString();
    const { data: dup } = await admin.from("whatsapp_send_log").select("id").eq("store_id", store_id).eq("phone", number).eq("message_hash", msgHash).gte("sent_at", dedupeSince).limit(1).maybeSingle();
    if (dup && !force) return json({
      success: true,
      skipped: "duplicate"
    });
    // P0 — dedupe adicional por KIND para auto_reply: mesmo que o texto varie
    // (bom dia / boa tarde / fora do horário), só 1 saudação por número / 16h.
    if (kind === "auto_reply" && !force) {
      const { data: dupKind } = await admin.from("whatsapp_send_log").select("id").eq("store_id", store_id).eq("phone", number).eq("kind", "auto_reply").neq("message_hash", "greet_pending").gte("sent_at", dedupeSince).limit(1).maybeSingle();
      if (dupKind) return json({
        success: true,
        skipped: "auto_reply_dedupe_16h"
      });
    }
    // 2) Limite diário por fase do chip (P1.3)
    const ageDays = cfg.connected_at ? (Date.now() - new Date(cfg.connected_at).getTime()) / 86_400_000 : 999;
    // P0: warm-up honesto — auto_reply respeita o mesmo limite da fase.
    // (antes: Math.max(80,…) anulava o warm-up e chip novo já disparava 80/dia → banimento)
    const effAgeDays = (cfg as any).established_number ? Math.max(ageDays, 20) : ageDays;
    const ageLimit = dailyLimitForAge(effAgeDays);
    // Override do lojista (2026-10-24): só AUMENTA o teto, nunca diminui —
    // o efetivo é o maior entre o teto da idade e o override, travado em 500.
    // Override null/0/inválido = vale só o teto da idade.
    const overrideRaw = (cfg as any).daily_limit_override;
    const override = typeof overrideRaw === "number" && Number.isFinite(overrideRaw) && overrideRaw > 0 ? overrideRaw : null;
    const dailyLimit = override !== null ? Math.min(Math.max(ageLimit, override), DAILY_LIMIT_OVERRIDE_MAX) : ageLimit;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await admin.from("whatsapp_send_log").select("id", {
      count: "exact",
      head: true
    }).eq("store_id", store_id).neq("message_hash", "greet_pending").gte("sent_at", dayStart.toISOString());
    // Bot guiado (kind="bot", desde a reativação em 2026-10-24): passa
    // pelo teto diário como qualquer envio (sem `force`), mas NÃO vai
    // pra fila quando bate o teto — uma resposta de bot entregue horas
    // depois estaria obsoleta (a sessão do cliente já andou) e o worker
    // a reenviaria fora de contexto. Falha rápido com 429 e o webhook
    // registra; o cliente pode chamar de novo no dia seguinte.
    if (!force && (sentToday ?? 0) >= dailyLimit) {
      if (kind !== "bot" && !fromQueueWorker && await enqueueForLater(admin, store_id, number, message, kind, "daily_cap")) {
        return json({ success: true, queued: true, reason: "daily_cap" });
      }
      return json({
        error: `Limite diário de envios atingido (${dailyLimit}). Aguarde amanhã.`
      }, 429);
    }
    // P0 — coffee break também para auto_reply: a cada 10 msgs no dia, pausa 5-15min.
    if (kind === "manual" && !force && (sentToday ?? 0) > 0 && (sentToday ?? 0) % 10 === 0) {
      await sleep(300_000 + Math.floor(Math.random() * 600_000));
    }
    // 3) Throttle: auto-reply e order_status devem sair rapidamente (UX crítico).
    //    Apenas envios manuais aplicam o intervalo anti-spam log-normal completo.
    if (kind === "manual") {
      const { data: last } = await admin.from("whatsapp_send_log").select("sent_at").eq("store_id", store_id).neq("message_hash", "greet_pending").order("sent_at", {
        ascending: false
      }).limit(1).maybeSingle();
      if (last?.sent_at) {
        const gap = Date.now() - new Date(last.sent_at).getTime();
        const need = PER_STORE_MIN_GAP_MS + logNormalDelay();
        if (gap < need) await sleep(need - gap);
      } else {
        await sleep(2500 + Math.floor(Math.random() * 3500));
      }
    } else if (kind === "order_status") {
      // pequeno gap só para evitar burst (máx ~3s)
      await sleep(400 + Math.floor(Math.random() * 2600));
    }
    // 3.b) Rate limit por NÚMERO: garante gap mínimo entre msgs para o mesmo destinatário
    //      (evita rajada quando vários pedidos do mesmo cliente mudam de status quase juntos)
    {
      const { data: lastToPhone } = await admin.from("whatsapp_send_log").select("sent_at").eq("store_id", store_id).eq("phone", number).neq("message_hash", "greet_pending").order("sent_at", {
        ascending: false
      }).limit(1).maybeSingle();
      if (lastToPhone?.sent_at) {
        const gap = Date.now() - new Date(lastToPhone.sent_at).getTime();
        if (gap < PER_PHONE_MIN_GAP_MS) await sleep(PER_PHONE_MIN_GAP_MS - gap);
      }
    }
    if (kind === "auto_reply") {
      // P2.4 — presença "digitando" não bloqueia o envio da saudação.
      sendPresence(baseUrl, cfg.evolution_instance_name, apiKey, number);
    }
    // Envio com retry em falhas transitórias (5xx/network) — não retenta 4xx (erro de payload/instância)
    let r = null;
    let data = {};
    let attempt = 0;
    let lastErr = null;
    while(attempt <= EVOLUTION_MAX_RETRIES){
      try {
        r = await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${cfg.evolution_instance_name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey
          },
          body: JSON.stringify({
            number,
            text: message
          })
        });
        data = await r.json().catch(()=>({}));
        if (r.ok) break;
        // 4xx: não adianta retentar
        if (r.status >= 400 && r.status < 500) {
          return json({
            error: "Falha Evolution",
            details: data
          }, 502);
        }
      } catch (err) {
        lastErr = err;
      }
      attempt++;
      if (attempt > EVOLUTION_MAX_RETRIES) break;
      await sleep(EVOLUTION_RETRY_DELAY_MS * attempt + Math.floor(Math.random() * 1000));
    }
    if (!r || !r.ok) {
      console.error("[evolution-send-message] ❌ envio falhou após retries", {
        lastErr,
        status: r?.status,
        data
      });
      // (Bot: sem fila também em falha de envio — mesmo motivo do teto:
      // resposta de bot requentada horas depois chega fora de contexto.)
      if (kind !== "bot" && !fromQueueWorker && await enqueueForLater(admin, store_id, number, message, kind, "evolution_failure")) {
        return json({ success: true, queued: true, reason: "evolution_failure" });
      }
      return json({
        error: "Falha Evolution",
        details: data || String(lastErr)
      }, 502);
    }
    // 4) Registra envio (best-effort). ignoreDuplicates aproveita o unique index
    // (store_id, phone, kind, sent_bucket_min) — bucket determinístico por
    // minuto que corta a corrida de saudações duplicadas em rajada.
    await admin.from("whatsapp_send_log").upsert({
      store_id,
      phone: number,
      message_hash: msgHash,
      kind,
      sent_at: nowIso
    }, {
      onConflict: "store_id,phone,kind,sent_bucket_min",
      ignoreDuplicates: kind !== "auto_reply"
    });
    // P0 — self-heal: envio OK ⇒ chip está conectado. Destrava status preso em disconnected/connecting.
    if (cfg.status !== "connected") {
      await admin.from("store_whatsapp_config").update({
        status: "connected",
        updated_at: nowIso
      }).eq("store_id", store_id);
    }
    return json({
      success: true,
      data
    });
  } catch (e) {
    console.error("evolution-send-message error:", e);
    return json({
      error: "Internal error",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined
    }, 500);
  }
});
