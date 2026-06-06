import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  kind: z.enum(["manual", "auto_reply", "order_status"]).optional(),
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
    body: JSON.stringify({ number, presence: "composing", delay: 2500 }),
  }).catch(() => undefined);
};

const isAuthorizedForStore = async (admin: any, req: Request, storeId: string) => {
  const authHeader = req.headers.get("Authorization") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (serviceRole && authHeader === `Bearer ${serviceRole}`) return true;
  if (!authHeader.startsWith("Bearer ")) return false;

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
  const userId = userData?.user?.id;
  if (error || !userId) return false;

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
const PER_STORE_MIN_GAP_MS = 12_000;   // gap mínimo entre envios da loja
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
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { store_id, phone, message, kind = "manual" } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!(await isAuthorizedForStore(admin, req, store_id))) return json({ error: "Forbidden" }, 403);

    const { data: cfg } = await admin
      .from("store_whatsapp_config")
      .select("evolution_instance_name, status, connected_at")
      .eq("store_id", store_id)
      .maybeSingle();

    if (!cfg?.evolution_instance_name) return json({ error: "Evolution não configurado" }, 400);
    if (cfg.status !== "connected") return json({ error: "WhatsApp não conectado" }, 400);

    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!baseUrl || !apiKey) return json({ error: "Servidor Evolution não configurado" }, 500);

    let number = phone.replace(/\D/g, "");
    if (number.length <= 11) number = "55" + number;

    // === ANTI-SPAM ===
    const msgHash = await hashMsg(message);
    const nowIso = new Date().toISOString();

    // 1) Dedupe: auto-reply precisa permitir novo cardápio em teste/atendimento; manual/status seguem mais conservadores.
    const dedupeWindowSec = kind === "auto_reply" ? 120 : DEDUPE_WINDOW_SEC;
    const dedupeSince = new Date(Date.now() - dedupeWindowSec * 1000).toISOString();
    const { data: dup } = await admin
      .from("whatsapp_send_log")
      .select("id")
      .eq("store_id", store_id).eq("phone", number).eq("message_hash", msgHash)
      .gte("sent_at", dedupeSince).limit(1).maybeSingle();
    if (dup) return json({ success: true, skipped: "duplicate" });

    // 2) Limite diário por fase do chip (P1.3)
    const ageDays = cfg.connected_at
      ? (Date.now() - new Date(cfg.connected_at).getTime()) / 86_400_000
      : 999;
    const dailyLimit = dailyLimitForAge(ageDays);
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await admin
      .from("whatsapp_send_log")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store_id)
      .neq("message_hash", "greet_pending")
      .gte("sent_at", dayStart.toISOString());
    if ((sentToday ?? 0) >= dailyLimit) {
      return json({ error: `Limite diário de envios atingido (${dailyLimit}). Aguarde amanhã.` }, 429);
    }
    // Coffee break: a cada 10 msgs no dia, pausa 5-15min (P1.2)
    if ((sentToday ?? 0) > 0 && (sentToday ?? 0) % 10 === 0) {
      await sleep(300_000 + Math.floor(Math.random() * 600_000));
    }

    // 3) Throttle: auto-reply curto; envios manuais/status continuam com intervalo anti-spam maior.
    const { data: last } = await admin
      .from("whatsapp_send_log")
      .select("sent_at").eq("store_id", store_id)
      .neq("message_hash", "greet_pending")
      .order("sent_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.sent_at) {
      const gap = Date.now() - new Date(last.sent_at).getTime();
      const need = kind === "auto_reply"
        ? 2_500 + Math.floor(Math.random() * 2_500)
        : PER_STORE_MIN_GAP_MS + logNormalDelay();
      if (gap < need) await sleep(need - gap);
    } else {
      await sleep(2500 + Math.floor(Math.random() * 3500));
    }

    if (kind === "auto_reply") {
      // P2.4 — presença "digitando" curta para o teste não parecer travado.
      const typingMs = Math.min(4_500, Math.max(1_200, message.length * 20));
      await sendPresence(baseUrl, cfg.evolution_instance_name, apiKey, number);
      await sleep(typingMs + Math.floor(Math.random() * 2000));
    }

    const r = await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${cfg.evolution_instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number, text: message }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: "Falha Evolution", details: data }, 502);

    // 4) Registra envio (best-effort)
    await admin.from("whatsapp_send_log").insert({
      store_id, phone: number, message_hash: msgHash, kind, sent_at: nowIso,
    });

    return json({ success: true, data });
  } catch (e) {
    console.error("evolution-send-message error:", e);
    return json({ error: "Internal error" }, 500);
  }
});