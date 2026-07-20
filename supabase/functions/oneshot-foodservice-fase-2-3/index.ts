// Fase 2 (Pizzaria) + Fase 3 (Restaurante/Marmitaria) — adiciona valores no enum
// store_type_enum e cria tabela daily_menus para marmitex do dia.
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

const SQL_ENUM_PIZZERIA = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname='store_type_enum' AND e.enumlabel='pizzeria') THEN
    ALTER TYPE public.store_type_enum ADD VALUE 'pizzeria';
  END IF;
END $$;`;

const SQL_ENUM_RESTAURANT = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname='store_type_enum' AND e.enumlabel='restaurant') THEN
    ALTER TYPE public.store_type_enum ADD VALUE 'restaurant';
  END IF;
END $$;`;

const SQL_SCHEMA = `
-- daily_menus: marmitex/prato do dia
CREATE TABLE IF NOT EXISTS public.daily_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  menu_date date NOT NULL DEFAULT current_date,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_menus_store_date_idx
  ON public.daily_menus (store_id, menu_date, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_menus TO authenticated;
GRANT ALL ON public.daily_menus TO service_role;
GRANT SELECT ON public.daily_menus TO anon;

ALTER TABLE public.daily_menus ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_menus' AND policyname='daily_menus_public_read') THEN
    CREATE POLICY "daily_menus_public_read" ON public.daily_menus
      FOR SELECT TO anon, authenticated USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_menus' AND policyname='daily_menus_owner_all') THEN
    CREATE POLICY "daily_menus_owner_all" ON public.daily_menus
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = daily_menus.store_id AND s.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = daily_menus.store_id AND s.owner_id = auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.daily_menus_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS daily_menus_touch_trg ON public.daily_menus;
CREATE TRIGGER daily_menus_touch_trg
  BEFORE UPDATE ON public.daily_menus
  FOR EACH ROW EXECUTE FUNCTION public.daily_menus_touch();
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.enum_pizzeria = await run(SQL_ENUM_PIZZERIA);
  out.enum_restaurant = await run(SQL_ENUM_RESTAURANT);
  out.schema = await run(SQL_SCHEMA);
  const ok = (out.enum_pizzeria as any).ok && (out.enum_restaurant as any).ok && (out.schema as any).ok;
  return new Response(JSON.stringify(out, null, 2), {
    status: ok ? 200 : 500,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});