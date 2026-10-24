// official-whatsapp-send
// Envio pela API OFICIAL do WhatsApp (Meta Cloud API), por loja.
// Pré-condição: loja com whatsapp_mode='official' e linha em
// store_whatsapp_official_config (phone_number_id). Token: segredo do projeto
// META_WHATSAPP_TOKEN (usuário de sistema do provedor — acessa todas as WABAs).
// Body: { store_id, phone, template_name?, params?: string[], text?, kind? }
//  - template_name+params: mensagem utilidade fora da janela de 24h (avisos de pedido)
//  - text: resposta livre — só funciona dentro da janela de 24h do cliente
//
// Travas (2026-10-24, reativação do bot guiado): antes desta mudança a
// function NÃO tinha trava nenhuma — sem dedupe, teto diário, delay,
// `send_disabled` ou opt-out — e é o canal oficial, o único onde o bot
// hoje é alcançável. Os guardas abaixo espelham o sender Evolution
// (`evolution-send-message`):
//  1. `send_disabled` (modo observação) — não dispara nada;
//  2. blacklist de opt-out (`whatsapp_send_log` kind=opt_out) — não dispara;
//  3. teto diário — mesma escada por idade do número (60/120/200/300/300)
//     + override do lojista (`daily_limit_override`, só aumenta, máx. 500);
//  4. dedupe por hash do conteúdo (1h; auto_reply tem dedupe por kind de 16h).
// Deliberadamente SEM: fila de reenvio (não existe worker pro canal oficial
// e resposta de bot requentada horas depois chega fora de contexto — falha
// rápido com 429) e delay log-normal (o canal oficial só recebe envios
// reativos — bot, saudação e avisos — e o delay travaria a conversa do bot).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function authorized(req: Request): boolean {
  const internalToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return (!!internalToken && req.headers.get("x-internal-token") === internalToken) ||
    (!!cronSecret && (req.headers.get("x-cron-secret") === cronSecret || (req.headers.get("Authorization") || "") === `Bearer ${cronSecret}`)) ||
    (!!serviceKey && (req.headers.get("Authorization") || "") === `Bearer ${serviceKey}`);
}

// Mesmo hash do evolution-send-message (SHA-1, 16 hex) — é ele que o
// dedupe consulta; o log precisa gravar O HASH DO CONTEÚDO (antes gravava
// `official:<id-da-Meta>`, que nunca casava com nada e anulava o dedupe).
const hashMsg = async (s: string) => {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
};

// Escada do teto diário — idêntica à de evolution-send-message (decisão do
// dono do produto, 2026-10-24): 60/120/200/300/300 por idade do número.
const DAILY_LIMIT_OVERRIDE_MAX = 500;
const dailyLimitForAge = (days: number) => {
  if (days < 7) return 60; // semana 1
  if (days < 14) return 120; // semana 2
  if (days < 30) return 200; // semana 3-4
  if (days < 60) return 300; // mês 2
  return 300; // mês 3+
};
const DEDUPE_WINDOW_SEC = 3600; // mesma msg p/ mesmo número
const AUTO_REPLY_DEDUPE_WINDOW_SEC = 57600; // saudação 1x por número / 16h

