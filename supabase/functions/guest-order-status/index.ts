// Consulta pública de status do pedido guest.
// GET ?order_id=<uuid>&last4=<últimos 4 do telefone>
import { getExternalSupabase, corsHeaders, jsonRes }
  from "../_shared/externalClient.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonRes({ error: "method_not_allowed" }, 405);

  try {
    const url = new URL(req.url);
    const orderId = (url.searchParams.get("order_id") || "").trim();
    const last4 = (url.searchParams.get("last4") || "").replace(/\D/g, "");
    if (!orderId || last4.length !== 4) return jsonRes({ error: "invalid_params" }, 400);

    const sb = getExternalSupabase();

    const { data: order } = await sb
      .from("orders")
      .select("id, client_id, status, total_price, subtotal, delivery_fee, payment_method, address_details, neighborhood, created_at, store_id, is_guest")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || !(order as any).is_guest) return jsonRes({ error: "not_found" }, 404);

    // valida last4 contra o guest_customer
    const { data: guest } = await sb
      .from("guest_customers")
      .select("phone, name")
      .eq("user_id", (order as any).client_id)
      .maybeSingle();
    if (!guest || String((guest as any).phone).slice(-4) !== last4) {
      return jsonRes({ error: "not_found" }, 404);
    }

    const { data: store } = await sb
      .from("stores")
      .select("name, slug, whatsapp_number")
      .eq("id", (order as any).store_id)
      .maybeSingle();

    const { data: items } = await sb
      .from("order_items")
      .select("quantity, unit_price, products(name)")
      .eq("order_id", orderId);

    return jsonRes({ order, store, items, customer_name: (guest as any).name || null });
  } catch (e) {
    console.error("[guest-order-status] error:", e);
    return jsonRes({ error: "internal_error" }, 500);
  }
});