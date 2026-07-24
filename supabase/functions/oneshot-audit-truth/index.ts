import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};

  const plans = await sb.from("plan_templates").select("*").order("monthly_fee");
  out["plan_templates"] = plans.error ? plans.error.message : plans.data;

  const resellers = await sb.from("resellers").select("*");
  if (resellers.error) out["resellers"] = resellers.error.message;
  else {
    const rows = resellers.data || [];
    out["resellers_columns"] = rows[0] ? Object.keys(rows[0]) : [];
    out["resellers_sample"] = rows.slice(0, 3);
    out["resellers_count"] = rows.length;
  }

  const sp = await sb.from("store_plans").select("plan_type,monthly_fee,is_active").eq("is_active", true);
  if (sp.error) out["store_plans_active"] = sp.error.message;
  else {
    const agg: Record<string, { count: number; mrr: number }> = {};
    for (const r of sp.data || []) {
      const k = String(r.plan_type);
      agg[k] ||= { count: 0, mrr: 0 };
      agg[k].count++;
      agg[k].mrr += Number(r.monthly_fee || 0);
    }
    out["store_plans_active"] = agg;
  }

  const settings = await sb.from("admin_settings").select("key,value");
  out["admin_settings"] = settings.error ? settings.error.message : (settings.data || []).filter((s: any) => /bounty|commission|plan|reseller|mrr|gmv|fee/i.test(s.key));

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});