import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const c = createClient(Deno.env.get("EXTERNAL_SUPABASE_URL")!, Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!);
  const uid = "b02921c3-3aa5-421c-915d-772390225bf2";
  const keep = "a001a767-f087-418b-a7ab-cb7a900fee0d";
  // Unlink other stores from this owner so only E2E Boutique remains
  const upd = await c.from("stores").update({ owner_id: null }).eq("owner_id", uid).neq("id", keep).select("id,name");
  const after = await c.from("stores").select("id,name,store_type,plan_type").eq("owner_id", uid);
  return new Response(JSON.stringify({ unlinked: upd, after: after.data }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
