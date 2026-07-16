const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
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
  out.ext = await run(`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;`);
  out.fix_upsert = await run(`
    CREATE OR REPLACE FUNCTION public.pdv_upsert_operator(_store_id UUID, _id UUID, _name TEXT, _pin TEXT)
    RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
    DECLARE _new_id UUID; _hash TEXT;
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid()) THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
      IF _name IS NULL OR length(trim(_name)) < 2 THEN RAISE EXCEPTION 'invalid_name'; END IF;
      IF _pin IS NOT NULL AND (length(_pin) < 4 OR length(_pin) > 8 OR _pin !~ '^[0-9]+$') THEN
        RAISE EXCEPTION 'invalid_pin';
      END IF;
      IF _id IS NULL THEN
        IF _pin IS NULL THEN RAISE EXCEPTION 'pin_required'; END IF;
        _hash := extensions.crypt(_pin, extensions.gen_salt('bf'));
        INSERT INTO public.pdv_operators(store_id, name, pin_hash, created_by)
          VALUES (_store_id, trim(_name), _hash, auth.uid())
          RETURNING id INTO _new_id;
        RETURN _new_id;
      ELSE
        IF _pin IS NOT NULL THEN
          _hash := extensions.crypt(_pin, extensions.gen_salt('bf'));
          UPDATE public.pdv_operators SET name=trim(_name), pin_hash=_hash, updated_at=NOW()
            WHERE id=_id AND store_id=_store_id;
        ELSE
          UPDATE public.pdv_operators SET name=trim(_name), updated_at=NOW()
            WHERE id=_id AND store_id=_store_id;
        END IF;
        RETURN _id;
      END IF;
    END; $$;
  `);
  out.fix_verify = await run(`
    CREATE OR REPLACE FUNCTION public.pdv_verify_operator_pin(_store_id UUID, _pin TEXT)
    RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
    DECLARE _row RECORD;
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid()) THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
      IF _pin IS NULL OR _pin !~ '^[0-9]{4,8}$' THEN RETURN jsonb_build_object('ok',false,'error','invalid_pin'); END IF;
      SELECT id, name INTO _row FROM public.pdv_operators
        WHERE store_id=_store_id AND active=true AND pin_hash = extensions.crypt(_pin, pin_hash) LIMIT 1;
      IF _row.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','pin_mismatch'); END IF;
      RETURN jsonb_build_object('ok',true,'operator_id',_row.id,'operator_name',_row.name);
    END; $$;
  `);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});