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

// Anti-spam params
const DEDUPE_WINDOW_SEC = 3600;        // mesma msg p/ mesmo número
const PER_STORE_MIN_GAP_MS = 12_000;   // gap mínimo entre envios da loja
const WARMUP_HOURS = 48;
const WARMUP_MAX_MSGS = 20;            // teto nas primeiras 48h após conectar

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

    // 1) Dedupe: mesma mensagem pro mesmo número em <1h
    const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_SEC * 1000).toISOString();
    const { data: dup } = await admin
      .from("whatsapp_send_log")
      .select("id")
      .eq("store_id", store_id).eq("phone", number).eq("message_hash", msgHash)
      .gte("sent_at", dedupeSince).limit(1).maybeSingle();
    if (dup) return json({ success: true, skipped: "duplicate" });

    // 2) Warmup: limita volume nas primeiras 48h após conectar
    if (cfg.connected_at) {
      const ageH = (Date.now() - new Date(cfg.connected_at).getTime()) / 3_600_000;
      if (ageH < WARMUP_HOURS) {
        const { count } = await admin
          .from("whatsapp_send_log")
          .select("id", { count: "exact", head: true })
          .eq("store_id", store_id).gte("sent_at", cfg.connected_at);
        if ((count ?? 0) >= WARMUP_MAX_MSGS) {
          return json({ error: "Aquecimento: limite diário de envios atingido. Tente novamente mais tarde." }, 429);
        }
      }
    }

    // 3) Throttle: gap mínimo entre envios da mesma loja + jitter
    const { data: last } = await admin
      .from("whatsapp_send_log")
      .select("sent_at").eq("store_id", store_id)
      .order("sent_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.sent_at) {
      const gap = Date.now() - new Date(last.sent_at).getTime();
      const need = PER_STORE_MIN_GAP_MS + Math.floor(Math.random() * 8000);
      if (gap < need) await sleep(need - gap);
    } else {
      await sleep(2500 + Math.floor(Math.random() * 3500));
    }

    if (kind === "auto_reply") {
      await sendPresence(baseUrl, cfg.evolution_instance_name, apiKey, number);
      await sleep(2500 + Math.floor(Math.random() * 4500));
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