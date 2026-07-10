// Dispara notificação para o lojista quando o cliente envia o comprovante.
// Chamado pelo frontend logo após attach_pix_proof.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { order_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const orderId = body?.order_id;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "invalid_order_id" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: order, error } = await admin
    .from("orders")
    .select("id, store_id, total_price, status, stores!inner(owner_id, name)")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return json({ error: "order_not_found" }, 404);
  if (order.status !== "comprovante_enviado") {
    return json({ ok: true, skipped: true, status: order.status });
  }

  const ownerId = (order as any).stores?.owner_id;
  const total = Number((order as any).total_price ?? 0);

  // Best-effort push via FCM tokens do dono (usa mesmo padrão do sistema).
  const { data: tokens } = await admin
    .from("fcm_tokens")
    .select("token")
    .eq("user_id", ownerId);

  const pushCount = tokens?.length ?? 0;

  // Deixa o envio real para o serviço genérico admin-broadcast-push
  // se existir; senão, só registra o evento.
  try {
    if (pushCount > 0) {
      await admin.functions.invoke("admin-broadcast-push", {
        body: {
          user_ids: [ownerId],
          title: "🔑 Novo Pix Direto",
          body: `Comprovante recebido — R$ ${total.toFixed(2).replace(".", ",")}. Confirme o recebimento.`,
          data: { order_id: orderId, kind: "pix_direto" },
        },
      });
    }
  } catch (_e) { /* ignore */ }

  return json({ ok: true, notified_owner: ownerId, push_tokens: pushCount });
});