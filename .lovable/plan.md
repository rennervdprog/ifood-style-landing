# Correção: PDV Only sem acesso a "Meu Plano" / Mensalidades

## Diagnóstico
- `AdminDashboardV2.tsx` (linha 1622-1627): quando `plan_type = pdv_only`, o lojista é **redirecionado à força** para `/admin/pdv`, perdendo qualquer acesso às abas `subscription`, `finance` e `repasse`.
- `PdvPage` (`PdvTabs.tsx`) só tem 5 abas operacionais: Vender, Mesas, Histórico, Turnos, Relatórios. Não há entrada para "Meu Plano" nem para "Mensalidades".
- Resultado: lojista PDV Only nunca vê seu plano, valor, próximo vencimento, cobranças em aberto/pagas, nem consegue trocar de plano ou baixar histórico.

## Objetivo
Dar ao PDV Only acesso completo a **Meu Plano** (StoreSubscription) e **Relatório de Mensalidades**, sem devolvê-lo ao dashboard de delivery.

## Escopo da mudança

### 1. Novo tipo de aba no PDV
- `src/pages/pdv/types.ts`: adicionar `"meu_plano"` ao `PdvTab`.
- `src/pages/pdv/components/PdvTabs.tsx`: adicionar aba "Meu Plano" (ícone `CreditCard`), visível apenas quando `isPdvOnly` (prop nova). Para não-PDV a barra continua igual.

### 2. Renderização do conteúdo
- `src/pages/PdvPage.tsx`:
  - Passar `isPdvOnly` para `<PdvTabs>` (via `useStorePlan`).
  - Ao renderizar `tab === "meu_plano"`, montar uma tela com duas sub-seções (Tabs shadcn):
    - **Plano** → reaproveita `<StoreSubscription store={store} />`.
    - **Mensalidades** → nova sub-view listando cobranças de `financial_transactions` da loja (mesma query já usada em `RepasseSection`, filtrando `type in ('monthly_fee','plan_addon','pdv_addon')`), com colunas: competência, descrição, valor, status, data de pagamento, link do boleto/pix quando existir. Reaproveitar componente/hook do repasse quando possível para não duplicar.
  - Fora do PDV Only, essa aba não aparece.

### 3. Ajuste da tela pré-caixa
- `PdvAberturaScreen.tsx` (quando não há caixa aberto e a loja é PDV Only): adicionar terceiro botão "Meu Plano" ao lado de "Abrir caixa" / "Ver relatórios", chamando `setTab("meu_plano")`. Assim funciona mesmo sem sessão de PDV.

### 4. Menu do super-admin / navegação
- Nenhuma mudança em `AdminDashboardV2` — o redirect continua (o painel de delivery não faz sentido pra PDV Only). Toda a experiência de plano/mensalidade passa a viver **dentro** do `/admin/pdv`.

### 5. Segurança
- Reuso de `StoreSubscription` (já protegida por `useStorePlan` + policies de `store_plans`) e queries já existentes em `financial_transactions` (RLS por `store_id = auth store`). Nenhuma nova policy/GRANT necessário.
- Confirmar que a query de mensalidades roda pelo Data API com o `store_id` do lojista logado (sem service role).

## Fora de escopo
- Redesign da tela de Meu Plano.
- Novos meios de pagamento / cobrança.
- Mudanças em RLS ou edge functions.

## Versão
- Bump: `v1.20.14` (build 1042) após implementar.
