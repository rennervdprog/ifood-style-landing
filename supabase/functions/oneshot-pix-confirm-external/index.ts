const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sql = `
-- Confirma Pix Direto recebido por fora do app (ex: comprovante veio pelo WhatsApp).
-- Aceita qualquer estado pendente de Pix Direto e libera o pedido.
CREATE OR REPLACE FUNCTION public.confirm_pix_external(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_status order_status;
  v_path text;
BEGIN
  SELECT s.owner_id, o.status, o.pix_proof_url
    INTO v_owner, v_status, v_path
  FROM orders o JOIN stores s ON s.id = o.store_id
  WHERE o.id = p_order_id FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF v_status NOT IN ('aguardando_comprovante','comprovante_enviado','pix_direto_recusado') THEN
    RAISE EXCEPTION 'Pedido não pode ser confirmado (status=%)', v_status;
  END IF;
  UPDATE orders
     SET status = 'preparando',
         pix_confirmed_at = now(),
         confirmed_at = now(),
         pix_proof_url = NULL
   WHERE id = p_order_id;
  RETURN v_path;
END $$;

GRANT EXECUTE ON FUNCTION public.confirm_pix_external(uuid) TO authenticated;
`;
  const out = await q(sql);
  const check = await q(`SELECT proname FROM pg_proc WHERE proname='confirm_pix_external';`);
  return new Response(JSON.stringify({ out, check }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});