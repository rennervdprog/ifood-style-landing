import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);

  const { data: store } = await sb.from("stores").select("id,name").ilike("name", "%pastel%carioca%").maybeSingle();
  if (!store) return new Response(JSON.stringify({ error: "store not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });

  // Localiza cobrança pendente ~ R$ 5,25
  const { data: charges } = await sb
    .from("financial_transactions")
    .select("id, amount, status, reference_code, created_at")
    .eq("store_id", store.id)
    .eq("transaction_kind", "commission_charge")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const target = (charges || []).find((c: any) => Math.abs(Number(c.amount) - 5.25) < 0.01)
    || (charges || [])[0];

  if (!target) {
    return new Response(JSON.stringify({ store, message: "no pending charge", charges }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  const upd = await sb
    .from("financial_transactions")
    .update({ status: "cancelled", metadata: { cancelled_by: "admin_oneshot", cancelled_at: new Date().toISOString() } })
    .eq("id", target.id)
    .select()
    .single();

  return new Response(JSON.stringify({ store, cancelled: upd.data, error: upd.error, others: charges }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});