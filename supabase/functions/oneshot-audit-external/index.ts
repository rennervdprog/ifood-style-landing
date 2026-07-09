const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return JSON.parse(await r.text());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const out: Record<string, unknown> = {};

  // 1) Tabelas em public SEM RLS habilitado
  out["1_tables_without_rls"] = await q(`
    SELECT n.nspname AS schema, c.relname AS table
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='r' AND n.nspname='public' AND c.relrowsecurity=false
    ORDER BY 2;`);

  // 2) Tabelas em public COM RLS mas SEM nenhuma policy (efetivamente bloqueadas ou expostas via bypass)
  out["2_rls_enabled_no_policies"] = await q(`
    SELECT n.nspname AS schema, c.relname AS table
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='r' AND n.nspname='public' AND c.relrowsecurity=true
      AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname)
    ORDER BY 2;`);

  // 3) Policies "USING true" ou "WITH CHECK true" (potencialmente abertas demais)
  out["3_permissive_true_policies"] = await q(`
    SELECT tablename, policyname, cmd, roles::text, qual, with_check
    FROM pg_policies
    WHERE schemaname='public'
      AND (qual = 'true' OR with_check = 'true')
    ORDER BY tablename, policyname;`);

  // 4) GRANTs a anon com INSERT/UPDATE/DELETE em tabelas public (superfície de ataque)
  out["4_anon_write_grants"] = await q(`
    SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privs
    FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee='anon'
      AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
    GROUP BY table_name ORDER BY table_name;`);

  // 5) GRANTs a authenticated com INSERT/UPDATE/DELETE em tabelas sem policy correspondente
  out["5_authenticated_write_without_policy"] = await q(`
    WITH grants AS (
      SELECT table_name, array_agg(DISTINCT privilege_type) AS privs
      FROM information_schema.role_table_grants
      WHERE table_schema='public' AND grantee='authenticated'
        AND privilege_type IN ('INSERT','UPDATE','DELETE')
      GROUP BY table_name
    )
    SELECT g.table_name, g.privs
    FROM grants g
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname='public' AND p.tablename=g.table_name
        AND p.cmd IN ('INSERT','UPDATE','DELETE','ALL')
    )
    ORDER BY 1;`);

  // 6) Funções SECURITY DEFINER sem search_path fixado (risco de search_path hijack)
  out["6_definer_no_search_path"] = await q(`
    SELECT n.nspname AS schema, p.proname AS fn, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef=true
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
        WHERE c LIKE 'search_path=%'
      )
    ORDER BY 2;`);

  // 7) Views em public com SECURITY DEFINER (bypass de RLS do chamador)
  out["7_security_definer_views"] = await q(`
    SELECT c.relname AS view
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v'
      AND EXISTS (SELECT 1 FROM unnest(coalesce(c.reloptions, ARRAY[]::text[])) o WHERE o LIKE 'security_barrier%' OR o LIKE 'security_invoker%')=false
      AND pg_get_viewdef(c.oid) ILIKE '%security_definer%'
    ORDER BY 1;`);

  // 8) Colunas potencialmente sensíveis com grant a anon
  out["8_sensitive_columns_readable_anon"] = await q(`
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.role_column_grants g
      ON g.table_schema=c.table_schema AND g.table_name=c.table_name AND g.column_name=c.column_name
    WHERE c.table_schema='public' AND g.grantee='anon' AND g.privilege_type='SELECT'
      AND (
        c.column_name ILIKE '%password%' OR c.column_name ILIKE '%secret%' OR
        c.column_name ILIKE '%token%' OR c.column_name ILIKE '%api_key%' OR
        c.column_name ILIKE '%private_key%' OR c.column_name ILIKE '%cpf%' OR
        c.column_name ILIKE '%cnpj%' OR c.column_name ILIKE '%phone%' OR
        c.column_name ILIKE '%email%'
      )
    ORDER BY 1, 2;`);

  // 9) Colunas user_id nulláveis em tabelas com policies baseadas em auth.uid()
  out["9_nullable_user_id_in_rls_tables"] = await q(`
    SELECT DISTINCT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.is_nullable='YES'
      AND c.column_name IN ('user_id','owner_id')
      AND EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname='public' AND p.tablename=c.table_name
          AND (p.qual ILIKE '%auth.uid()%' OR p.with_check ILIKE '%auth.uid()%')
      )
    ORDER BY 1, 2;`);

  // 10) Extensões instaladas no schema public (má prática)
  out["10_extensions_in_public"] = await q(`
    SELECT e.extname
    FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE n.nspname='public' AND e.extname NOT IN ('plpgsql')
    ORDER BY 1;`);

  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
