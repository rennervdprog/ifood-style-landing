// Consulta pública do status do pedido guest.
// GET ?order_id=<uuid>&last4=<últimos 4 do telefone>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*", "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const makePin = () => String(Math.floor(1000 + Math.random() * 9000));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = new URL(req.url);
    const orderId = (url.searchParams.get("order_id") || "").trim();
    const last4 = (url.searchParams.get("last4") || "").replace(/\D/g, "");
    if (!orderId || last4.length !== 4) return json({ error: "invalid_params" }, 400);

    const sb = createClient(
      (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!,
      (
        Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
        Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      )!,
      { auth: { persistSession: false } },
    );

    const { data: order } = await sb.from("orders")
      .select("id, client_id, status, total_price, subtotal, delivery_fee, payment_method, address_details, neighborhood, created_at, store_id, is_guest, delivery_pin, pix_expires_at, pix_proof_url, pix_refused_reason, pix_proof_uploaded_at")
      .eq("id", orderId).maybeSingle();
    if (!order || !(order as any).is_guest) return json({ error: "not_found" }, 404);

    const [{ data: guest }, { data: profile }] = await Promise.all([
      sb.from("guest_customers")
        .select("phone, name").eq("user_id", (order as any).client_id).maybeSingle(),
      sb.from("profiles")
        .select("phone, full_name, delivery_pin").eq("user_id", (order as any).client_id).maybeSingle(),
    ]);
    const customerPhone = String((guest as any)?.phone || (profile as any)?.phone || "");
    const customerName = (guest as any)?.name || (profile as any)?.full_name || null;
    if (!customerPhone || customerPhone.slice(-4) !== last4) return json({ error: "not_found" }, 404);

    const [{ data: store }, { data: items }] = await Promise.all([
      sb.from("stores")
        .select("name, slug, whatsapp_number, pix_direto_enabled, pix_direto_key, pix_direto_key_type, pix_direto_beneficiary, pix_direto_instructions").eq("id", (order as any).store_id).maybeSingle(),
      sb.from("order_items")
        .select("quantity, unit_price, products(name)").eq("order_id", orderId),
    ]);

    let deliveryPin = (order as any)?.delivery_pin || (profile as any)?.delivery_pin || null;
    if (!deliveryPin) {
      deliveryPin = makePin();
      const [{ error: orderPinErr }, { error: profilePinErr }] = await Promise.all([
        sb.from("orders").update({ delivery_pin: deliveryPin } as any).eq("id", orderId),
        sb.from("profiles").upsert(
          {
            user_id: (order as any).client_id,
            full_name: customerName,
            phone: customerPhone,
            delivery_pin: deliveryPin,
          } as any,
          { onConflict: "user_id" },
        ),
      ]);
      if (orderPinErr && profilePinErr) {
        console.error("[guest-order-status] pin persist error:", { orderPinErr, profilePinErr });
        deliveryPin = null;
      }
    }

    return json({
      order,
      store,
      items,
      customer_name: customerName,
      delivery_pin: deliveryPin,
    });
  } catch (e) {
    console.error("[guest-order-status] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});