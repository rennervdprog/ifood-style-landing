// Fase 4 do PDV Boutique: RPCs auxiliares para vale-crédito e CRM.
// Idempotente — pode rodar quantas vezes quiser. Aplica no Supabase EXTERNO.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, ok: r.ok, body: await r.text() };
}

const SQL = `
-- Lista créditos ativos da loja, opcionalmente filtrando por telefone.
CREATE OR REPLACE FUNCTION public.apparel_list_credits(
  _store_id uuid,
  _phone text DEFAULT NULL
) RETURNS SETOF public.customer_credits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.pdv_assert_store_owner(_store_id);
  RETURN QUERY
    SELECT * FROM public.customer_credits
    WHERE store_id = _store_id
      AND balance > 0
      AND (_phone IS NULL OR customer_phone = _phone)
    ORDER BY created_at DESC
    LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.apparel_list_credits(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_list_credits(uuid,text) TO authenticated, service_role;

-- Upsert do CRM: cria/atualiza cliente da loja e soma total gasto.
CREATE OR REPLACE FUNCTION public.apparel_touch_customer(
  _store_id uuid,
  _phone text,
  _name text,
  _preferred_size text DEFAULT NULL,
  _amount numeric DEFAULT 0
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  PERFORM public.pdv_assert_store_owner(_store_id);
  IF _phone IS NULL OR length(trim(_phone)) = 0 THEN
    RAISE EXCEPTION 'phone_required';
  END IF;

  INSERT INTO public.customers_crm (store_id, phone, name, preferred_size, total_spent, purchases_count, last_purchase_at)
  VALUES (_store_id, _phone, _name, _preferred_size, COALESCE(_amount,0), CASE WHEN _amount>0 THEN 1 ELSE 0 END, CASE WHEN _amount>0 THEN now() ELSE NULL END)
  ON CONFLICT (store_id, phone) WHERE phone IS NOT NULL DO UPDATE
     SET name = COALESCE(EXCLUDED.name, customers_crm.name),
         preferred_size = COALESCE(EXCLUDED.preferred_size, customers_crm.preferred_size),
         total_spent = customers_crm.total_spent + COALESCE(_amount,0),
         purchases_count = customers_crm.purchases_count + CASE WHEN _amount>0 THEN 1 ELSE 0 END,
         last_purchase_at = CASE WHEN _amount>0 THEN now() ELSE customers_crm.last_purchase_at END,
         updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.apparel_touch_customer(uuid,text,text,text,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_touch_customer(uuid,text,text,text,numeric) TO authenticated, service_role;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out = await run(SQL);
  return new Response(JSON.stringify(out, null, 2), {
    status: out.ok ? 200 : 500,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});