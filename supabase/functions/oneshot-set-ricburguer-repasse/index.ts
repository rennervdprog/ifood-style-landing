import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);
  const out: Record<string, unknown> = {};

  // zera Pastelão Carioca
  const { data: pastel } = await sb.from("stores").select("id,name").ilike("name", "%pastel%carioca%").maybeSingle();
  if (pastel) {
    out.pastelao = await sb.from("store_balances").update({ repasse_pendente: 0 }).eq("store_id", pastel.id).select().maybeSingle();
  }

  // aplica 89 na Ric Burguer
  let { data: ric } = await sb.from("stores").select("id,name").eq("slug", "ricburguer").maybeSingle();
  if (!ric) {
    const r = await sb.from("stores").select("id,name").ilike("name", "%ric%burguer%").maybeSingle();
    ric = r.data;
  }
  if (!ric) return new Response(JSON.stringify({ error: "ricburguer not found", out }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });

  const { data: existing } = await sb.from("store_balances").select("store_id").eq("store_id", ric.id).maybeSingle();
  out.ricburguer = existing
    ? await sb.from("store_balances").update({ repasse_pendente: 178 }).eq("store_id", ric.id).select().single()
    : await sb.from("store_balances").insert({ store_id: ric.id, repasse_pendente: 178, comissao_pendente: 0 }).select().single();

  return new Response(JSON.stringify({ pastel, ric, out }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
