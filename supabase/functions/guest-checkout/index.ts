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

async function quoteGuestDelivery(p: Payload) {
  if (p.is_pickup) return { ok: true, fulfillment: "pickup", destination: null, pricing: { delivery_fee: 0, platform_fee_store_absorbed: 0 } };
  if (!p.address) return { ok: false, reason: "missing_address" };

  const a = p.address;
  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const response = await fetch(`${base}/functions/v1/quote-delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        store_id: p.store_id,
        fulfillment: "delivery",
        subtotal: Number(p.subtotal || 0),
        address: {
          street: a.street,
          number: a.number,
          complement: a.complement,
          neighborhood: p.neighborhood,
          cep: a.cep,
        },
      }),
    });
    const result = await response.json().catch(() => null);
    return response.ok ? result : { ok: false, reason: result?.reason || "delivery_quote_unavailable" };
  } catch {
    return { ok: false, reason: "delivery_quote_unavailable" };
  }
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
      sb.from("stores").select("id, guest_checkout_enabled, address_city, slug, pix_direto_enabled, pix_direto_key").eq("id", p.store_id).maybeSingle(),
      sb.from("guest_customers").select("user_id").eq("phone", phone).maybeSingle(),
    ]);
    const store = storeRes.data;
    const existing = existingRes.data;
    if (!store || !(store as any).guest_checkout_enabled) return json({ error: "guest_not_enabled" }, 403);

    // Se o método for pix_direto, valida que a loja tem chave configurada
    const isPixDireto = p.payment_method === "pix_direto";
    if (isPixDireto) {
      if (!(store as any).pix_direto_enabled || !((store as any).pix_direto_key || "").trim()) {
        return json({ error: "pix_direto_not_available" }, 400);
      }
    }

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

      // 2) Cotação única antes do INSERT. Entrega só segue com endereço,
      // distância, elegibilidade e taxa retornados pelo backend central.
      const quote = await quoteGuestDelivery(p);
      if (!quote?.ok) {
        return json({ error: "delivery_quote_failed", reason: quote?.reason || "delivery_quote_failed" }, 400);
      }
      const deliverySnapshot: any = quote.destination || null;
      const addressString = deliverySnapshot?.normalized_address || "Retirada na loja";
      const neighborhood = p.is_pickup ? "RETIRADA" : deliverySnapshot?.neighborhood;
      if (!p.is_pickup && (!deliverySnapshot || !Number.isFinite(Number(deliverySnapshot.lat)) || !Number.isFinite(Number(deliverySnapshot.lng)))) {
        return json({ error: "address_not_resolved", reason: "address_not_resolved" }, 400);
      }

    const { data: pinProfile } = await sb.from("profiles")
      .select("delivery_pin")
      .eq("user_id", userId)
      .maybeSingle();
    const deliveryPin = (pinProfile as any)?.delivery_pin || String(Math.floor(1000 + Math.random() * 9000));

    // 3) Pedido (crítico — bloqueia a resposta)
    const { data: order, error: orderErr } = await sb.from("orders").insert({
      client_id: userId,
      store_id: p.store_id,
      subtotal: p.subtotal,
      delivery_fee: Number((quote as any)?.pricing?.delivery_fee || 0),
      delivery_fee_absorbed_by_store: Number((quote as any)?.pricing?.platform_fee_store_absorbed || 0),
      total_price: Number(p.subtotal || 0) + Number((quote as any)?.pricing?.delivery_fee || 0),
      commission_rate: p.commission_rate ?? 0,
      payment_method: p.payment_method,
      neighborhood: deliverySnapshot?.neighborhood || neighborhood,
      address_details: deliverySnapshot?.normalized_address || addressString,
      delivery_cep: deliverySnapshot?.cep || null,
      delivery_city: deliverySnapshot?.city || null,
      delivery_state: deliverySnapshot?.state || null,
      client_lat: deliverySnapshot?.lat ?? null,
      client_lng: deliverySnapshot?.lng ?? null,
      needs_change: !!p.needs_change,
      change_for: p.change_for || 0,
      status: isPixDireto ? "aguardando_comprovante" : "pendente",
      scheduled_for: p.scheduled_for || null,
      is_guest: true,
      delivery_pin: deliveryPin,
      metadata: p.is_pickup ? null : { delivery_quote: {
        policy_version: (quote as any)?.policy_version || 1,
        distance_km: Number((quote as any)?.distance?.km || 0),
        distance_source: (quote as any)?.distance?.source || "haversine",
        max_delivery_km: (quote as any)?.distance?.max_km ?? null,
        destination_precision: (deliverySnapshot as any)?.precision || "cep",
        store_delivery_base: Number((quote as any)?.pricing?.store_delivery_base || 0),
        platform_fee_customer: Number((quote as any)?.pricing?.platform_fee_customer || 0),
        platform_fee_store_absorbed: Number((quote as any)?.pricing?.platform_fee_store_absorbed || 0),
        delivery_fee: Number((quote as any)?.pricing?.delivery_fee || 0),
        vip_override_applied: (quote as any)?.pricing?.vip_override_applied ?? null,
        split_mode: (quote as any)?.pricing?.split_mode ?? null,
        plan_type: (quote as any)?.pricing?.plan_type ?? null,
      } },
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
          if (!pinProfile || !(pinProfile as any).delivery_pin) {
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

    return json({ ok: true, order_id: order.id, phone_last4: phone.slice(-4), delivery_pin: deliveryPin, pix_direto: isPixDireto });
  } catch (e) {
    console.error("[guest-checkout] unhandled:", e);
    return json({ error: "internal_error" }, 500);
  }
});