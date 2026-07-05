// Piloto Itatinga — cria pedido guest sem cadastro.
// Deployado no Supabase EXTERNO (usa SUPABASE_URL/SERVICE_ROLE_KEY locais).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*", "Access-Control-Max-Age": "86400",
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

    // Store + guest lookup em paralelo (independentes).
    const [storeRes, existingRes] = await Promise.all([
      sb.from("stores").select("id, guest_checkout_enabled, address_city, slug").eq("id", p.store_id).maybeSingle(),
      sb.from("guest_customers").select("user_id").eq("phone", phone).maybeSingle(),
    ]);
    const store = storeRes.data;
    const existing = existingRes.data;
    if (!store || !(store as any).guest_checkout_enabled) return json({ error: "guest_not_enabled" }, 403);

    // 1) Reutilizar ou criar auth.user sintético
    let userId: string | null = null;
    let isNewUser = false;
    if (existing?.user_id) {
      userId = existing.user_id;
    } else {
      isNewUser = true;
      const email = `guest+${phone}@guest.itasuper.app`;
      const password = crypto.randomUUID() + crypto.randomUUID();
      const { data: created, error: createErr } = await sb.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { guest: true, phone, name },
      });
      if (createErr || !created?.user?.id) {
        // race: procura em profiles pelo phone (evita listUsers full-scan)
        const { data: prof } = await sb.from("profiles").select("user_id").eq("phone", phone).maybeSingle();
        if (!prof?.user_id) {
          console.error("[guest-checkout] createUser error:", createErr);
          return json({ error: "user_create_failed" }, 500);
        }
        userId = (prof as any).user_id;
        isNewUser = false;
      } else {
        userId = created.user.id;
      }
    }

    // 2) Endereço → string a partir do payload (não bate no DB)
    let addressString = "Retirada na loja";
    const neighborhood = p.is_pickup ? "RETIRADA" : p.neighborhood;
    if (!p.is_pickup && p.address) {
      const a = p.address;
      const parts = [a.street.trim(), a.number.trim(), a.complement, a.reference_point ? `Ref: ${a.reference_point}` : ""].filter(Boolean);
      addressString = parts.join(", ");
    }

    const deliveryPin = String(Math.floor(1000 + Math.random() * 9000));

    // 3) Pedido (crítico — bloqueia a resposta)
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
      status: "pendente",
      scheduled_for: p.scheduled_for || null,
      is_guest: true,
      delivery_pin: deliveryPin,
    } as any).select("id").single();

    if (orderErr || !order?.id) {
      console.error("[guest-checkout] order insert error:", orderErr);
      return json({ error: "order_create_failed", detail: orderErr?.message }, 500);
    }

    // 4) Itens (crítico)
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

    // 5) Dados mínimos do guest necessários para a tela pública validar e mostrar o PIN.
    //    Mantém esta parte síncrona para evitar a página /p/:orderId abrir antes do vínculo existir.
    const { error: guestErr } = await sb.from("guest_customers").upsert({
      phone, user_id: userId, name,
      city_slug: (store as any).address_city || null,
      last_store_id: p.store_id,
      consent_at: new Date().toISOString(),
    } as any, { onConflict: "phone" });
    if (guestErr) {
      console.error("[guest-checkout] guest upsert error:", guestErr);
      return json({ error: "guest_link_failed" }, 500);
    }

    // 6) Trabalho não-crítico → em background (não bloqueia a resposta).
    //    Profile pin e saved_addresses.
    const bgTask = (async () => {
      try {
        if (isNewUser) {
          await sb.from("profiles").upsert(
            { user_id: userId, full_name: name, phone, delivery_pin: deliveryPin } as any,
            { onConflict: "user_id" },
          );
        } else {
          const { data: prof } = await sb.from("profiles").select("delivery_pin").eq("user_id", userId).maybeSingle();
          if (!prof || !(prof as any).delivery_pin) {
            await sb.from("profiles").upsert(
              { user_id: userId, delivery_pin: deliveryPin } as any,
              { onConflict: "user_id" },
            );
          }
        }

        if (!p.is_pickup && p.address) {
          const a = p.address;
          const street = a.street.trim();
          const number = a.number.trim();
          const nb = p.neighborhood.trim();
          const { data: dup } = await sb.from("saved_addresses")
            .select("id").eq("user_id", userId)
            .eq("street", street).eq("number", number).eq("neighborhood", nb)
            .limit(1).maybeSingle();
          if (!dup) {
            await sb.from("saved_addresses").update({ is_default: false }).eq("user_id", userId);
            await sb.from("saved_addresses").insert({
              user_id: userId,
              label: a.label || "Casa",
              cep: (a.cep || "").replace(/\D/g, "") || null,
              street, number,
              complement: a.complement || null,
              neighborhood: nb,
              reference_point: a.reference_point || null,
              is_default: true,
            } as any);
          }
        }
      } catch (e) {
        console.error("[guest-checkout] bg task error:", e);
      }
    })();
    try { (globalThis as any).EdgeRuntime?.waitUntil?.(bgTask); } catch { /* fire-and-forget fallback */ }

    return json({ ok: true, order_id: order.id, phone_last4: phone.slice(-4), delivery_pin: deliveryPin });
  } catch (e) {
    console.error("[guest-checkout] unhandled:", e);
    return json({ error: "internal_error" }, 500);
  }
});