// One-off: cria pedidos demo (novos, prontos, saiu_entrega) na loja ricburguer
// no Supabase EXTERNO usando service-role.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const EXT = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${EXT}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  let d: unknown = t;
  try { d = JSON.parse(t); } catch {}
  if (!r.ok) throw new Error(`REST ${path} ${r.status}: ${t}`);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const stores = await rest(`stores?slug=eq.ricburguer&select=id,name,owner_id,commission_rate`) as Array<any>;
    if (!stores.length) return json({ error: "Loja ricburguer não encontrada" }, 404);
    const store = stores[0];

    const prods = await rest(`products?store_id=eq.${store.id}&is_available=eq.true&select=id,name,price&limit=6`) as Array<any>;
    if (!prods.length) return json({ error: "Sem produtos disponíveis" }, 404);

    // pega um client_id qualquer (owner serve como placeholder se não houver outro)
    const anyClient = await rest(`profiles?select=id&limit=1`) as Array<any>;
    const clientId = anyClient[0]?.id || store.owner_id;

    const orderSpecs: Array<{ status: string; count: number; neighborhood: string }> = [
      { status: "pendente", count: 3, neighborhood: "Centro" },
      { status: "pronto_para_entrega", count: 2, neighborhood: "Vila Nova" },
      { status: "saiu_entrega", count: 2, neighborhood: "Jardim Brasil" },
    ];

    const created: any[] = [];
    for (const spec of orderSpecs) {
      for (let i = 0; i < spec.count; i++) {
        const prod = prods[(created.length) % prods.length];
        const qty = 1 + (i % 2);
        const subtotal = Number(prod.price) * qty;
        const deliveryFee = 6;
        const total = Math.round((subtotal + deliveryFee) * 100) / 100;
        const ord = await rest(`orders`, {
          method: "POST",
          body: JSON.stringify({
            client_id: clientId,
            store_id: store.id,
            subtotal,
            delivery_fee: deliveryFee,
            total_price: total,
            commission_rate: store.commission_rate ?? 0,
            payment_method: "pix",
            status: spec.status,
            neighborhood: spec.neighborhood,
            address_details: `Rua Demo, ${100 + created.length}`,
            customer_name: `Cliente Demo ${created.length + 1}`,
            customer_phone: "11999990000",
          }),
        }) as Array<any>;
        const orderId = ord[0].id;
        await rest(`order_items`, {
          method: "POST",
          body: JSON.stringify({
            order_id: orderId,
            product_id: prod.id,
            quantity: qty,
            unit_price: Number(prod.price),
          }),
        });
        created.push({ id: orderId, status: spec.status, total, product: prod.name, qty });
      }
    }

    return json({ ok: true, store: store.name, created });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});