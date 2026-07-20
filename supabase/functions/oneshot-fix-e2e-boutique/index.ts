import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const svc = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const c = createClient(url, svc);
  const sid = "a001a767-f087-418b-a7ab-cb7a900fee0d";
  const r1 = await c.from("stores").update({ store_type: "apparel", plan_type: "pdv_only", is_visible: false }).eq("id", sid).select("id,store_type,plan_type").maybeSingle();
  const existing = await c.from("store_plans").select("id,plan_type,is_active").eq("store_id", sid);
  let plan;
  if ((existing.data || []).length === 0) {
    plan = await c.from("store_plans").insert({ store_id: sid, plan_type: "pdv_only", monthly_fee: 69, commission_rate: 0, is_active: true, started_at: new Date().toISOString() }).select().maybeSingle();
  } else {
    plan = await c.from("store_plans").update({ plan_type: "pdv_only", is_active: true }).eq("store_id", sid).select();
  }
  return new Response(JSON.stringify({ store: r1, existing, plan }), { headers: { ...cors, "Content-Type": "application/json" } });
});