import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const c = createClient(Deno.env.get("EXTERNAL_SUPABASE_URL")!, Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!);
  const email = "e2e-admin@itasuper.test";
  const { data: users } = await c.auth.admin.listUsers();
  const u = users?.users?.find((x:any)=>x.email===email);
  const sid = "a001a767-f087-418b-a7ab-cb7a900fee0d";
  const store = await c.from("stores").select("*").eq("id", sid).maybeSingle();
  const plans = await c.from("store_plans").select("*").eq("store_id", sid);
  const ownerStores = u ? await c.from("stores").select("id,name,store_type,plan_type,owner_id").eq("owner_id", u.id) : null;
  const roles = u ? await c.from("user_roles").select("*").eq("user_id", u.id) : null;
  return new Response(JSON.stringify({ user_id: u?.id, store: store.data, plans: plans.data, ownerStores: ownerStores?.data, roles: roles?.data }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
