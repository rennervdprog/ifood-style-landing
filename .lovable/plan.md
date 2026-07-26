# Plano — Unificar UX de Repasses do lojista

Objetivo: eliminar divergências textuais, visuais e de cálculo na seção de Repasses do painel do lojista, com base na auditoria Playwright + leitura dos componentes.

## 1. Nomenclatura única
- Termo padrão de topo: **"Repasse"** (o que o lojista deve à plataforma).
- Sub-rótulos permitidos apenas em detalhamento: "Comissão do plano", "Taxa operacional (R$ 0,99)", "PDV", "Split de entrega".
- Renomear títulos em `CommissionAlert`, `PlatformSplitAlert`, `RepassePendingCharges`, `ValorAPagarCard` para seguir o padrão.
- Renomear label do card "Cobrança PIX gerada" → "Repasse — pagamento via PIX".

## 2. Fonte única de valor pendente
- Criar hook `usePendingRepasse(storeId)` retornando `{ total, breakdown: { comissao, taxaOperacional, pdv, splitEntrega }, hasPendingCharge }`.
- Consumido por: `RepasseSection`, `CommissionAlert`, `PlatformSplitAlert`, `ValorAPagarCard`, badge da sub-aba (`useRepassePending`).
- Refetch alinhado (30s em todos) para evitar valores divergentes na mesma tela.

## 3. Consolidar alerts duplicados
- Fundir `CommissionAlert` + `PlatformSplitAlert` em um único `<RepasseAlert variant="commission|split|fee" />`.
- Mesma estrutura: título, breakdown, prazo, botão "Gerar PIX", QR quando existir.

## 4. Sistema de cores semântico
- Âmbar (`amber-500/10`): pendência aberta.
- Vermelho (`red-500/10`): bloqueio iminente/ativo (≥ R$ 500 ou após prazo).
- Verde: quitado / sem pendência.
- Azul apenas para informativos neutros ("Próximo repasse previsto").
- Aplicar em todos os cards da seção.

## 5. Regras de prazo em fonte única
- Criar `src/lib/repasseRules.ts` exportando `{ SUSPENSION_DAYS, BLOCK_THRESHOLD_BRL, ... }`.
- Corrigir divergência atual: **3 dias** (CommissionAlert) vs **30 dias** (PlatformFeeExplainerCard). Definir com o usuário qual é a regra real (sugestão: 7 dias) e usar em todos os textos + tooltip único "Como funcionam as cobranças".

## 6. Hierarquia visual da RepasseSection
Nova ordem (mais urgente → informativo):
1. `RepassePendingCharges` (se houver cobrança PIX ativa) — topo, destaque máximo.
2. `RepasseAlert` (se houver saldo acumulado sem cobrança emitida).
3. Card "Próximo repasse previsto" (informativo).
4. Card "Plano ativo" (contexto).
5. Histórico de cobranças.

## 7. Modal do PlatformSplitAlert
- Remover modal bloqueante quando já existe alerta inline na mesma tela.
- Manter modal só quando o lojista tenta usar função crítica com repasse ≥ threshold.

## 8. Detalhes técnicos
- Arquivos a criar: `src/hooks/usePendingRepasse.ts`, `src/lib/repasseRules.ts`, `src/components/repasse/RepasseAlert.tsx`.
- Arquivos a editar: `RepasseSection.tsx`, `RepassePendingCharges.tsx`, `CommissionAlert.tsx` (remover), `PlatformSplitAlert.tsx` (remover), `PlatformFeeExplainerCard.tsx`, `ValorAPagarCard.tsx`, `useRepassePending.ts`.
- Sem mudança de schema no banco.
- Bump de versão ao final (patch).

## Fora de escopo
- Mudanças no fluxo de cobrança/geração de PIX (Asaas).
- Regras de acúmulo no backend (já auditadas em v1.26.9).

## Decisão pendente
Qual prazo real de suspensão usar: **3, 7 ou 30 dias**?
