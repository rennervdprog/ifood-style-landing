// Envia mensagem via WhatsApp da PLATAFORMA (instância dedicada 'itasuper-platform').
// Espelha toda a lógica anti-ban de evolution-send-message, mas lê de
// platform_whatsapp_config (instance + connected_at) e loga em
// platform_whatsapp_send_log (sem store_id).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hashMsg = async (s: string) => {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
};

const sendPresence = async (baseUrl: string, instance: string, apiKey: string, number: string) => {
  await fetch(`${baseUrl.replace(/\/$/, "")}/chat/sendPresence/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number, presence: "composing", delay: 400 }),
  }).catch(() => undefined);
};

// Anti-spam (mesmos parâmetros de evolution-send-message)
const DEDUPE_WINDOW_SEC = 3600;
const AUTO_REPLY_DEDUPE_WINDOW_SEC = 57600; // 16h
const PER_INSTANCE_MIN_GAP_MS = 12_000;
const PER_PHONE_MIN_GAP_MS = 3_000;
const EVOLUTION_MAX_RETRIES = 2;
const EVOLUTION_RETRY_DELAY_MS = 2_000;

const dailyLimitForAge = (days: number) => {
  if (days < 7) return 20;
  if (days < 14) return 50;
  if (days < 30) return 100;
  if (days < 60) return 150;
  return 200;
};

const logNormalDelay = () => {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const ms = Math.exp(3.6 + z * 0.6) * 1000;
  return Math.min(180_000, Math.max(15_000, Math.floor(ms)));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const EXT_KEY =
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
      Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!baseUrl || !apiKey) return json({ error: "Evolution não configurado" }, 500);

    const body = await req.json().catch(() => ({}));
    const phoneRaw: string = String(body?.phone || "").replace(/\D/g, "");
    const message: string = String(body?.message || "");
    const kind: string = String(body?.kind || "generic");
    const force: boolean = body?.force === true;
    const category: string = String(
      body?.category ||
        (kind.startsWith("billing_") ? "mensalidade"
        : kind.startsWith("repasse_") || kind === "weekly_payout" ? "repasse"
        : kind.startsWith("essencial_") ? "essencial"
        : kind === "welcome" ? "boas-vindas"
        : kind === "test" ? "teste"
        : kind === "manual" ? "manual"
        : "outros"),
    );
    const store_id: string | null = body?.store_id || null;
    const store_name: string | null = body?.store_name || null;
    const preview: string = String(message).slice(0, 200);
    if (!phoneRaw || !message) return json({ error: "phone e message obrigatórios" }, 400);

    const admin = createClient(EXT_URL, EXT_KEY);

    const { data: cfg } = await admin
      .from("platform_whatsapp_config")
      .select("instance_name, status, connected_at, avisos_ativos")
      .limit(1)
      .maybeSingle();
    if (!cfg) return json({ error: "platform_whatsapp_config vazio" }, 500);
    if (!force && cfg.avisos_ativos === false) return json({ success: true, skipped: "avisos_desativados" });
    if (cfg.status !== "connected") return json({ error: "WhatsApp plataforma desconectado", status: cfg.status }, 409);

    let number = phoneRaw;
    if (number.length <= 11) number = "55" + number;

    const msgHash = await hashMsg(message);
    const nowIso = new Date().toISOString();

    // 1) Dedupe por hash (1h / 16h auto_reply)
    const dedupeWindowSec = kind === "auto_reply" ? AUTO_REPLY_DEDUPE_WINDOW_SEC : DEDUPE_WINDOW_SEC;
    const dedupeSince = new Date(Date.now() - dedupeWindowSec * 1000).toISOString();
    const { data: dup } = await admin
      .from("platform_whatsapp_send_log")
      .select("id")
      .eq("phone", number).eq("message_hash", msgHash)
      .gte("sent_at", dedupeSince).limit(1).maybeSingle();
    if (dup && !force) return json({ success: true, skipped: "duplicate" });

    // Dedupe adicional por kind para auto_reply
    if (kind === "auto_reply" && !force) {
      const { data: dupKind } = await admin
        .from("platform_whatsapp_send_log")
        .select("id")
        .eq("phone", number).eq("kind", "auto_reply")
        .gte("sent_at", dedupeSince).limit(1).maybeSingle();
      if (dupKind) return json({ success: true, skipped: "auto_reply_dedupe_16h" });
    }

    // 2) Limite diário por fase do chip
    const ageDays = cfg.connected_at
      ? (Date.now() - new Date(cfg.connected_at).getTime()) / 86_400_000
      : 999;
    const dailyLimit = dailyLimitForAge(ageDays);
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await admin
      .from("platform_whatsapp_send_log")
      .select("id", { count: "exact", head: true })
      .gte("sent_at", dayStart.toISOString());
    if (!force && (sentToday ?? 0) >= dailyLimit) {
      return json({ error: `Limite diário atingido (${dailyLimit}).`, skipped: "daily_limit" }, 429);
    }
    // Coffee break a cada 10 msgs
    if ((sentToday ?? 0) > 0 && (sentToday ?? 0) % 10 === 0) {
      await sleep(300_000 + Math.floor(Math.random() * 600_000));
    }

    // 3) Throttle geral (só manual aplica log-normal completo)
    if (kind === "manual") {
      const { data: last } = await admin
        .from("platform_whatsapp_send_log")
        .select("sent_at")
        .order("sent_at", { ascending: false }).limit(1).maybeSingle();
      if (last?.sent_at) {
        const gap = Date.now() - new Date(last.sent_at).getTime();
        const need = PER_INSTANCE_MIN_GAP_MS + logNormalDelay();
        if (gap < need) await sleep(need - gap);
      } else {
        await sleep(2500 + Math.floor(Math.random() * 3500));
      }
    } else if (kind !== "auto_reply") {
      await sleep(400 + Math.floor(Math.random() * 2600));
    }

    // 3.b) Gap mínimo por número
    {
      const { data: lastToPhone } = await admin
        .from("platform_whatsapp_send_log")
        .select("sent_at").eq("phone", number)
        .order("sent_at", { ascending: false }).limit(1).maybeSingle();
      if (lastToPhone?.sent_at) {
        const gap = Date.now() - new Date(lastToPhone.sent_at).getTime();
        if (gap < PER_PHONE_MIN_GAP_MS) await sleep(PER_PHONE_MIN_GAP_MS - gap);
      }
    }

    if (kind === "auto_reply") {
      sendPresence(baseUrl, cfg.instance_name, apiKey, number);
    }

    // Envio com retry em 5xx/network
    let r: Response | null = null;
    let data: any = {};
    let attempt = 0;
    let lastErr: unknown = null;
    while (attempt <= EVOLUTION_MAX_RETRIES) {
      try {
        r = await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${cfg.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ number, text: message }),
        });
        data = await r.json().catch(() => ({}));
        if (r.ok) break;
        if (r.status >= 400 && r.status < 500) {
          await admin.from("platform_whatsapp_send_log").insert({
            phone: number, kind, category, store_id, store_name, preview,
            message_hash: msgHash, status: "error",
            error: JSON.stringify(data).slice(0, 500),
          }).then(() => {}, () => {});
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
      await admin.from("platform_whatsapp_send_log").insert({
        phone: number, kind, category, store_id, store_name, preview,
        message_hash: msgHash, status: "error",
        error: String(lastErr || data).slice(0, 500),
      }).then(() => {}, () => {});
      return json({ error: "Falha Evolution", details: data || String(lastErr) }, 502);
    }

    // Registra envio (upsert por bucket para cortar corrida)
    await admin.from("platform_whatsapp_send_log").upsert(
      { phone: number, kind, category, store_id, store_name, preview,
        message_hash: msgHash, status: "sent", sent_at: nowIso },
      { onConflict: "phone,kind,sent_bucket_min", ignoreDuplicates: kind !== "auto_reply" } as any,
    );

    // Self-heal status
    if (cfg.status !== "connected") {
      await admin.from("platform_whatsapp_config")
        .update({ status: "connected", updated_at: nowIso })
        .neq("id", "00000000-0000-0000-0000-000000000000");
    }

    return json({ success: true, data });
  } catch (e) {
    console.error("platform-whatsapp-send error:", e);
    return json({ error: String(e) }, 500);
  }
});