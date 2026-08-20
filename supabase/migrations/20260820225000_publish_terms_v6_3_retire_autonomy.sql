-- Termos v6.3: retira Autonomia da oferta vigente e preserva explicitamente
-- as condições de eventuais lojas legadas já vinculadas ao plano.
-- Rascunho operacional: requer revisão jurídica antes de ser adotado como referência contratual.

BEGIN;

UPDATE public.legal_documents
SET is_current = false
WHERE kind = 'terms' AND is_current = true;

WITH prior_terms AS (
  SELECT content_md
  FROM public.legal_documents
  WHERE kind = 'terms'
  ORDER BY version_num DESC, created_at DESC
  LIMIT 1
),
new_terms AS (
  INSERT INTO public.legal_documents (
    kind, version, version_num, effective_date, content_md, summary, is_current
  )
  SELECT
    'terms',
    '6.3',
    630,
    '2026-08-20T00:00:00-03:00'::timestamptz,
    replace(
      replace(
        replace(
          replace(
            replace(
              content_md,
              '**Versão 6.2 — vigente a partir de 20 de agosto de 2026**',
              '**Versão 6.3 — vigente a partir de 20 de agosto de 2026**'
            ),
            E'| **Autonomia** | **R$ 199,90/mês** | Gratuito enquanto o faturamento acumulado no período de análise de **60 dias** permanecer até **R$ 2.500,00**. Após ultrapassar o limite, a mensalidade de R$ 199,90 poderá ser ativada com aviso prévio de 30 dias; **0% de comissão por pedido online**; ausência da taxa de R$ 0,99 na entrega; PIX Online com taxa operacional de **R$ 1,99 por pedido**; e PDV conforme módulo ou condição comercial da loja exibida no painel. |\n',
              ''
            ),
            '| **PDV Add-on** | **R$ 49,00/mês** | Módulo adicional de PDV integrado a plano principal compatível (Essencial ou Autonomia). O valor é adicionado à cobrança mensal enquanto o módulo estiver ativo. Lojas com condição histórica ou individual podem ter regra própria exibida no painel. |',
            '| **PDV Add-on** | **R$ 49,00/mês** | Módulo adicional de PDV integrado ao plano Essencial. O valor é adicionado à cobrança mensal enquanto o módulo estiver ativo. Lojas legadas ou com condição histórica ou individual podem ter regra própria exibida no painel. |'
          ),
          '### 6.2. Taxas operacionais e cobrança semanal',
          E'#### Descontinuação do Plano Autonomia\n\nA partir de **20 de agosto de 2026**, o Plano Autonomia deixa de ser disponibilizado para novas adesões e para novas solicitações voluntárias de mudança de plano. As lojas que já estiverem formalmente vinculadas ao Plano Autonomia antes dessa data mantêm as condições específicas previamente contratadas, enquanto a vinculação permanecer ativa, sem prejuízo das demais regras destes Termos, do painel financeiro e de eventual condição individual aplicável.\n\n### 6.2. Taxas operacionais e cobrança semanal'
        ),
        '**Última atualização:** 20 de agosto de 2026.',
        '**Última atualização:** 20 de agosto de 2026. Oferta de planos atualizada para Essencial e Somente PDV; Autonomia mantido apenas para vínculos legados existentes.'
      ),
    'Termos atualizados para refletir as ofertas vigentes Essencial e Somente PDV, descontinuar Autonomia para novas adesões e registrar a continuidade das condições de vínculos legados, além das regras já vigentes de gratuidade, taxas e cobrança semanal.',
    true
  FROM prior_terms
  RETURNING id
)
INSERT INTO public.legal_document_changes (document_id, section, change_type, summary, legal_basis, display_order)
SELECT id, section, change_type, summary, legal_basis, display_order
FROM (
  SELECT
    new_terms.id,
    'Ofertas vigentes e Plano Autonomia legado'::text AS section,
    'modified'::text AS change_type,
    'Removida a oferta do Plano Autonomia para novas adesões e novas migrações voluntárias. As condições de lojas já vinculadas ao plano continuam preservadas enquanto o vínculo permanecer ativo.'::text AS summary,
    'CDC, art. 6º, III; Código Civil, arts. 421 e 422'::text AS legal_basis,
    10 AS display_order
  FROM new_terms
  UNION ALL
  SELECT
    new_terms.id,
    'PDV Add-on'::text,
    'modified'::text,
    'Atualizada a descrição do PDV Add-on para a oferta vigente e esclarecida a preservação de condições históricas ou individuais exibidas no painel.'::text,
    'CDC, art. 6º, III',
    20
  FROM new_terms
) AS changes(id, section, change_type, summary, legal_basis, display_order);

COMMIT;
