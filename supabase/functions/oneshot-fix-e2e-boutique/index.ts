import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const svc = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const c = createClient(url, svc);
  const sid = "a001a767-f087-418b-a7ab-cb7a900fee0d";
  const r1 = await c.from("stores").update({ store_type: "apparel", plan_type: "pdv_only", is_visible: false }).eq("id", sid).select("id,store_type,plan_type").maybeSingle();
  const r2 = await c.from("store_plans").update({ plan_type: "pdv_only" }).eq("store_id", sid).select("plan_type").maybeSingle();
  return new Response(JSON.stringify({ store: r1, plan: r2 }), { headers: { ...cors, "Content-Type": "application/json" } });
});