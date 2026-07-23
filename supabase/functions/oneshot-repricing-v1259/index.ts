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

  // Descobre nome do param do exec_sql (pode ser sql, query, _sql, _query)
  async function execSql(sql: string) {
    for (const key of ["sql", "query", "_sql", "_query", "p_sql"]) {
      const { data, error } = await sb.rpc("exec_sql", { [key]: sql });
      if (!error) return { data, error: null, key };
      if (!/Could not find the function/i.test(error.message)) return { data: null, error, key };
    }
    return { data: null, error: { message: "exec_sql RPC signature not found" }, key: null };
  }

  // 1) Pega source atual das duas RPCs
  const { data: procs, error: pErr } = await execSql(
    `select json_agg(json_build_object('proname', proname, 'def', pg_get_functiondef(oid))) as r from pg_proc where proname in ('register_as_lojista','handle_new_user')`
  );
  if (pErr) return new Response(JSON.stringify({ step: "read_procs", error: (pErr as any).message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  // exec_sql pode retornar o resultado bruto ou envelopado. Tenta desembrulhar.
  let rows: any[] = [];
  const raw: any = procs;
  if (Array.isArray(raw) && raw[0]?.r) rows = raw[0].r;
  else if (raw?.r) rows = raw.r;
  else if (Array.isArray(raw)) rows = raw;
  else if (typeof raw === "string") { try { rows = JSON.parse(raw); } catch {} }

  const patched: any[] = [];
  for (const p of rows) {
    let def: string = p.def;
    const before = def;
    def = def
      .replace(/\b180(\.0+)?\b(?=[^0-9])/g, "89.90")
      .replace(/\b239\.9(0)?\b/g, "199.90");
    if (def !== before) {
      const { error: eErr } = await execSql(def);
      patched.push({ proname: p.proname, applied: !eErr, error: (eErr as any)?.message });
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