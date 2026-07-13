import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);
  const { data: store, error: se } = await sb.from("stores").select("id,name").ilike("name", "%pastel%carioca%").maybeSingle();
  if (se || !store) return new Response(JSON.stringify({ error: "store not found", se }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
  const { data: existing } = await sb.from("store_balances").select("store_id").eq("store_id", store.id).maybeSingle();
  let res;
  if (existing) {
    res = await sb.from("store_balances").update({ repasse_pendente: 56 }).eq("store_id", store.id).select().single();
  } else {
    res = await sb.from("store_balances").insert({ store_id: store.id, repasse_pendente: 56, comissao_pendente: 0 }).select().single();
  }
  return new Response(JSON.stringify({ store, result: res }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});