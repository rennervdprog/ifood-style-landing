const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: await r.text() };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  // 1. Colunas de bloqueio parcial (fase sombra)
  out.cols = await run(`
    ALTER TABLE public.stores
      ADD COLUMN IF NOT EXISTS partial_lock_status TEXT,
      ADD COLUMN IF NOT EXISTS partial_lock_notified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS partial_lock_deadline TIMESTAMPTZ;
  `);
  // 2. Suavizar trigger: em vez de bloquear duro em R$500, só bloqueia se status='restricted'
  //    (que a fase sombra NUNCA seta — só loga em warning). Isso respeita os 5 dias úteis do Termo 8.2.
  out.trigger = await run(`
    CREATE OR REPLACE FUNCTION public.enforce_store_balance_lock()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      _status TEXT;
    BEGIN
      SELECT partial_lock_status INTO _status FROM public.stores WHERE id = NEW.store_id;
      IF _status = 'restricted' THEN
        RAISE EXCEPTION 'STORE_BLOCKED_BALANCE: Loja com restrição parcial ativa (saldo pendente > R$ 500 há mais de 5 dias úteis). Quite o PIX da plataforma para reativar.'
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END;
    $$;
  `);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});