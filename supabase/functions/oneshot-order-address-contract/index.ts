// Contrato único de endereço: adiciona o snapshot de destino em public.orders (Supabase externo).
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const out: Record<string, unknown> = {};

  out["alter"] = await q(`
    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS delivery_cep text,
      ADD COLUMN IF NOT EXISTS delivery_city text,
      ADD COLUMN IF NOT EXISTS delivery_state text;
  `);

  // CEP normalizado (8 dígitos) e UF com 2 letras — validação leve, sem quebrar histórico.
  out["constraints"] = await q(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_cep_format') THEN
        ALTER TABLE public.orders
          ADD CONSTRAINT orders_delivery_cep_format
          CHECK (delivery_cep IS NULL OR delivery_cep ~ '^[0-9]{8}$') NOT VALID;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_state_format') THEN
        ALTER TABLE public.orders
          ADD CONSTRAINT orders_delivery_state_format
          CHECK (delivery_state IS NULL OR delivery_state ~ '^[A-Z]{2}$') NOT VALID;
      END IF;
    END $$;
  `);

  out["grants"] = await q(`
    GRANT SELECT (delivery_cep, delivery_city, delivery_state),
          INSERT (delivery_cep, delivery_city, delivery_state)
      ON public.orders TO authenticated;
    GRANT ALL ON public.orders TO service_role;
  `);

  out["verify"] = await q(`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='orders'
       AND column_name IN ('delivery_cep','delivery_city','delivery_state')
     ORDER BY column_name;
  `);

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
