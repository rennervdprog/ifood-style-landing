-- Create app_links table for managing the public Linktree-style page
CREATE TABLE public.app_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Link',
  is_external BOOLEAN NOT NULL DEFAULT false,
  is_highlight BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_links ENABLE ROW LEVEL SECURITY;

-- Anyone can read active links (public Linktree page)
CREATE POLICY "Anyone can read active app_links"
ON public.app_links
FOR SELECT
USING (is_active = true);

-- Only platform admin can manage links
CREATE POLICY "Platform admin can manage app_links"
ON public.app_links
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Inline updated_at trigger function (scoped to this table)
CREATE OR REPLACE FUNCTION public.set_app_links_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_app_links_updated_at
BEFORE UPDATE ON public.app_links
FOR EACH ROW
EXECUTE FUNCTION public.set_app_links_updated_at();

-- Seed with current default links
INSERT INTO public.app_links (label, description, url, icon, is_external, is_highlight, sort_order) VALUES
('Fazer um Pedido', 'Veja todas as lojas disponíveis', '/', 'ShoppingBag', false, true, 10),
('Cadastrar minha Loja', 'Cadastro 100% grátis • Sem mensalidade', '/cadastro-lojista', 'Store', false, true, 20),
('Quero ser Entregador', 'Faça entregas e ganhe por corrida', '/cadastro-entregador', 'Bike', false, false, 30),
('Plano Apoiador (Vitalício)', 'Apoie o app por R$ 130 — apenas 10 vagas', '/planos', 'Heart', false, false, 40),
('Criar minha Conta', 'Acesse promoções e cupons exclusivos', '/auth', 'UserPlus', false, false, 50),
('Baixar o App', 'Disponível para Android', 'https://play.google.com/store/apps/details?id=app.lovable.e8d28aded6334d74be2161c8dbe24765', 'Smartphone', true, false, 60),
('Instagram @itasuper', NULL, 'https://instagram.com/itasuper', 'Instagram', true, false, 70),
('Falar no WhatsApp', 'Suporte e dúvidas', 'https://wa.me/5514998765432', 'MessageCircle', true, false, 80),
('Termos de Uso', NULL, '/termos-de-uso', 'FileText', false, false, 90),
('Política de Privacidade', NULL, '/politica-de-privacidade', 'Shield', false, false, 100);