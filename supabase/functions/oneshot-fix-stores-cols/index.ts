const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const out: Record<string, unknown> = {};
  out["before"] = await q(`SELECT grantee, privilege_type, column_name FROM information_schema.column_privileges WHERE table_schema='public' AND table_name='stores' AND column_name IN ('asaas_wallet_id','asaas_activation_status','asaas_account_id','asaas_documents_sent','status') ORDER BY grantee, column_name;`);
  out["table_grants"] = await q(`SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='stores' ORDER BY grantee, privilege_type;`);
  out["fix"] = await q(`GRANT SELECT (asaas_wallet_id, asaas_activation_status, asaas_account_id, asaas_documents_sent) ON public.stores TO authenticated;`);
  out["after"] = await q(`SELECT grantee, privilege_type, column_name FROM information_schema.column_privileges WHERE table_schema='public' AND table_name='stores' AND column_name IN ('asaas_wallet_id','asaas_activation_status','asaas_account_id','asaas_documents_sent') ORDER BY grantee, column_name;`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
