const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sql = `
    -- 1) Essencial (fixed) → R$ 89,90 e descrição atualizada
    UPDATE public.plan_templates
      SET monthly_fee = 89.90,
          description = 'Plano fixo mensal com todas as funcionalidades. Ideal para lojas com faturamento previsível.'
      WHERE plan_type = 'fixed';

    -- 2) Autonomia → R$ 199,90 (cobrada apenas quando GMV ≥ R$ 2.500 no mês)
    UPDATE public.plan_templates
      SET monthly_fee = 199.90,
          description = 'Gratuito até R$ 2.500 de GMV/mês. Acima disso, mensalidade de R$ 199,90.'
      WHERE plan_type = 'autonomy';

    -- 3) Desativar planos legados que não são mais oferecidos
    UPDATE public.plan_templates SET is_active = false WHERE plan_type IN ('hybrid','commission_only');

    -- 4) Add-on PDV R$ 49 — criar template se não existir (usa colunas reais: plan_key, label)
    INSERT INTO public.plan_templates (plan_key, plan_type, label, monthly_fee, description, is_active, sort_order)
    SELECT 'pdv_addon', 'pdv_addon', 'PDV Add-on', 49.00,
           'Módulo PDV adicionado a um plano existente (Essencial ou Autonomia).', true, 50
    WHERE NOT EXISTS (SELECT 1 FROM public.plan_templates WHERE plan_key = 'pdv_addon' OR plan_type = 'pdv_addon');

    -- 5) admin_settings.plan_prices — sincronizar com os novos valores
    UPDATE public.admin_settings
      SET value = jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(value, '{fixed,monthly_fee}', '89.90'::jsonb, false),
                '{fixed,upgrade_fee}', '89.90'::jsonb, false),
              '{autonomy,monthly_fee}', '199.90'::jsonb, false),
            '{pdv_addon,monthly_fee}', '49.00'::jsonb, true)
      WHERE key = 'plan_prices';

    -- 6) NÃO mexer em resellers.commission_rate — overrides (ex: RENAN2026 30%) podem ser intencionais.
    --    Apenas garantir default da coluna em 0.20 para novos cadastros.
    ALTER TABLE public.resellers ALTER COLUMN commission_rate SET DEFAULT 0.20;

    -- Snapshot final
    SELECT plan_key, plan_type, label, monthly_fee, is_active FROM public.plan_templates ORDER BY sort_order NULLS LAST, monthly_fee;
  `;
  const r = await q(sql);
  return new Response(JSON.stringify(r, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});

const _dead = `
  const r = await q(sql);
  return new Response(JSON.stringify(r, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});