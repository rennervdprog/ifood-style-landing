// One-shot Fase 2 — alçada de gerente + limite de sangria.
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

const SQL = `
-- 1) role em pdv_operators
ALTER TABLE public.pdv_operators
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'operador';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pdv_operators_role_chk') THEN
    ALTER TABLE public.pdv_operators
      ADD CONSTRAINT pdv_operators_role_chk
      CHECK (role IN ('operador','gerente')) NOT VALID;
  END IF;
END $$;

-- 2) authorized_by em pdv_movements
ALTER TABLE public.pdv_movements
  ADD COLUMN IF NOT EXISTS authorized_by_operator_id uuid;

-- 3) admin_settings: limite default de sangria sem alçada (R$ 200)
INSERT INTO public.admin_settings (key, value)
  VALUES ('pdv_sangria_manager_limit', to_jsonb(200))
  ON CONFLICT (key) DO NOTHING;

-- 4) pdv_list_operators devolve role também
CREATE OR REPLACE FUNCTION public.pdv_list_operators(_store_id uuid)
RETURNS TABLE(id uuid, name text, active boolean, role text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.name, o.active, o.role
  FROM public.pdv_operators o
  WHERE o.store_id = _store_id
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid())
  ORDER BY o.name;
$$;

-- 5) pdv_verify_operator_pin devolve role
CREATE OR REPLACE FUNCTION public.pdv_verify_operator_pin(_store_id uuid, _pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _row record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,8}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;
  SELECT id, name, role INTO _row
    FROM public.pdv_operators
    WHERE store_id = _store_id AND active = true
      AND pin_hash = extensions.crypt(_pin, pin_hash)
    LIMIT 1;
  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pin_mismatch');
  END IF;
  RETURN jsonb_build_object('ok', true, 'operator_id', _row.id,
                            'operator_name', _row.name, 'role', _row.role);
END; $$;

-- 6) pdv_verify_manager_pin — só valida se role = 'gerente'
CREATE OR REPLACE FUNCTION public.pdv_verify_manager_pin(_store_id uuid, _pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _row record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,8}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;
  SELECT id, name, role INTO _row
    FROM public.pdv_operators
    WHERE store_id = _store_id AND active = true AND role = 'gerente'
      AND pin_hash = extensions.crypt(_pin, pin_hash)
    LIMIT 1;
  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_manager');
  END IF;
  RETURN jsonb_build_object('ok', true, 'operator_id', _row.id, 'operator_name', _row.name);
END; $$;

-- 7) pdv_upsert_operator aceita role
CREATE OR REPLACE FUNCTION public.pdv_upsert_operator(
  _store_id uuid, _id uuid, _name text, _pin text, _role text DEFAULT 'operador'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _new_id uuid; _hash text; _r text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _name IS NULL OR length(trim(_name)) < 2 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF _pin IS NOT NULL AND (length(_pin) < 4 OR length(_pin) > 8 OR _pin !~ '^[0-9]+$') THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;
  _r := COALESCE(_role, 'operador');
  IF _r NOT IN ('operador','gerente') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF _id IS NULL THEN
    IF _pin IS NULL THEN RAISE EXCEPTION 'pin_required'; END IF;
    _hash := extensions.crypt(_pin, extensions.gen_salt('bf'));
    INSERT INTO public.pdv_operators(store_id, name, pin_hash, role, created_by)
      VALUES (_store_id, trim(_name), _hash, _r, auth.uid())
      RETURNING id INTO _new_id;
    RETURN _new_id;
  ELSE
    IF _pin IS NOT NULL THEN
      _hash := extensions.crypt(_pin, extensions.gen_salt('bf'));
      UPDATE public.pdv_operators SET name=trim(_name), pin_hash=_hash, role=_r, updated_at=NOW()
        WHERE id=_id AND store_id=_store_id;
    ELSE
      UPDATE public.pdv_operators SET name=trim(_name), role=_r, updated_at=NOW()
        WHERE id=_id AND store_id=_store_id;
    END IF;
    RETURN _id;
  END IF;
END; $$;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const r = await run(SQL);
    return new Response(JSON.stringify({ ok: r.ok, status: r.status, body: r.body }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});