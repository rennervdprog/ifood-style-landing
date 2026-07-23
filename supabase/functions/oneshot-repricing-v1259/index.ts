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

  const results: any = {
    note: "RPCs internas (register_as_lojista, handle_new_user) mantêm defaults antigos como fallback — a frontend agora passa _upgrade_monthly_fee explícito com 89.90/199.90.",
  };

  // Diagnóstico: lista todas as store_plans com fee alto pra ver o estado real
  const { data: peek } = await sb
    .from("store_plans")
    .select("id, store_id, plan_type, monthly_fee, is_active")
    .in("plan_type", ["fixed", "autonomy"])
    .gt("monthly_fee", 50);
  results.peek = peek;

  // Essencial legado (>=100 pra pegar tanto 180 quanto variantes)
  const { data: legacy, error: lErr } = await sb
    .from("store_plans")
    .update({ monthly_fee: 89.90, updated_at: new Date().toISOString() })
    .eq("plan_type", "fixed")
    .gte("monthly_fee", 150)
    .lte("monthly_fee", 250)
    .select("id, store_id, monthly_fee");
  results.legacy_essencial_updated = { count: legacy?.length ?? 0, error: lErr?.message, ids: legacy };

  // Autonomia legado (>=200 pra pegar 239.90)
  const { data: aut, error: aErr } = await sb
    .from("store_plans")
    .update({ monthly_fee: 199.90, updated_at: new Date().toISOString() })
    .eq("plan_type", "autonomy")
    .gte("monthly_fee", 220)
    .select("id, store_id, monthly_fee");
  results.legacy_autonomy_updated = { count: aut?.length ?? 0, error: aErr?.message, ids: aut };

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});