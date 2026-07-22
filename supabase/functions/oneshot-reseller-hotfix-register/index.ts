// Hotfix: reseller_register estava disparando "column reference 'code' is ambiguous"
// por causa do RETURNS TABLE (code TEXT) colidindo com a coluna resellers.code
// dentro do bloco PL/pgSQL. Renomeia para out params + retorna via SELECT explícito.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
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
const SQL = `
DROP FUNCTION IF EXISTS public.reseller_register(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.reseller_register(_code TEXT, _pix_key TEXT DEFAULT NULL, _pix_key_type TEXT DEFAULT NULL)
RETURNS TABLE (out_id UUID, out_code TEXT, out_status public.reseller_status)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_code TEXT; v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_code := upper(regexp_replace(coalesce(_code,''),'[^A-Z0-9]','','g'));
  IF length(v_code) < 4 OR length(v_code) > 20 THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF EXISTS (SELECT 1 FROM public.resellers r WHERE r.code = v_code AND r.user_id <> v_uid) THEN
    RAISE EXCEPTION 'code_taken';
  END IF;
  INSERT INTO public.resellers(user_id, code, status, pix_key, pix_key_type)
    VALUES (v_uid, v_code, 'pending', _pix_key, _pix_key_type)
    ON CONFLICT (user_id) DO UPDATE
      SET code = EXCLUDED.code,
          pix_key = COALESCE(EXCLUDED.pix_key, public.resellers.pix_key),
          pix_key_type = COALESCE(EXCLUDED.pix_key_type, public.resellers.pix_key_type),
          updated_at = now()
    RETURNING resellers.id INTO v_id;
  RETURN QUERY SELECT r.id, r.code, r.status FROM public.resellers r WHERE r.id = v_id;
END; $$;
REVOKE ALL ON FUNCTION public.reseller_register(TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_register(TEXT,TEXT,TEXT) TO authenticated;
`;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const r = await q(SQL);
  return new Response(JSON.stringify({ ok: r.status < 300, status: r.status, body: r.body }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});