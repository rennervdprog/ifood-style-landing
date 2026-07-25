const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};

  // 1) schema
  out.alter_threshold = await run(`ALTER TABLE public.plan_templates ADD COLUMN IF NOT EXISTS revenue_threshold NUMERIC NOT NULL DEFAULT 0;`);
  out.alter_platform_fee = await run(`ALTER TABLE public.plan_templates ADD COLUMN IF NOT EXISTS platform_fee_included BOOLEAN NOT NULL DEFAULT true;`);

  // 2) source of truth values
  out.update_essencial = await run(`
    UPDATE public.plan_templates
    SET monthly_fee=89.90,
        revenue_threshold=5000,
        platform_fee_included=true,
        commission_rate=0,
        label='Essencial',
        description='Grátis até R$ 5.000/mês em vendas. Após, R$ 89,90/mês + R$ 0,99 por entrega da plataforma.',
        features='["Cardápio digital","Pedidos online","PIX Online","Fidelidade","Banners","Relatórios","Cupons ilimitados","Grátis até R$ 5.000/mês","Taxa da plataforma R$ 0,99/entrega"]'::jsonb,
        is_active=true,
        updated_at=now()
    WHERE plan_key='fixed';
  `);

  out.update_autonomy = await run(`
    UPDATE public.plan_templates
    SET monthly_fee=199.90,
        revenue_threshold=2500,
        platform_fee_included=false,
        commission_rate=0,
        label='Autonomia',
        description='Grátis até R$ 2.500/mês em vendas. Após, R$ 199,90/mês sem taxa da plataforma. Apenas PIX online tem taxa de R$ 1,99/pedido.',
        features='["Sem comissão por pedido","Sem taxa de R$ 0,99 da plataforma","Você fica com 100% da taxa de entrega","Apenas PIX online: R$ 1,99/pedido","Todas as ferramentas","Grátis até R$ 2.500/mês"]'::jsonb,
        is_active=true,
        updated_at=now()
    WHERE plan_key='autonomy';
  `);

  out.upsert_pdv = await run(`
    INSERT INTO public.plan_templates (plan_key, plan_type, label, description, monthly_fee, commission_rate, revenue_threshold, platform_fee_included, features, sort_order, is_active)
    VALUES ('pdv_only','pdv_only','PDV Only',
      'PDV completo para lojas físicas. R$ 69,00/mês sem taxa de plataforma nem comissão.',
      69.00, 0, 0, false,
      '["PDV completo","Impressão térmica","Comandas e mesas","Relatórios Z","Múltiplos operadores","Sem taxa de plataforma"]'::jsonb,
      5, true)
    ON CONFLICT (plan_key) DO UPDATE
    SET monthly_fee=EXCLUDED.monthly_fee,
        commission_rate=EXCLUDED.commission_rate,
        revenue_threshold=EXCLUDED.revenue_threshold,
        platform_fee_included=EXCLUDED.platform_fee_included,
        description=EXCLUDED.description,
        features=EXCLUDED.features,
        is_active=true,
        updated_at=now();
  `);

  // 3) deactivate legacy plans (no new signups)
  out.deactivate_legacy = await run(`UPDATE public.plan_templates SET is_active=false, updated_at=now() WHERE plan_key IN ('hybrid','supporter');`);

  // 4) admin RPC
  out.create_rpc = await run(`
    CREATE OR REPLACE FUNCTION public.admin_update_plan_template(
      p_id uuid,
      p_monthly_fee numeric,
      p_revenue_threshold numeric,
      p_commission_rate numeric,
      p_description text,
      p_platform_fee_included boolean
    )
    RETURNS public.plan_templates
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_row public.plan_templates;
    BEGIN
      IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'not authorized';
      END IF;
      UPDATE public.plan_templates
      SET monthly_fee = p_monthly_fee,
          revenue_threshold = p_revenue_threshold,
          commission_rate = p_commission_rate,
          description = p_description,
          platform_fee_included = p_platform_fee_included,
          updated_at = now()
      WHERE id = p_id
      RETURNING * INTO v_row;
      RETURN v_row;
    END;
    $$;
  `);
  out.grant_rpc = await run(`GRANT EXECUTE ON FUNCTION public.admin_update_plan_template(uuid,numeric,numeric,numeric,text,boolean) TO authenticated;`);

  // 5) verify
  out.verify = await run(`SELECT plan_key, label, monthly_fee, commission_rate, revenue_threshold, platform_fee_included, is_active FROM public.plan_templates ORDER BY sort_order;`);

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});