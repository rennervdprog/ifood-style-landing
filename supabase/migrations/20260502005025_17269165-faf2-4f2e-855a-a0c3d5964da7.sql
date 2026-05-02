-- Plan templates managed by admin (replaces hardcoded values in frontend)
CREATE TABLE IF NOT EXISTS public.plan_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_key text NOT NULL UNIQUE,
  plan_type text NOT NULL,
  label text NOT NULL,
  description text,
  monthly_fee numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_slots integer,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plan templates"
  ON public.plan_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin can manage plan templates"
  ON public.plan_templates FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_plan_templates_updated
  BEFORE UPDATE ON public.plan_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.plan_templates (plan_key, plan_type, label, description, monthly_fee, commission_rate, features, max_slots, sort_order)
VALUES
  ('supporter', 'fixed', 'Apoiadores', 'R$ 130/mês vitalício • Apenas 10 vagas • Todas as funcionalidades', 130, 0,
   '["Preço vitalício R$130","Sem comissão","Tudo incluso","PIX, Fidelidade, Banners","Apenas 10 vagas"]'::jsonb, 10, 1),
  ('fixed', 'fixed', 'Essencial', 'Mensalidade fixa, sem comissão, funcionalidades básicas', 180, 0,
   '["Cardápio digital","Pedidos online","Dinheiro/Cartão","Até 3 cupons"]'::jsonb, NULL, 2),
  ('hybrid', 'hybrid', 'Crescimento', 'Mensalidade + taxa por pedido, todas funcionalidades', 100, 2.5,
   '["Tudo do Fixo +","PIX Online","Entrega plataforma*","Fidelidade","Banners","Relatórios completos","Cupons ilimitados"]'::jsonb, NULL, 3),
  ('commission_only', 'commission_only', 'Comissão', 'Apenas comissão por pedido, todas funcionalidades', 0, 6,
   '["Tudo do Híbrido","Sem mensalidade"]'::jsonb, NULL, 4)
ON CONFLICT (plan_key) DO NOTHING;