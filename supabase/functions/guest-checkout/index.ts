// Piloto Itatinga — cria pedido guest sem cadastro.
// Cria (ou reaproveita) um auth.user sintético vinculado ao telefone,
// grava endereço e pedido, e devolve orderId para acompanhamento.
import { getExternalSupabase, corsHeaders, jsonRes, normalizePhoneBR }
  from "../_shared/externalClient.ts";

interface GuestOrderPayload {
  phone: string;
  name: string;
  store_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    addons?: unknown;
    observations?: string | null;
  }>;
  subtotal: number;
  delivery_fee: number;
  total_price: number;
  commission_rate?: number;
  payment_method: string;
  neighborhood: string;
  address: {
    label?: string;
    cep?: string | null;
    street: string;
    number: string;
    complement?: string | null;
    reference_point?: string | null;
  } | null;
  is_pickup: boolean;
  needs_change?: boolean;
  change_for?: number;
  scheduled_for?: string | null;
  consent: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ error: "method_not_allowed" }, 405);

  let payload: GuestOrderPayload;
  try { payload = await req.json(); } catch { return jsonRes({ error: "invalid_json" }, 400); }

  const phone = normalizePhoneBR(payload?.phone);
  const name = String(payload?.name || "").trim().slice(0, 100);
  if (!phone) return jsonRes({ error: "invalid_phone" }, 400);
  if (!name || name.length < 2) return jsonRes({ error: "invalid_name" }, 400);
  if (!payload?.consent) return jsonRes({ error: "consent_required" }, 400);
  if (!payload?.store_id) return jsonRes({ error: "missing_store_id" }, 400);
  if (!Array.isArray(payload?.items) || payload.items.length === 0) {
    return jsonRes({ error: "empty_items" }, 400);
  }
  if (!payload?.is_pickup && !payload?.address) {
    return jsonRes({ error: "missing_address" }, 400);
  }

  try {
    const sb = getExternalSupabase();

    // Loja precisa ter guest habilitado
    const { data: store } = await sb
      .from("stores")
      .select("id, guest_checkout_enabled, address_city, slug")
      .eq("id", payload.store_id)
      .maybeSingle();
    if (!store || !(store as any).guest_checkout_enabled) {
      return jsonRes({ error: "guest_not_enabled" }, 403);
    }

    // 1) Achar/criar guest_customer + auth.user sintético
    let userId: string | null = null;
    const { data: existing } = await sb
      .from("guest_customers")
      .select("user_id")
      .eq("phone", phone)
      .maybeSingle();

    if (existing?.user_id) {
      userId = existing.user_id;
    } else {
      const email = `guest+${phone}@guest.itasuper.app`;
      const password = crypto.randomUUID() + crypto.randomUUID();
      const { data: created, error: createErr } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { guest: true, phone, name },
      });
      if (createErr || !created?.user?.id) {
        // Pode existir por corrida — tentar buscar por email
        const { data: byEmail } = await sb.auth.admin.listUsers();
        const found = byEmail?.users?.find((u: any) => u.email === email);
        if (!found) {
          console.error("[guest-checkout] createUser error:", createErr);
          return jsonRes({ error: "user_create_failed" }, 500);
        }
        userId = found.id;
      } else {
        userId = created.user.id;
      }

      // profile mínimo (se tabela existir)
      await sb.from("profiles").upsert({
        user_id: userId,
        full_name: name,
        phone,
      } as any, { onConflict: "user_id" });
    }

    // upsert guest_customer
    await sb.from("guest_customers").upsert({
      phone,
      user_id: userId,
      name,
      city_slug: (store as any).address_city || null,
      last_store_id: payload.store_id,
      consent_at: new Date().toISOString(),
    } as any, { onConflict: "phone" });

    // 2) Salvar endereço (se não for retirada)
    let addressString = "Retirada na loja";
    let neighborhood = payload.neighborhood;
    if (!payload.is_pickup && payload.address) {
      const a = payload.address;
      // grava como saved_address (evita duplicar exato)
      await sb.from("saved_addresses").insert({
        user_id: userId,
        label: a.label || "Casa",
        cep: (a.cep || "").replace(/\D/g, "") || null,
        street: a.street,
        number: a.number,
        complement: a.complement || null,
        neighborhood: payload.neighborhood,
        reference_point: a.reference_point || null,
        is_default: true,
      } as any);
      const parts = [a.street, a.number, a.complement, a.reference_point ? `Ref: ${a.reference_point}` : ""].filter(Boolean);
      addressString = parts.join(", ");
    }

    // 3) Criar pedido
    const orderStatus = "pendente"; // guest não usa PIX online no piloto
    const { data: order, error: orderErr } = await sb
      .from("orders")
      .insert({
        client_id: userId,
        store_id: payload.store_id,
        subtotal: payload.subtotal,
        delivery_fee: payload.delivery_fee,
        total_price: payload.total_price,
        commission_rate: payload.commission_rate ?? 0,
        payment_method: payload.payment_method,
        neighborhood,
        address_details: addressString,
        needs_change: !!payload.needs_change,
        change_for: payload.change_for || 0,
        status: orderStatus,
        scheduled_for: payload.scheduled_for || null,
        is_guest: true,
      } as any)
      .select("id")
      .single();

    if (orderErr || !order?.id) {
      console.error("[guest-checkout] order insert error:", orderErr);
      return jsonRes({ error: "order_create_failed", detail: orderErr?.message }, 500);
    }

    // 4) Itens
    const rows = payload.items.map((it) => ({
      order_id: order.id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      addons: it.addons ? JSON.stringify(it.addons) : null,
      observations: it.observations || null,
    }));
    const { error: itemsErr } = await sb.from("order_items").insert(rows);
    if (itemsErr) {
      console.error("[guest-checkout] items insert error:", itemsErr);
    }

    return jsonRes({
      ok: true,
      order_id: order.id,
      track_code: order.id.slice(0, 8),
      phone_last4: phone.slice(-4),
    });
  } catch (e) {
    console.error("[guest-checkout] unhandled:", e);
    return jsonRes({ error: "internal_error" }, 500);
  }
});