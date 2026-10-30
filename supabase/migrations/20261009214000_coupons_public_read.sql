-- Permite que o app cliente (chave anon) leia cupons ativos.
-- Sem isso, o fetchCoupon do app retorna vazio e nenhum cupom valida.
-- Somente leitura (SELECT); escrita continua restrita a admins/donos da loja.
DROP POLICY IF EXISTS "Public can view active coupons" ON public.coupons;

CREATE POLICY "Public can view active coupons"
ON public.coupons FOR SELECT
TO anon, authenticated
USING (is_active = true);
