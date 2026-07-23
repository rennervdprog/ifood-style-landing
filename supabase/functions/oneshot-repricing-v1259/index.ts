// Aplica no Supabase EXTERNO: atualiza RPCs register_as_lojista + handle_new_user
// (defaults 180→89.90, 239.90→199.90) e baixa mensalidade das 6 lojas legado Essencial R$180 → R$89,90.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const sb = createClient(URL, KEY);

  const results: any = {};

  // 1) Pega source atual das duas RPCs
  const { data: procs, error: pErr } = await sb.rpc("exec_sql", {
    sql: `select proname, pg_get_functiondef(oid) as def from pg_proc where proname in ('register_as_lojista','handle_new_user')`,
  });
  if (pErr) return new Response(JSON.stringify({ step: "read_procs", error: pErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  // 2) Substitui literais nas RPCs e recria via exec_sql
  const patched: any[] = [];
  for (const p of (procs as any[]) || []) {
    let def: string = p.def;
    const before = def;
    // Só troca ocorrências dos números antigos usados como fee (evita quebrar cast/threshold)
    def = def
      .replace(/\b180(\.0+)?\b(?=[^0-9])/g, "89.90")
      .replace(/\b239\.9(0)?\b/g, "199.90");
    if (def !== before) {
      const { error: eErr } = await sb.rpc("exec_sql", { sql: def });
      patched.push({ proname: p.proname, applied: !eErr, error: eErr?.message });
    } else {
      patched.push({ proname: p.proname, applied: false, reason: "no_literal_found" });
    }
  }
  results.rpcs = patched;

  // 3) Baixa mensalidade das lojas Essencial legado que ainda pagam R$180
  const { data: legacy, error: lErr } = await sb
    .from("store_plans")
    .update({ monthly_fee: 89.90, updated_at: new Date().toISOString() })
    .eq("plan_type", "fixed")
    .eq("monthly_fee", 180)
    .select("id, store_id");
  results.legacy_essencial_updated = { count: legacy?.length ?? 0, error: lErr?.message, ids: legacy };

  // 4) Autonomia legado (se houver alguma pagando 239.90)
  const { data: aut, error: aErr } = await sb
    .from("store_plans")
    .update({ monthly_fee: 199.90, updated_at: new Date().toISOString() })
    .eq("plan_type", "autonomy")
    .eq("monthly_fee", 239.90)
    .select("id, store_id");
  results.legacy_autonomy_updated = { count: aut?.length ?? 0, error: aErr?.message, ids: aut };

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});