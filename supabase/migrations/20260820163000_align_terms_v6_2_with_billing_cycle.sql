-- Termos v6.2: transparência operacional de planos, taxas e cobrança semanal.
-- A atualização é versionada para registrar o novo aceite do lojista no fluxo legal existente.

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
    '6.2',
    620,
    '2026-08-20T00:00:00-03:00'::timestamptz,
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                content_md,
                '**Versão 6.1 — vigente a partir de 17 de agosto de 2026**',
                '**Versão 6.2 — vigente a partir de 20 de agosto de 2026**'
              ),
              'Gratuito enquanto o faturamento mensal registrado permanecer até **R$ 5.000,00**. Após ultrapassar o limite, incide a mensalidade de R$ 89,90; **0% de comissão por pedido online**; taxa da plataforma de **R$ 0,99 por entrega**; e PDV de **R$ 1,00 por venda presencial** quando utilizado.',
              'Gratuito enquanto o faturamento acumulado no período de análise de **60 dias** permanecer até **R$ 5.000,00**. Após ultrapassar o limite, a mensalidade de R$ 89,90 poderá ser ativada com aviso prévio de 30 dias; **0% de comissão por pedido online**; taxa da plataforma de **R$ 0,99 por entrega** quando aplicável; e PDV conforme módulo ou condição comercial da loja exibida no painel.'
            ),
            'Gratuito enquanto o faturamento mensal registrado permanecer até **R$ 2.500,00**. Após ultrapassar o limite, incide a mensalidade de R$ 199,90; **0% de comissão por pedido online**; ausência da taxa de R$ 0,99 na entrega; PIX Online com taxa operacional de **R$ 1,99 por pedido**; e PDV de **R$ 1,00 por venda presencial** quando utilizado.',
            'Gratuito enquanto o faturamento acumulado no período de análise de **60 dias** permanecer até **R$ 2.500,00**. Após ultrapassar o limite, a mensalidade de R$ 199,90 poderá ser ativada com aviso prévio de 30 dias; **0% de comissão por pedido online**; ausência da taxa de R$ 0,99 na entrega; PIX Online com taxa operacional de **R$ 1,99 por pedido**; e PDV conforme módulo ou condição comercial da loja exibida no painel.'
          ),
          '| **PDV Add-on** | **R$ 49,00/mês** | Módulo adicional de PDV integrado a plano principal compatível (Essencial ou Autonomia). O valor é adicionado à cobrança mensal enquanto o módulo estiver ativo. |',
          '| **PDV Add-on** | **R$ 49,00/mês** | Módulo adicional de PDV integrado a plano principal compatível (Essencial ou Autonomia). O valor é adicionado à cobrança mensal enquanto o módulo estiver ativo. Lojas com condição histórica ou individual podem ter regra própria exibida no painel. |'
        ),
        '### 6.2. Alterações de preços, planos e regras comerciais',
        E'### 6.2. Taxas operacionais e cobrança semanal\n\nAlém da mensalidade, a loja pode ter taxas operacionais e comissões aplicáveis ao seu plano, à forma de pagamento e aos recursos utilizados. Esses valores podem incluir taxa de plataforma nas entregas, comissão do plano e custos de PDV. Os componentes e os valores aplicáveis são detalhados no painel financeiro da loja.\n\nEm vendas pagas em dinheiro, cartão na entrega ou PIX por maquininha, quando a loja recebe diretamente o valor do Pedido, os valores devidos à plataforma podem acumular em ciclos separados. Quando o saldo elegível de um ciclo atingir **R$ 150,00**, o ItaSuper poderá gerar uma cobrança PIX na segunda-feira seguinte. Cada ciclo de cobrança é independente e pode ter sua própria referência e prazo de pagamento.\n\nUma cobrança pendente por **30 dias** poderá bloquear a loja para novos Pedidos até a regularização. Saldo elegível de **R$ 500,00 ou mais** também poderá resultar em bloqueio antes desse prazo. Após a confirmação do pagamento, o sistema realizará a baixa financeira e reavaliará automaticamente a situação da loja. O lojista pode consultar valores, componentes, referências e histórico no painel financeiro.\n\n### 6.3. Alterações de preços, planos e regras comerciais'
      ),
      '**Última atualização:** 17 de agosto de 2026.',
      '**Última atualização:** 20 de agosto de 2026.'
    ),
    'Termos atualizados para esclarecer a gratuidade por período de análise, os valores de planos e o ciclo semanal de taxas, cobrança PIX e bloqueio de lojistas.',
    true
  FROM prior_terms
  RETURNING id
)
INSERT INTO public.legal_document_changes (document_id, section, change_type, summary, legal_basis, display_order)
SELECT id, section, change_type, summary, legal_basis, display_order
FROM (
  SELECT new_terms.id,
         'Planos, gratuidade e taxas operacionais'::text AS section,
         'modified'::text AS change_type,
         'Alinhada a informação de gratuidade ao período de análise de 60 dias, com valores de mensalidade, taxa de entrega e condições de PDV apresentadas de forma mais clara.'::text AS summary,
         'CDC, art. 6º, III; Decreto nº 7.962/2013, arts. 2º e 4º'::text AS legal_basis,
         10 AS display_order
  FROM new_terms
  UNION ALL
  SELECT new_terms.id,
         'Cobrança semanal de taxas e comissões',
         'added',
         'Explicado o ciclo de cobrança PIX: mínimo de R$ 150,00, ciclos separados, bloqueio por saldo de R$ 500,00 ou mais e bloqueio após 30 dias de pendência.',
         'CDC, art. 6º, III; Código Civil, arts. 421 e 422',
         20
  FROM new_terms
) AS changes(id, section, change_type, summary, legal_basis, display_order);

COMMIT;
