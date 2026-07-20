// Fase 1 do PDV Lanches (snack_bar): adiciona valor no enum store_type,
// coluna printer_target em products, e tabela combo_definitions.
// Idempotente. Aplica no Supabase EXTERNO via Management API.

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

// ADD VALUE precisa rodar isolado (fora de transação) — cada statement num run próprio.
const SQL_ENUM = `
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'store_type_enum' AND e.enumlabel = 'snack_bar'
  ) THEN
    ALTER TYPE public.store_type_enum ADD VALUE 'snack_bar';
  END IF;
END $$;
`;

const SQL_SCHEMA = `
-- printer_target em products: para quais impressoras o item vai
-- ('kitchen'=cozinha, 'counter'=balcão, 'both'=ambas — default seguro).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS printer_target text NOT NULL DEFAULT 'both'
  CHECK (printer_target IN ('kitchen','counter','both'));

-- combo_definitions: combos fechados de Lanches (ex.: Lanche + Batata + Refri)
CREATE TABLE IF NOT EXISTS public.combo_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_url text,
  -- slots: [{ name:'Lanche', options:[product_id,...], required:true, qty:1 }, ...]
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS combo_definitions_store_idx
  ON public.combo_definitions (store_id, active, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.combo_definitions TO authenticated;
GRANT ALL ON public.combo_definitions TO service_role;
GRANT SELECT ON public.combo_definitions TO anon;

ALTER TABLE public.combo_definitions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='combo_definitions' AND policyname='combo_definitions_public_read') THEN
    CREATE POLICY "combo_definitions_public_read" ON public.combo_definitions
      FOR SELECT TO anon, authenticated USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='combo_definitions' AND policyname='combo_definitions_owner_all') THEN
    CREATE POLICY "combo_definitions_owner_all" ON public.combo_definitions
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = combo_definitions.store_id AND s.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = combo_definitions.store_id AND s.owner_id = auth.uid()));
  END IF;
END $$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.combo_definitions_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS combo_definitions_touch_trg ON public.combo_definitions;
CREATE TRIGGER combo_definitions_touch_trg
  BEFORE UPDATE ON public.combo_definitions
  FOR EACH ROW EXECUTE FUNCTION public.combo_definitions_touch();
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.enum = await run(SQL_ENUM);
  out.schema = await run(SQL_SCHEMA);
  const ok = (out.enum as any).ok && (out.schema as any).ok;
  return new Response(JSON.stringify(out, null, 2), {
    status: ok ? 200 : 500,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});