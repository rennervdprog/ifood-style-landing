import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;

  let { data: ric } = await sb.from("stores").select("id,name").eq("slug", "ricburguer").maybeSingle();
  if (!ric) ric = (await sb.from("stores").select("id,name").ilike("name", "%ric%burguer%").maybeSingle()).data;
  if (!ric) return j({ error: "ricburguer not found" }, 404);

  const { data: txs, error } = await sb
    .from("financial_transactions")
    .select("*")
    .eq("store_id", ric.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return j({ error: error.message }, 500);

  const pending = (txs || []).filter((t: any) =>
    ["pending", "PENDING", "aguardando", "awaiting_payment"].includes(String(t.status)) &&
    JSON.stringify(t).toLowerCase().includes("pay_")
  );

  if (dryRun) return j({ ric, count: txs?.length, pending });

  const ASAAS_KEY = Deno.env.get("ASAAS_API_KEY") || "";
  const ASAAS_BASE = (Deno.env.get("ASAAS_BASE_URL") || "https://api.asaas.com/v3").replace(/\/$/, "");
  const results: unknown[] = [];

  for (const t of pending) {
    const raw = JSON.stringify(t);
    const ids = [...new Set((raw.match(/pay_[A-Za-z0-9]+/g) || []))];
    for (const id of ids) {
      let asaas: unknown = "sem ASAAS_API_KEY";
      if (ASAAS_KEY) {
        const r = await fetch(`${ASAAS_BASE}/payments/${id}`, { method: "DELETE", headers: { access_token: ASAAS_KEY } });
        asaas = { status: r.status, body: await r.text().catch(() => "") };
      }
      results.push({ tx: t.id, payment_id: id, asaas });
    }
    await sb.from("financial_transactions").update({ status: "cancelled" }).eq("id", t.id);
  }

  return j({ ric, cancelled: pending.length, results });
});
