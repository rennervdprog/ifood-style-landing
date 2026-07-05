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
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: order } = await sb.from("orders")
      .select("id, client_id, status, total_price, subtotal, delivery_fee, payment_method, address_details, neighborhood, created_at, store_id, is_guest, delivery_pin")
      .eq("id", orderId).maybeSingle();
    if (!order || !(order as any).is_guest) return json({ error: "not_found" }, 404);

    const { data: guest } = await sb.from("guest_customers")
      .select("phone, name").eq("user_id", (order as any).client_id).maybeSingle();
    if (!guest || String((guest as any).phone).slice(-4) !== last4) return json({ error: "not_found" }, 404);

    const { data: store } = await sb.from("stores")
      .select("name, slug, whatsapp_number").eq("id", (order as any).store_id).maybeSingle();
    const { data: items } = await sb.from("order_items")
      .select("quantity, unit_price, products(name)").eq("order_id", orderId);
    const { data: profile } = await sb.from("profiles")
      .select("delivery_pin").eq("user_id", (order as any).client_id).maybeSingle();

    let deliveryPin = (order as any)?.delivery_pin || (profile as any)?.delivery_pin || null;
    if (!deliveryPin) {
      deliveryPin = makePin();
      const { error: pinErr } = await sb.from("profiles").upsert(
        {
          user_id: (order as any).client_id,
          full_name: (guest as any).name || null,
          phone: (guest as any).phone || null,
          delivery_pin: deliveryPin,
        } as any,
        { onConflict: "user_id" },
      );
      if (pinErr) {
        console.error("[guest-order-status] pin upsert error:", pinErr);
        deliveryPin = null;
      }
    }

    return json({
      order,
      store,
      items,
      customer_name: (guest as any).name || null,
      delivery_pin: deliveryPin,
    });
  } catch (e) {
    console.error("[guest-order-status] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});