import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BodySchema = z.object({
  store_id: z.string().uuid(),
  phone: z.string().min(10).max(20),
  message: z.string().min(1).max(4000),
  kind: z.enum(["manual", "auto_reply", "order_status", "bot"]).optional(),
  force: z.boolean().optional(),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hashMsg = async (s: string) => {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
};

const sendPresence = async (baseUrl: string, instance: string, apiKey: string, number: string) => {
  await fetch(`${baseUrl.replace(/\/$/, "")}/chat/sendPresence/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number, presence: "composing", delay: 400 }),
  }).catch(() => undefined);
};

const isAuthorizedForStore = async (admin: any, req: Request, storeId: string) => {
  const authHeader = req.headers.get("Authorization") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (serviceRole && authHeader === `Bearer ${serviceRole}`) return true;
  const externalServiceRole = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || "";
  if (externalServiceRole && authHeader === `Bearer ${externalServiceRole}`) return true;
  const internalToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
  if (internalToken && req.headers.get("x-internal-token") === internalToken) return true;
  if (!authHeader.startsWith("Bearer ")) return false;

  // Tenta primeiro contra o Supabase EXTERNO (onde os lojistas fazem login),
  // com fallback para o Lovable Cloud. Sem isso, os tokens externos falhavam
  // silenciosamente e o disparo de order_status era rejeitado com 403.
  const tryGetUser = async (url?: string, anon?: string) => {
    if (!url || !anon) return null;
    try {
      const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
      const { data, error: err } = await client.auth.getUser(authHeader.replace("Bearer ", ""));
      if (err) return null;
      return data?.user?.id || null;
    } catch { return null; }
  };
  let userId =
    (await tryGetUser(Deno.env.get("EXTERNAL_SUPABASE_URL"), Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY"))) ||
    (await tryGetUser(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_ANON_KEY")));
  if (!userId) return false;

  const { data: store } = await admin.from("stores").select("owner_id").eq("id", storeId).maybeSingle();
  if (store?.owner_id === userId) return true;

  const { data: linkedDriver } = await admin
    .from("store_drivers")
    .select("store_id")
    .eq("store_id", storeId)
    .eq("driver_user_id", userId)
    .limit(1)
    .maybeSingle();
  if (linkedDriver) return true;

  const { data: isAdmin } = await admin.rpc("is_platform_admin", { _user_id: userId });
  return !!isAdmin;
};

// Anti-spam params
const DEDUPE_WINDOW_SEC = 3600;        // mesma msg p/ mesmo número
const AUTO_REPLY_DEDUPE_WINDOW_SEC = 57600; // P0: saudação 1x por número / 16h
const PER_STORE_MIN_GAP_MS = 12_000;   // gap mínimo entre envios da loja
const PER_PHONE_MIN_GAP_MS = 3_000;    // gap mínimo entre envios p/ mesmo número (anti-burst de status)
const EVOLUTION_MAX_RETRIES = 2;        // tentativas extras em falha transitória
const EVOLUTION_RETRY_DELAY_MS = 2_000; // base de espera entre retries
// P1.3 — limites diários por fase do chip (dias após connected_at)
const dailyLimitForAge = (days: number) => {
  if (days < 7) return 20;     // semana 1
  if (days < 14) return 50;    // semana 2
  if (days < 30) return 100;   // semana 3-4
  if (days < 60) return 150;   // mês 2
  return 200;                  // mês 3+
};

// P1.2 — delay log-normal (mais natural que range fixo)
const logNormalDelay = () => {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  // média ~ 40s, cauda longa até ~3min, mínimo 15s
  const ms = Math.exp(3.6 + z * 0.6) * 1000;
  return Math.min(180_000, Math.max(15_000, Math.floor(ms)));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("[evolution-send-message] 📥 incoming request", { method: req.method });
    const rawBody = await req.json().catch((e) => { console.error("[evolution-send-message] bad json", e); return null; });
    console.log("[evolution-send-message] body keys:", rawBody && Object.keys(rawBody));
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      console.error("[evolution-send-message] ❌ validation failed", parsed.error.flatten().fieldErrors);
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { store_id, phone, message, kind = "manual" } = parsed.data;
    const internalToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    const requestedForce = parsed.data.force === true;
    const force = requestedForce && !!internalToken && req.headers.get("x-internal-token") === internalToken;
    const maskedPhone = phone ? `${phone.slice(0,4)}****${phone.slice(-2)}` : "";
    console.log("[evolution-send-message] ▶ store_id=", store_id, "phone=", maskedPhone, "kind=", kind, "msgLen=", message.length);

    const admin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!(await isAuthorizedForStore(admin, req, store_id))) {
      console.error("[evolution-send-message] ⛔ Forbidden — auth check failed for store", store_id);
      return json({ error: "Forbidden" }, 403);
    }

    const { data: cfg } = await admin
      .from("store_whatsapp_config")
      .select("evolution_instance_name, status, connected_at")
      .eq("store_id", store_id)
      .maybeSingle();

    console.log("[evolution-send-message] cfg:", cfg);
    if (!cfg?.evolution_instance_name) {
      console.error("[evolution-send-message] ❌ sem instance_name");
      return json({ error: "Evolution não configurado" }, 400);
    }
    if (cfg.status !== "connected") {
      console.error("[evolution-send-message] ❌ status !=connected:", cfg.status);
      return json({ error: "WhatsApp não conectado", status: cfg.status }, 400);
    }

    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!baseUrl || !apiKey) return json({ error: "Servidor Evolution não configurado" }, 500);

    let number = phone.replace(/\D/g, "");
    if (number.length <= 11) number = "55" + number;

    // === ANTI-SPAM ===
    const msgHash = await hashMsg(message);
    const nowIso = new Date().toISOString();

    // 1) Dedupe: P0 — saudação vira 1x por número / 16h (bot fala pouco, chip dura muito).
    const dedupeWindowSec = kind === "auto_reply" ? AUTO_REPLY_DEDUPE_WINDOW_SEC : DEDUPE_WINDOW_SEC;
    const dedupeSince = new Date(Date.now() - dedupeWindowSec * 1000).toISOString();
    const { data: dup } = await admin
      .from("whatsapp_send_log")
      .select("id")
      .eq("store_id", store_id).eq("phone", number).eq("message_hash", msgHash)
      .gte("sent_at", dedupeSince).limit(1).maybeSingle();
    if (dup && !force) return json({ success: true, skipped: "duplicate" });
    // P0 — dedupe adicional por KIND para auto_reply: mesmo que o texto varie
    // (bom dia / boa tarde / fora do horário), só 1 saudação por número / 16h.
    if (kind === "auto_reply" && !force) {
      const { data: dupKind } = await admin
        .from("whatsapp_send_log")
        .select("id")
        .eq("store_id", store_id).eq("phone", number).eq("kind", "auto_reply")
        .neq("message_hash", "greet_pending")
        .gte("sent_at", dedupeSince).limit(1).maybeSingle();
      if (dupKind) return json({ success: true, skipped: "auto_reply_dedupe_16h" });
    }

    // 2) Limite diário por fase do chip (P1.3)
    const ageDays = cfg.connected_at
      ? (Date.now() - new Date(cfg.connected_at).getTime()) / 86_400_000
      : 999;
    // P0: warm-up honesto — auto_reply respeita o mesmo limite da fase.
    // (antes: Math.max(80,…) anulava o warm-up e chip novo já disparava 80/dia → banimento)
    const dailyLimit = dailyLimitForAge(ageDays);
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await admin
      .from("whatsapp_send_log")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store_id)
      .neq("message_hash", "greet_pending")
      .gte("sent_at", dayStart.toISOString());
    if (!force && (sentToday ?? 0) >= dailyLimit) {
      return json({ error: `Limite diário de envios atingido (${dailyLimit}). Aguarde amanhã.` }, 429);
    }
    // P0 — coffee break também para auto_reply: a cada 10 msgs no dia, pausa 5-15min.
    if (!force && (sentToday ?? 0) > 0 && (sentToday ?? 0) % 10 === 0) {
      await sleep(300_000 + Math.floor(Math.random() * 600_000));
    }

    // 3) Throttle: auto-reply e order_status devem sair rapidamente (UX crítico).
    //    Apenas envios manuais aplicam o intervalo anti-spam log-normal completo.
    if (kind === "manual") {
      const { data: last } = await admin
        .from("whatsapp_send_log")
        .select("sent_at").eq("store_id", store_id)
        .neq("message_hash", "greet_pending")
        .order("sent_at", { ascending: false }).limit(1).maybeSingle();
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
      const { data: lastToPhone } = await admin
        .from("whatsapp_send_log")
        .select("sent_at").eq("store_id", store_id).eq("phone", number)
        .neq("message_hash", "greet_pending")
        .order("sent_at", { ascending: false }).limit(1).maybeSingle();
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
    let r: Response | null = null;
    let data: any = {};
    let attempt = 0;
    let lastErr: unknown = null;
    while (attempt <= EVOLUTION_MAX_RETRIES) {
      try {
        r = await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${cfg.evolution_instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ number, text: message }),
        });
        data = await r.json().catch(() => ({}));
        if (r.ok) break;
        // 4xx: não adianta retentar
        if (r.status >= 400 && r.status < 500) {
          return json({ error: "Falha Evolution", details: data }, 502);
        }
      } catch (err) {
        lastErr = err;
      }
      attempt++;
      if (attempt > EVOLUTION_MAX_RETRIES) break;
      await sleep(EVOLUTION_RETRY_DELAY_MS * attempt + Math.floor(Math.random() * 1000));
    }
    if (!r || !r.ok) {
      console.error("[evolution-send-message] ❌ envio falhou após retries", { lastErr, status: r?.status, data });
      return json({ error: "Falha Evolution", details: data || String(lastErr) }, 502);
    }

    // 4) Registra envio (best-effort). ignoreDuplicates aproveita o unique index
    // (store_id, phone, kind, sent_bucket_min) — bucket determinístico por
    // minuto que corta a corrida de saudações duplicadas em rajada.
    await admin.from("whatsapp_send_log").upsert(
      { store_id, phone: number, message_hash: msgHash, kind, sent_at: nowIso },
      { onConflict: "store_id,phone,kind,sent_bucket_min", ignoreDuplicates: kind !== "auto_reply" } as any,
    );

    // P0 — self-heal: envio OK ⇒ chip está conectado. Destrava status preso em disconnected/connecting.
    if (cfg.status !== "connected") {
      await admin
        .from("store_whatsapp_config")
        .update({ status: "connected", updated_at: nowIso })
        .eq("store_id", store_id);
    }

    return json({ success: true, data });
  } catch (e) {
    console.error("evolution-send-message error:", e);
    return json({ error: "Internal error", message: e.message, stack: e.stack }, 500);
  }
});