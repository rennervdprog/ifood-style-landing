# Plano — Limpeza cirúrgica pós-auditoria

Baseado nos achados da auditoria. Nada de lógica de negócio muda — só remoção de código morto, correção de textos e consolidação visual.

## Fase 1 — Deletar arquivos órfãos (risco zero)

Nenhum é importado/roteado hoje.

- `src/pages/SuperAdminDashboard.tsx` (3454 linhas — versão antiga; `V2` é o roteado)
- `src/components/OrderCard.tsx` (substituído por `AdminOrderCard`)
- `src/pages/CadastroEntregador.tsx` (rota `/cadastro-entregador` já faz redirect para `/cadastro-motoboy-loja`)

Antes de deletar cada um: `rg` final confirmando zero imports.

## Fase 2 — Corrigir textos incorretos

| Arquivo | Atual | Correto |
|---|---|---|
| `src/pages/revendedor/ResellerHome.tsx:171` | "Bônus de **R$ 150**" | "Bônus de **R$ 50**" |
| `src/pages/PoliticaPrivacidade.tsx:95` | cita "Mercado Pago" como operador | trocar por "**Asaas** (Asaas Gestão Financeira S.A.)" |
| `src/pages/Index.tsx:718` | rodapé "Desenvolvido por Lovable AI" | remover / trocar por texto ItaSuper |
| `src/lib/pixSimulation.ts:5,8` | comentários "Mercado Pago API" | atualizar para Asaas (só comentário) |

## Fase 3 — Consolidar `KpiCard` duplicado

Hoje o mesmo componente KPI está reimplementado ad-hoc em ~7 arquivos (`FinanceCharts`, `FinanceChartsCore`, `StoreFinancePanel`, `PlanosTab`, `SuperAdminDashboardV2`, `RevendedoresTab`, `PlatformWhatsAppHistory`).

Ação:
1. Criar `src/components/ui/KpiCard.tsx` com a API mais rica das versões atuais (icon, label, value, tone, opcional trend).
2. Substituir cada implementação local por import do novo componente.
3. Sem mudança visual — mesmos ícones/cores/tokens.

## Fase 4 — Extrair `PlanCard` compartilhado

`SubscriptionTab.tsx` (interno lojista) e `PlanosPage.tsx` (público) hoje renderizam cards de planos separadamente, cada um lendo de `plansInfo.ts` e formatando "R$ X/mês" manualmente. Risco real de dessincronia futura de preço/copy.

Ação: extrair `src/components/plans/PlanCard.tsx` consumido por ambos. Uma única fonte de renderização.

## Fase 5 — Validação

- `bun run build` limpo
- Smoke manual: `/super-admin`, `/planos`, `/revendedor`, `/politica-privacidade`, `/` (rodapé), aba Meu Plano do lojista
- Incrementar versão (patch) em `PerfilPage.tsx` + `android/app/build.gradle` (versionName + versionCode) — conforme regra do projeto

## Fora de escopo

- Não mexer em RLS, banco, edge functions ou lógica de cobrança
- Não redesenhar telas — só remover código morto e unificar componentes visualmente idênticos
- Não alterar `plansInfo.ts` (fonte da verdade já está correta)
