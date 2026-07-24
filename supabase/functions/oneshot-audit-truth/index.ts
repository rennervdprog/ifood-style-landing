import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};

  const plans = await sb.from("plan_templates").select("name,plan_type,monthly_fee,is_active").order("monthly_fee");
  out["plan_templates"] = plans.error ? plans.error.message : plans.data;

  const resellers = await sb.from("resellers").select("bounty_amount_cents,commission_rate_bps,min_withdraw_cents,min_delivered_orders_for_bounty,status");
  if (resellers.error) out["resellers"] = resellers.error.message;
  else {
    const rows = resellers.data || [];
    const bounties: Record<string, number> = {};
    const rates: Record<string, number> = {};
    const statuses: Record<string, number> = {};
    let minB = Infinity, maxB = -Infinity;
    for (const r of rows) {
      const b = Number(r.bounty_amount_cents || 0);
      bounties[b] = (bounties[b] || 0) + 1;
      rates[Number(r.commission_rate_bps || 0)] = (rates[Number(r.commission_rate_bps || 0)] || 0) + 1;
      statuses[String(r.status)] = (statuses[String(r.status)] || 0) + 1;
      if (b < minB) minB = b;
      if (b > maxB) maxB = b;
    }
    out["resellers_summary"] = {
      total: rows.length,
      bounty_min_cents: rows.length ? minB : null,
      bounty_max_cents: rows.length ? maxB : null,
      bounty_distribution: bounties,
      commission_rate_bps_distribution: rates,
      status_distribution: statuses,
      sample_min_withdraw_cents: rows[0]?.min_withdraw_cents ?? null,
      sample_min_delivered_orders: rows[0]?.min_delivered_orders_for_bounty ?? null,
    };
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