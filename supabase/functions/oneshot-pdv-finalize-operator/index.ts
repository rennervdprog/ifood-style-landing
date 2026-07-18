// One-shot: adiciona operator_id na RPC pdv_finalize_sale para gravar
// o operador PIN nas movimentações (relatórios por operador).
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

const SQL = `
CREATE OR REPLACE FUNCTION public.pdv_finalize_sale(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id        uuid := (_payload->>'store_id')::uuid;
  v_session_id      uuid := (_payload->>'session_id')::uuid;
  v_table_id        text := _payload->>'table_identifier';
  v_subtotal        numeric := (_payload->>'subtotal')::numeric;
  v_discount        numeric := COALESCE((_payload->>'pdv_discount')::numeric, 0);
  v_commission      numeric := COALESCE((_payload->>'commission_rate')::numeric, 0);
  v_total           numeric := (_payload->>'total_price')::numeric;
  v_primary_method  text := _payload->>'payment_method';
  v_payments        jsonb := COALESCE(_payload->'payments', '[]'::jsonb);
  v_items           jsonb := COALESCE(_payload->'items', '[]'::jsonb);
  v_created_by      uuid := NULLIF(_payload->>'created_by','')::uuid;
  v_operator_id     uuid := NULLIF(_payload->>'operator_id','')::uuid;
  v_order_id        uuid;
  v_item            jsonb;
  v_payment         jsonb;
  v_session_open    boolean;
BEGIN
  IF v_store_id IS NULL OR v_session_id IS NULL THEN
    RAISE EXCEPTION 'store_id e session_id são obrigatórios';
  END IF;

  SELECT (status = 'open') INTO v_session_open
  FROM pdv_sessions WHERE id = v_session_id;
  IF v_session_open IS NOT TRUE THEN
    RAISE EXCEPTION 'Sessão de PDV não está aberta';
  END IF;

  INSERT INTO orders (
    store_id, client_id, order_source, pdv_session_id, table_identifier,
    subtotal, delivery_fee, pdv_discount, commission_rate, total_price,
    app_fee, payment_method, payments, neighborhood, address_details, status
  ) VALUES (
    v_store_id, NULL, 'pdv', v_session_id, v_table_id,
    v_subtotal, 0, v_discount, v_commission, v_total,
    0, v_primary_method, v_payments, 'Balcão',
    COALESCE(v_table_id || ' — Presencial', 'Pedido presencial'),
    'finalizado'
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    INSERT INTO order_items (
      order_id, product_id, quantity, unit_price,
      addons, observations, metadata
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      COALESCE((v_item->>'quantity')::numeric, 1),
      (v_item->>'unit_price')::numeric,
      CASE WHEN v_item ? 'addons' AND v_item->'addons' <> 'null'::jsonb
           THEN v_item->'addons' ELSE NULL END,
      NULLIF(v_item->>'observations',''),
      CASE WHEN v_item ? 'metadata' AND v_item->'metadata' <> 'null'::jsonb
           THEN v_item->'metadata' ELSE NULL END
    );
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments) LOOP
    INSERT INTO pdv_movements (
      session_id, store_id, type, amount, payment_method,
      description, order_id, created_by, operator_id
    ) VALUES (
      v_session_id, v_store_id, 'sale',
      (v_payment->>'amount')::numeric,
      v_payment->>'method',
      COALESCE(v_table_id, 'Venda balcão'),
      v_order_id, v_created_by, v_operator_id
    );
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.pdv_finalize_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_finalize_sale(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pdv_finalize_sale(jsonb) TO service_role;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  return new Response(JSON.stringify({ ok: r.ok, status: r.status, body: await r.text() }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});