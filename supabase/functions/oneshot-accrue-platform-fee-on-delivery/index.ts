// Cria trigger que ao finalizar pedido acumula a taxa da plataforma (0,99 ou
// override VIP) em store_balances.repasse_pendente — pro cron de segunda
// gerar cobrança pro lojista. Idempotente por pedido via unique index.
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"};
async function run(q:string){
  const ref=Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t=Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
    method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},
    body:JSON.stringify({query:q})
  });
  const text=await r.text();
  try{return{status:r.status,body:JSON.parse(text)};}catch{return{status:r.status,body:text};}
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const out:Record<string,unknown>={};

  // 1) Tabela de auditoria/idempotência
  out.audit_table = await run(`
    CREATE TABLE IF NOT EXISTS public.platform_fee_accruals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL UNIQUE,
      store_id uuid NOT NULL,
      amount numeric(10,2) NOT NULL,
      source text NOT NULL DEFAULT 'delivery_platform_fee',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_platform_fee_accruals_store ON public.platform_fee_accruals(store_id, created_at DESC);
    ALTER TABLE public.platform_fee_accruals ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "service only" ON public.platform_fee_accruals;
    CREATE POLICY "service only" ON public.platform_fee_accruals FOR ALL USING (false);
  `);

  // 2) Função do trigger
  out.fn = await run(`
    CREATE OR REPLACE FUNCTION public.accrue_platform_fee_on_delivery()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_fee jsonb;
      v_platform_total numeric;
      v_delivery_fee numeric;
    BEGIN
      -- só finalização real
      IF NEW.status NOT IN ('entregue','finalizado') THEN RETURN NEW; END IF;
      IF OLD.status = NEW.status THEN RETURN NEW; END IF;

      -- pedido tem que ter delivery_fee > 0 (PDV / retirada não acumula)
      v_delivery_fee := COALESCE(NEW.delivery_fee, 0);
      IF v_delivery_fee <= 0 THEN RETURN NEW; END IF;

      -- idempotência
      IF EXISTS (SELECT 1 FROM public.platform_fee_accruals WHERE order_id = NEW.id) THEN
        RETURN NEW;
      END IF;

      -- calcula corte da plataforma respeitando VIP/plano/split_mode
      v_fee := public.compute_store_delivery_fee(NEW.store_id);
      v_platform_total := COALESCE((v_fee->>'platform_add_customer')::numeric,0)
                       + COALESCE((v_fee->>'platform_add_payout_deduction')::numeric,0);

      IF v_platform_total <= 0 THEN RETURN NEW; END IF;

      -- registra e acumula
      INSERT INTO public.platform_fee_accruals(order_id, store_id, amount)
      VALUES (NEW.id, NEW.store_id, v_platform_total)
      ON CONFLICT (order_id) DO NOTHING;

      INSERT INTO public.store_balances(store_id, repasse_pendente)
      VALUES (NEW.store_id, v_platform_total)
      ON CONFLICT (store_id) DO UPDATE
        SET repasse_pendente = COALESCE(public.store_balances.repasse_pendente,0) + EXCLUDED.repasse_pendente,
            updated_at = now();

      RETURN NEW;
    END;
    $$;
  `);

  // 3) Trigger no orders
  out.trg = await run(`
    DROP TRIGGER IF EXISTS trg_accrue_platform_fee_on_delivery ON public.orders;
    CREATE TRIGGER trg_accrue_platform_fee_on_delivery
      AFTER UPDATE OF status ON public.orders
      FOR EACH ROW
      EXECUTE FUNCTION public.accrue_platform_fee_on_delivery();
  `);

  out.verify = await run(`SELECT tgname FROM pg_trigger WHERE tgrelid='public.orders'::regclass AND tgname='trg_accrue_platform_fee_on_delivery';`);

  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});