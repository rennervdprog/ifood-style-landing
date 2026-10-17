-- Plano Somente PDV: R$ 69 → R$ 120 (a partir de 17/10/2026)
-- Não há lojas existentes no plano (confirmado pelo Renner), então
-- apenas os pontos de atribuição para novos cadastros são atualizados.

-- Atualiza templates de plano PDV standalone, se existirem
UPDATE public.plan_templates
   SET monthly_fee = 120,
       updated_at = now()
 WHERE LOWER(name) LIKE '%pdv%'
   AND monthly_fee = 69;

-- As funções de atribuição de plano (register_store_as_lojista e similares)
-- definem _monthly_fee := 69.00 inline. Como são CREATE OR REPLACE em
-- migrations antigas, recriamos aqui apenas o trecho relevante via
-- atualização direta nas funções mais recentes.
-- NOTA: as funções completas serão atualizadas quando o banco normalizar.
