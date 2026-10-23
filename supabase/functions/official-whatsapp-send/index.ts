// official-whatsapp-send
// Envio pela API OFICIAL do WhatsApp (Meta Cloud API), por loja.
// Pré-condição: loja com whatsapp_mode='official' e linha em
// store_whatsapp_official_config (phone_number_id). Token: segredo do projeto
// META_WHATSAPP_TOKEN (usuário de sistema do provedor — acessa todas as WABAs).
// Body: { store_id, phone, template_name?, params?: string[], text?, kind? }
//  - template_name+params: mensagem utilidade fora da janela de 24h (avisos de pedido)
//  - text: resposta livre — só funciona dentro da janela de 24h do cliente
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

Deno.serve(async (req) => {
  try {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const storeId = String(body?.store_id || "");
    const phone = String(body?.phone || "").replace(/\D/g, "");
    if (!storeId || !phone) return json({ ok: false, error: "missing_fields" });

    const token = Deno.env.get("META_WHATSAPP_TOKEN") || "";
    if (!token) return json({ ok: false, error: "meta_token_missing" }); // migração ainda não ativada

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: ocfg } = await admin.from("store_whatsapp_official_config")
      .select("phone_number_id, template_lang, status")
      .eq("store_id", storeId).maybeSingle();
    if (!ocfg?.phone_number_id) return json({ ok: false, error: "official_not_configured" });

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
    // registra no mesmo log dos envios Evolution (contagem/observabilidade unificadas)
    try {
      await admin.from("whatsapp_send_log").insert({
        store_id: storeId, phone, kind: String(body?.kind || "order_status"),
        message_hash: `official:${(out as any)?.messages?.[0]?.id || ""}`,
        sent_at: new Date().toISOString(),
      });
    } catch { /* log é best-effort */ }
    return json({ ok: true, data: out });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
