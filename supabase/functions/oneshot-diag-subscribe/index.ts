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
Deno.serve(async () => {
  const store = 'b97f3a1a-d558-41e5-b8a2-ebd65b5381b4';
  const out: Record<string, unknown> = {};
  out.store = await q(`select id,name,owner_id from public.stores where id='${store}';`);
  out.plan = await q(`select id,plan_type,monthly_fee,trial_ends_at,last_billed_at,is_active from public.store_plans where store_id='${store}';`);
  out.pending_tx = await q(`select id,reference_code,status,amount,pix_copy_paste is not null as has_pix,created_at from public.financial_transactions where store_id='${store}' and status='pending' order by created_at desc limit 10;`);
  out.rpc = await q(`select proname, pronargs from pg_proc where proname='generate_financial_reference';`);
  out.profile = await q(`select p.user_id, p.full_name, p.email, p.document from public.profiles p join public.stores s on s.owner_id=p.user_id where s.id='${store}';`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});