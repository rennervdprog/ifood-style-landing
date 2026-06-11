const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
const PROJECT_REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";

const SQL = `
-- Grupos de vasilhame (compartilhados entre marcas: 600ml, 300ml etc.)
CREATE TABLE IF NOT EXISTS public.returnable_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_label text,
  default_deposit_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, name)
);
GRANT SELECT ON public.returnable_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.returnable_groups TO authenticated;
GRANT ALL ON public.returnable_groups TO service_role;
ALTER TABLE public.returnable_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read returnable groups" ON public.returnable_groups;
CREATE POLICY "public read returnable groups" ON public.returnable_groups FOR SELECT USING (true);
DROP POLICY IF EXISTS "store owners manage returnable groups" ON public.returnable_groups;
CREATE POLICY "store owners manage returnable groups" ON public.returnable_groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

-- Saldo de cascos por cliente x loja x grupo
CREATE TABLE IF NOT EXISTS public.customer_empties (
  customer_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  returnable_group_id uuid NOT NULL REFERENCES public.returnable_groups(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, store_id, returnable_group_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_empties TO authenticated;
GRANT ALL ON public.customer_empties TO service_role;
ALTER TABLE public.customer_empties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customer reads own empties" ON public.customer_empties;
CREATE POLICY "customer reads own empties" ON public.customer_empties FOR SELECT TO authenticated
  USING (customer_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));
-- writes happen via SECURITY DEFINER RPCs (added in Phase 2/3), no direct write policy

-- Histórico de movimentos
DO $$ BEGIN
  CREATE TYPE public.empties_movement_kind AS ENUM ('charged','returned','adjust');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.empties_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  returnable_group_id uuid NOT NULL REFERENCES public.returnable_groups(id) ON DELETE CASCADE,
  order_id uuid,
  kind public.empties_movement_kind NOT NULL,
  qty integer NOT NULL,
  unit_price numeric(10,2),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS empties_movements_store_idx ON public.empties_movements(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS empties_movements_customer_idx ON public.empties_movements(customer_id, created_at DESC);
GRANT SELECT ON public.empties_movements TO authenticated;
GRANT ALL ON public.empties_movements TO service_role;
ALTER TABLE public.empties_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own empties movements" ON public.empties_movements;
CREATE POLICY "read own empties movements" ON public.empties_movements FOR SELECT TO authenticated
  USING (customer_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

SELECT 'ok' AS result;
`;

Deno.serve(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
});