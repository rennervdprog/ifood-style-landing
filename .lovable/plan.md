## Objetivo
Quando a loja for **PDV Standalone** (`plan_type = 'pdv_only'`), o painel do lojista precisa parecer um sistema de PDV — sem termos de "delivery", "entrega", "pedidos online", "motoboy", "vitrine", "cliente do app" espalhados pela UI — e o layout deve priorizar o Caixa/PDV como tela principal.

## Escopo (apenas frontend)

### 1. Landing do painel = Caixa/PDV
- Em `AdminDashboardV2.tsx`, quando `isPdvOnly`:
  - `defaultTab` = `cash_register` (hoje cai em `dashboard`/`orders`).
  - Grupo inicial do bottom nav = **Pedidos → PDV/Caixa**.
  - Esconder o card "Pedidos do dia / Delivery" da `DashboardOverviewSection` e trocar por card "Vendas do caixa hoje" (só leitura de `pdv_sales`).

### 2. Textos e rótulos condicionais
Substituir strings quando `isPdvOnly === true`:
| Onde | Texto atual (delivery) | Texto PDV |
|---|---|---|
| AppHeader / título painel | "Painel do Lojista" | "Painel PDV" |
| Aba "Pedidos" | "Pedidos" | "Vendas" |
| GlanceCard "Pedidos hoje" | idem | "Vendas hoje" |
| SettingsTab seção entrega | ocultar bloco inteiro | — |
| SubscriptionTab / PlanFeeBreakdown | "R$ X por pedido entregue" | "Mensalidade PDV R$ 69, sem taxa por venda" |
| RepasseSection | ocultar (já feito via `hideOnPdvOnly`) | — |
| AvisosSection | filtrar avisos com `category='delivery'` | — |
| Onboarding tips / tutoriais | esconder cards de "Configurar entrega/raio/motoboy" | mostrar só trilha PDV |

### 3. Sub-tabs a esconder (revisar `constants.ts`)
Já marcadas com `hideOnPdvOnly`: `orders`, `refunds`, `promotions`, `clients`, `loyalty`, `coupons`, `hours`, `drivers`, `repasse`, `reports`. Confirmar e adicionar as faltantes:
- `avisos` → manter, mas filtrar conteúdo.
- Grupo **Clientes** inteiro: se todas as sub-tabs sumirem, esconder o grupo no bottom nav e no sheet "Mais".
- Grupo **Operação** idem (fica vazio sem `hours`/`drivers`).

### 4. Configurações (`SettingsTab`)
Ocultar blocos quando `isPdvOnly`:
- Raio de entrega, taxa de entrega, tempo de preparo delivery.
- Integrações WhatsApp de pedido online → manter só "notificações internas".
- Aceitar pedidos online / pausar loja no app → esconder (loja nem aparece no marketplace).
- Manter: dados fiscais, impressora, gaveta, atalhos PDV, usuários operadores.

### 5. Cardápio (`MenuTab` / `MenuBuilder`)
- Esconder switches "Disponível no delivery", "Foto obrigatória para app", "Descrição p/ vitrine".
- Rótulo do preço: "Preço no PDV" em vez de "Preço no cardápio".
- Esconder aba **Promoções** (já hideOnPdvOnly) e badge "Aparece no app".

### 6. Meu Plano (`SubscriptionTab` + `StoreAddonsPanel`)
- Mostrar plano como "PDV Standalone — R$ 69/mês".
- Esconder linhas "Taxa por pedido entregue", "Repasse semanal", "Split Asaas por venda online".
- StoreAddonsPanel: manter PDV (marcado como incluso no plano, sem botão ativar/cancelar).

### 7. Header/menu do cliente
- `PartnerClientView`: se o `profile.role === 'lojista'` e a loja dele é `pdv_only`, esconder o próprio link "Voltar como cliente" e não sugerir /admin com ícone "Delivery". Trocar ícone/label para "Painel PDV".

## Implementação técnica
- Criar util `isPdvOnlyStore(plan)` em `src/lib/plansInfo.ts` (já existe algo similar; consolidar).
- Propagar `isPdvOnly` via `AdminContext` para não recomputar em cada tab.
- Cada tab lê `useAdminContext().isPdvOnly` e faz early-return / conditional render.
- Zero mudança em backend, migrations ou lógica de billing.

## Fora de escopo
- Não mexer em edge functions, RLS, cobrança.
- Não remover código de delivery — apenas ocultar por flag (loja pode migrar de plano depois).
- Não redesenhar componentes; só condicionar textos/blocos.

## Entregáveis
1. Patch em ~10 arquivos de UI (`AdminDashboardV2`, `AdminContext`, `constants.ts`, `SettingsTab`, `MenuTab`/`MenuBuilder`, `SubscriptionTab`, `PlanFeeBreakdown`, `DashboardOverviewSection`, `GlanceCard`, `PartnerClientView`).
2. Bump de versão (patch) conforme regra do projeto.
3. Teste manual: abrir loja PDV → painel abre no Caixa, sem qualquer menção a entrega/motoboy/vitrine.