Deno.serve(async (req) => {
  try {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const storeId = String(body?.store_id || "");
    const rawPhone = String(body?.phone || "").replace(/\D/g, "");
    if (!storeId || !rawPhone) return json({ ok: false, error: "missing_fields" });
    // Normaliza como o sender Evolution: DDD+ número sem DDI ganha "55".
    // O mesmo formato é usado no log, no dedupe e na blacklist — sem isso
    // "22999999999" e "5522999999999" seriam números diferentes pras travas.
    const phone = rawPhone.length <= 11 ? `55${rawPhone}` : rawPhone;
    const kind = String(body?.kind || "order_status");

    const token = Deno.env.get("META_WHATSAPP_TOKEN") || "";
    if (!token) return json({ ok: false, error: "meta_token_missing" }); // migração ainda não ativada

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: ocfg } = await admin.from("store_whatsapp_official_config")
      .select("phone_number_id, template_lang, status")
      .eq("store_id", storeId).maybeSingle();
    if (!ocfg?.phone_number_id) return json({ ok: false, error: "official_not_configured" });

    // ── Guardas (espelham evolution-send-message) ──────────────────
    const { data: wcfg } = await admin.from("store_whatsapp_config")
      .select("send_disabled, connected_at, established_number, daily_limit_override")
      .eq("store_id", storeId).maybeSingle();
    // 1) Modo observação: não dispara nada.
    if ((wcfg as any)?.send_disabled) return json({ ok: false, error: "send_disabled" });
    // 2) Blacklist de opt-out ("PARAR"): não dispara nada.
    const { data: blocked } = await admin.from("whatsapp_send_log").select("id")
      .eq("store_id", storeId).eq("phone", phone).eq("kind", "opt_out").limit(1).maybeSingle();
    if (blocked) return json({ ok: false, error: "opted_out" });
    // 3) Teto diário por idade do número + override do lojista.
    const ageDays = (wcfg as any)?.connected_at
      ? (Date.now() - new Date((wcfg as any).connected_at).getTime()) / 86_400_000
      : 999;
    const effAgeDays = (wcfg as any)?.established_number ? Math.max(ageDays, 20) : ageDays;
    const ageLimit = dailyLimitForAge(effAgeDays);
    const overrideRaw = (wcfg as any)?.daily_limit_override;
    const override = typeof overrideRaw === "number" && Number.isFinite(overrideRaw) && overrideRaw > 0 ? overrideRaw : null;
    const dailyLimit = override !== null ? Math.min(Math.max(ageLimit, override), DAILY_LIMIT_OVERRIDE_MAX) : ageLimit;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await admin.from("whatsapp_send_log").select("id", {
      count: "exact",
      head: true,
    }).eq("store_id", storeId).neq("message_hash", "greet_pending").gte("sent_at", dayStart.toISOString());
    if ((sentToday ?? 0) >= dailyLimit) {
      return json({ ok: false, error: "daily_limit_reached", daily_limit: dailyLimit }, 429);
    }
    // 4) Dedupe por hash do conteúdo (1h; auto_reply: 1 saudação / 16h por kind).
    const contentForHash = body?.template_name
      ? `template:${String(body.template_name)}:${(Array.isArray(body.params) ? body.params : []).map((p: unknown) => String(p ?? "")).join("|")}`
      : String(body?.text || "");
    const msgHash = await hashMsg(`${kind}:${contentForHash}`);
    const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_SEC * 1000).toISOString();
    const { data: dup } = await admin.from("whatsapp_send_log").select("id")
      .eq("store_id", storeId).eq("phone", phone).eq("message_hash", msgHash)
      .gte("sent_at", dedupeSince).limit(1).maybeSingle();
    if (dup) return json({ ok: true, skipped: "duplicate" });
    if (kind === "auto_reply") {
      const kindSince = new Date(Date.now() - AUTO_REPLY_DEDUPE_WINDOW_SEC * 1000).toISOString();
      const { data: dupKind } = await admin.from("whatsapp_send_log").select("id")
        .eq("store_id", storeId).eq("phone", phone).eq("kind", "auto_reply")
        .neq("message_hash", "greet_pending").gte("sent_at", kindSince).limit(1).maybeSingle();
      if (dupKind) return json({ ok: true, skipped: "auto_reply_dedupe_16h" });
    }

    let payload: Record<string, unknown>;
    if (body?.template_name) {
      const params = Array.isArray(body.params) ? body.params.map((p: unknown) => ({ type: "text", text: String(p ?? "") })) : [];
      payload = {
        messaging_product: "whatsapp", to: phone, type: "template",
        template: {
          name: String(body.template_name),
          language: { code: ocfg.template_lang || "pt_BR" },
          ...(params.length ? { components: [{ type: "body", parameters: params }] } : {}),
        },
      };
    } else if (body?.text) {
      payload = { messaging_product: "whatsapp", to: phone, type: "text", text: { body: String(body.text) } };
    } else {
      return json({ ok: false, error: "nothing_to_send" });
    }

    const r = await fetch(`https://graph.facebook.com/v21.0/${ocfg.phone_number_id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) return json({ ok: false, error: "meta_send_failed", details: out });
    // Registra no mesmo log dos envios Evolution (contagem/observabilidade
    // unificadas) com o HASH DO CONTEÚDO — é ele que o dedupe e o teto
    // consultam. O id da mensagem na Meta volta no `data` da resposta.
    try {
      await admin.from("whatsapp_send_log").insert({
        store_id: storeId, phone, kind,
        message_hash: msgHash,
        sent_at: new Date().toISOString(),
      });
    } catch { /* log é best-effort */ }
    return json({ ok: true, data: out });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
