// Piloto Itatinga — cria pedido guest sem cadastro.
// Deployado no Supabase EXTERNO (usa SUPABASE_URL/SERVICE_ROLE_KEY locais).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function normalizePhoneBR(input: unknown): string | null {
  const d = String(input || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length === 12 || d.length === 13) return d;
  return null;
}

interface Payload {
  phone: string;
  name: string;
  store_id: string;
  items: Array<{ product_id: string; quantity: number; unit_price: number; addons?: unknown; observations?: string | null }>;
  subtotal: number;
  delivery_fee: number;
  total_price: number;
  commission_rate?: number;
  payment_method: string;
  neighborhood: string;
  address: { label?: string; cep?: string | null; street: string; number: string; complement?: string | null; reference_point?: string | null } | null;
  is_pickup: boolean;
  needs_change?: boolean;
  change_for?: number;
  scheduled_for?: string | null;
  consent: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let p: Payload;
  try { p = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const phone = normalizePhoneBR(p?.phone);
  const name = String(p?.name || "").trim().slice(0, 100);
  if (!phone) return json({ error: "invalid_phone" }, 400);
  if (!name || name.length < 2) return json({ error: "invalid_name" }, 400);
  if (!p?.consent) return json({ error: "consent_required" }, 400);
  if (!p?.store_id) return json({ error: "missing_store_id" }, 400);
  if (!Array.isArray(p?.items) || p.items.length === 0) return json({ error: "empty_items" }, 400);
  if (!p.is_pickup && !p.address) return json({ error: "missing_address" }, 400);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: store } = await sb
      .from("stores")
      .select("id, guest_checkout_enabled, address_city, slug")
      .eq("id", p.store_id).maybeSingle();
    if (!store || !(store as any).guest_checkout_enabled) return json({ error: "guest_not_enabled" }, 403);

    // 1) Reutilizar ou criar auth.user sintético
    let userId: string | null = null;
    const { data: existing } = await sb.from("guest_customers").select("user_id").eq("phone", phone).maybeSingle();
    if (existing?.user_id) {
      userId = existing.user_id;
    } else {
      const email = `guest+${phone}@guest.itasuper.app`;
      const password = crypto.randomUUID() + crypto.randomUUID();
      const { data: created, error: createErr } = await sb.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { guest: true, phone, name },
      });
      if (createErr || !created?.user?.id) {
        // race: procurar por email
        const { data: list } = await sb.auth.admin.listUsers();
        const found = list?.users?.find((u: any) => u.email === email);
        if (!found) {
          console.error("[guest-checkout] createUser error:", createErr);
          return json({ error: "user_create_failed" }, 500);
        }
        userId = found.id;
      } else {
        userId = created.user.id;
      }
      // profile mínimo (se falhar não bloqueia)
      try {
        await sb.from("profiles").upsert({ user_id: userId, full_name: name, phone } as any, { onConflict: "user_id" });
      } catch (_) {}
    }

    await sb.from("guest_customers").upsert({
      phone, user_id: userId, name,
      city_slug: (store as any).address_city || null,
      last_store_id: p.store_id,
      consent_at: new Date().toISOString(),
    } as any, { onConflict: "phone" });

    // 2) Endereço
    let addressString = "Retirada na loja";
    const neighborhood = p.is_pickup ? "RETIRADA" : p.neighborhood;
    if (!p.is_pickup && p.address) {
      const a = p.address;
      try {
        await sb.from("saved_addresses").insert({
          user_id: userId,
          label: a.label || "Casa",
          cep: (a.cep || "").replace(/\D/g, "") || null,
          street: a.street, number: a.number,
          complement: a.complement || null,
          neighborhood: p.neighborhood,
          reference_point: a.reference_point || null,
          is_default: true,
        } as any);
      } catch (_) {}
      const parts = [a.street, a.number, a.complement, a.reference_point ? `Ref: ${a.reference_point}` : ""].filter(Boolean);
      addressString = parts.join(", ");
    }

    // 3) Pedido
    const orderStatus = "pendente";
    const { data: order, error: orderErr } = await sb.from("orders").insert({
      client_id: userId,
      store_id: p.store_id,
      subtotal: p.subtotal,
      delivery_fee: p.delivery_fee,
      total_price: p.total_price,
      commission_rate: p.commission_rate ?? 0,
      payment_method: p.payment_method,
      neighborhood,
      address_details: addressString,
      needs_change: !!p.needs_change,
      change_for: p.change_for || 0,
      status: orderStatus,
      scheduled_for: p.scheduled_for || null,
      is_guest: true,
    } as any).select("id").single();

    if (orderErr || !order?.id) {
      console.error("[guest-checkout] order insert error:", orderErr);
      return json({ error: "order_create_failed", detail: orderErr?.message }, 500);
    }

    // 4) Itens
    const rows = p.items.map((it) => ({
      order_id: order.id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      addons: it.addons ?? null,
      observations: it.observations || null,
    }));
    const { error: itemsErr } = await sb.from("order_items").insert(rows);
    if (itemsErr) console.error("[guest-checkout] items insert error:", itemsErr);

    return json({ ok: true, order_id: order.id, phone_last4: phone.slice(-4) });
  } catch (e) {
    console.error("[guest-checkout] unhandled:", e);
    return json({ error: "internal_error" }, 500);
  }
});