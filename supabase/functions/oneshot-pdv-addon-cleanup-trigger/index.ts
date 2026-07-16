// Instala trigger no Supabase EXTERNO que remove store_addons(pdv, price_override=0)
// quando a loja deixa de ser pdv_only (evita "PDV grátis eterno" após troca de plano).
// Também faz backfill nas lojas que já trocaram.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: await r.text() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};

  out.trigger = await run(`
    CREATE OR REPLACE FUNCTION public.tg_cleanup_pdv_addon_on_plan_change()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
    BEGIN
      IF OLD.plan_type = 'pdv_only' AND NEW.plan_type <> 'pdv_only' THEN
        DELETE FROM public.store_addons
         WHERE store_id = NEW.id
           AND addon_code = 'pdv'
           AND COALESCE(price_override, -1) = 0;
      END IF;
      RETURN NEW;
    END $fn$;

    DROP TRIGGER IF EXISTS stores_cleanup_pdv_addon ON public.stores;
    CREATE TRIGGER stores_cleanup_pdv_addon
    AFTER UPDATE OF plan_type ON public.stores
    FOR EACH ROW EXECUTE FUNCTION public.tg_cleanup_pdv_addon_on_plan_change();
  `);

  out.backfill = await run(`
    DELETE FROM public.store_addons
     WHERE addon_code = 'pdv'
       AND COALESCE(price_override, -1) = 0
       AND store_id IN (
         SELECT id FROM public.stores WHERE plan_type <> 'pdv_only'
       )
     RETURNING store_id;
  `);

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});