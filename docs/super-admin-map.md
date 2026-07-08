# Mapa Funcional do Super Admin

Documento de referência da Fase 1 do plano em `.lovable/plan.md`.
Objetivo: registrar **o que cada aba/sub-aba do painel Super Admin faz**, de onde ela lê os dados e onde há sobreposição com outra tela. Não muda código — é a base para Fase 2 (padronização) e Fase 3 (correção).

> Arquivo raiz: `src/pages/SuperAdminDashboardV2.tsx`. Abas legadas (`pagamentos`, `saques`, `planos`, `socios`, `test_finance`, `cidades`, `entrega`, `links`, `logs`) são redirecionadas para as consolidadas via `useEffect` (linhas 166-185).

---

## 1. Estrutura atual (sidebar → sub-abas)

```text
Super Admin
├── Dashboard              (KPIs de vendas do período: hoje/ontem/7d)
├── Lojas                  (consolida Lojas + Cidades + Entrega)
│   ├── lojas              → AdminStoreManager
│   ├── cidades            → CidadesTab
│   └── entrega            → DeliveryFeeConfigPanel
├── Cupons                 → CouponManager
├── Financeiro             (consolida Pagamentos+Saques+Planos+Sócios+Teste)
│   ├── overview           → FinanceTabFull (SuperAdminDashboard.tsx)
│   ├── areceber           → AReceberTab
│   ├── mensalidades       → MensalidadesPanel  (embute PlanosTab dentro)
│   ├── historico          → HistoricoRepassesTab
│   ├── fluxo              → FluxoCaixaPanel
│   ├── saques             → SaquesTab
│   ├── conciliacao        → ConciliacaoAsaasPanel
│   ├── socios             → PartnerSplitPanel
│   ├── test               → TestStoreFinancePanel
│   └── auditoria          → AuditoriaFinanceiraPanel  (financeira)
├── Moderadores            → ModeratorManager
├── Suporte                → SupportAdminPanel
├── Página do App
│   ├── page               → AppStorePageAdmin
│   └── links              → AppLinksManager
├── Notificações           → AdminBroadcastPush
├── Coach Vendas IA        → SalesCoachPanel
├── Sincronizar            → SyncExternalTab
├── Auditoria              (consolida Logs + Debug Loja)
│   ├── auditoria          → (painel de compliance, inline)
│   ├── logs               → tabela admin_logs
│   └── debug-loja         → DebugLojaTab
└── Jurídico               → JuridicoTab
```

---

## 2. Tabela abas × função × fonte × sobreposição

| Aba | Sub-aba | O que faz | Fonte de dados | Sobreposição / risco |
|-----|---------|-----------|----------------|-----------------------|
| **Dashboard** | — | KPIs de vendas do período (vendas, pedidos, comissão) | `orders` (filtro por data) | — |
| **Lojas** | lojas | CRUD/aprovação de lojas + editor de plano (VIP) | `stores`, `store_plans`, `plan_templates` (via `AdminPlanManager`) | Card omite linha quando valor VIP = 0 (bug conhecido) |
| Lojas | cidades | Configura cidades ativas e onboarding | `admin_settings.cities_config` | — |
| Lojas | entrega | Configura splits globais da taxa de entrega da plataforma | `admin_settings.delivery_fee_config` | ⚠️ Valor global; VIP por loja em `store_plans.platform_delivery_split_override` sobrescreve |
| **Cupons** | — | CRUD de cupons globais | `coupons` | — |
| **Financeiro** | overview | Painel unificado por período (7d/30d): repasses, mensalidades, motoboys, comissão | `orders` + `store_balances` + `parentStorePlans` | ⚠️ KPI "lojas pagantes" usa filtro diferente da listagem abaixo (bug) |
| Financeiro | **areceber** | Consolidado do que a plataforma TEM A RECEBER de todas as lojas (mensalidade + comissão + entrega_fee + pdv_fee) | RPC `get_platform_receivables` (SECURITY DEFINER, banco externo) | ⚠️ **Sobrepõe** com "mensalidades" (subset: só mensalidade) e com `PlanosTab > A Receber` (só fixed). Fonte diferente das outras duas! |
| Financeiro | **mensalidades** | Mensalidades de planos `fixed`: em dia/atrasado/trial + embute `PlanosTab` | `store_plans` (plan_type=fixed) + `stores` | ⚠️ Só considera `fixed` — não mostra `supporter` nem `autonomy` que também pagam mensalidade. Subset da "A Receber". Ainda embute `PlanosTab` (com 3 sub-abas próprias) — 3 níveis de aninhamento |
| Financeiro | historico | Histórico de repasses PAGOS (comprovantes) | `payout_history` (entity_type=store) | — |
| Financeiro | fluxo | Fluxo de caixa consolidado da plataforma | `financial_transactions` | — |
| Financeiro | saques | Aprovar/negar saques de motoboys | `withdrawal_requests` | — |
| Financeiro | conciliacao | Conciliação com Asaas | `asaas_webhook_events` + `orders` | — |
| Financeiro | socios | Split para sócios da plataforma | `platform_partners` + `partner_payouts` | — |
| Financeiro | test | Financeiro isolado de lojas de teste | `stores.is_test=true` | — |
| Financeiro | auditoria | Auditoria financeira (diffs, alertas) | `compliance_alerts` + `financial_transactions` | ⚠️ Confunde com aba raiz "Auditoria" (nome idêntico) |
| **Moderadores** | — | Gestão de moderadores e comissões | `moderators`, `moderator_earnings` | — |
| **Suporte** | — | Painel de tickets/mensagens | `order_messages` + `refund_requests` | — |
| **Página do App** | page | Editor da landing do app | `app_page_config` (admin_settings) | — |
| Página do App | links | Editor de deep-links | `app_links` | — |
| **Notificações** | — | Broadcast push OneSignal/FCM | `fcm_tokens` / `onesignal_players` | — |
| **Coach Vendas IA** | — | Painel de IA para insights | Lovable AI Gateway | — |
| **Sincronizar** | — | Sync manual Lovable Cloud ↔ Supabase externo | Edge `sync-to-external` | — |
| **Auditoria** | auditoria | Alertas de compliance | `compliance_alerts` | ⚠️ Nome colide com `Financeiro > auditoria` |
| Auditoria | logs | Log de ações admin | `admin_logs` | — |
| Auditoria | debug-loja | Diagnóstico de uma loja específica | Multi-tabela por store_id | — |
| **Jurídico** | — | Aceite de termos, versões de documento | `legal_documents`, `terms_acceptance` | — |

---

## 3. Sobreposições confirmadas (candidatas a fundir/renomear)

### 3.1 Três "A Receber" — três fontes diferentes

| Tela | Escopo | Fonte | Valor esperado |
|------|--------|-------|----------------|
| `Financeiro > A Receber` (`AReceberTab`) | **TODAS** as lojas, TODAS as receitas | RPC `get_platform_receivables` | mensalidade + comissao + entrega_fee + pdv_fee |
| `Financeiro > Mensalidades` (`MensalidadesPanel`) | Só `plan_type='fixed'` | `store_plans` (query direta) | apenas mensalidade |
| `Financeiro > Mensalidades > PlanosTab > A Receber` (`AdminFixedPlanReceivables`) | Só `plan_type='fixed'` | `store_plans` + `store_balances` (query direta) | mensalidade + repasse + comissão residual |

**Problema**: três fontes diferentes para o mesmo conceito → divergência garantida. `supporter` e `autonomy` (também planos fixos) somem em duas das telas.

**Decisão sugerida na Fase 2**:
- Manter **`AReceberTab`** como fonte única (RPC já é SECURITY DEFINER).
- `MensalidadesPanel` vira **view filtrada** da mesma RPC (`kind='mensalidade'`), incluindo `supporter`/`autonomy`.
- `AdminFixedPlanReceivables` (dentro de `PlanosTab`) → substituir por uma view filtrada da mesma RPC ou remover (redundante).

### 3.2 Dois "Auditoria" com nomes idênticos
- Sidebar raiz **Auditoria** = compliance + logs + debug loja.
- `Financeiro > Auditoria` = auditoria financeira (diffs de saldo, conciliação).

**Decisão sugerida**: renomear `Financeiro > Auditoria` para **"Auditoria Financeira"** para evitar colisão.

### 3.3 Configuração de entrega em dois lugares
- **Global**: `Lojas > Entrega` → `admin_settings.delivery_fee_config` (splits padrão).
- **Por loja (VIP)**: `Lojas > lojas > editor de plano` → `store_plans.platform_delivery_split_override`.

Não é bug (são níveis diferentes), mas o painel global não indica quantas lojas têm override. Fase 2: adicionar contador "N lojas com override VIP" no `DeliveryFeeConfigPanel`.

### 3.4 `PlanosTab` embutido dentro de `MensalidadesPanel`
3 níveis de aninhamento (`Financeiro > Mensalidades > Planos > Lojas/Templates/AReceber`). Confuso.

**Decisão sugerida**: **desembutir**. `MensalidadesPanel` mostra só o painel de status/atrasados. As sub-abas de `PlanosTab` (Lojas / Templates / A Receber) sobem para o nível do Financeiro:
- `Financeiro > Planos (Lojas)` — editor de plano por loja (atual `AdminPlanManager`)
- `Financeiro > Planos (Templates)` — editor global de templates
- Sub-aba "A Receber" do PlanosTab **removida** (redundante com `Financeiro > A Receber`).

### 3.5 Nomenclatura de plano divergente
Strings vistas em componentes diferentes para o **mesmo** plano:

| plan_type | Card de loja | Financeiro | plansInfo.ts |
|-----------|--------------|------------|---------------|
| `fixed` | "Fixo Mensal" | "Fixo" | "Essencial" |
| `commission_only` | "Só Comissão" | "Comissão" | "Só Comissão" |
| `supporter` | "Apoiador" | "Apoiador" | "Apoiador" |
| `autonomy` | (varia) | "Autonomia" | "Autonomia" |
| `hybrid` | "Híbrido" | "Híbrido" | "Híbrido" |

**Decisão sugerida**: usar sempre `plansInfo.ts[plan_type].label`. Remover strings hardcoded.

### 3.6 VIP escondendo valores zerados
Regra atual (componentes vários): quando override VIP = 0, esconde a linha inteira. Isso quebra o alinhamento visual e faz o usuário achar que o dado sumiu.

**Decisão sugerida**: sempre mostrar `R$ 0,00` + badge "VIP" ao lado. Nunca esconder.

---

## 4. Próximos passos (Fase 2 e 3 do plano)

**Fase 2 — padronização** (criar helpers/constantes, sem UI ainda):
1. `src/lib/plansInfo.ts` — garantir `label` para todos os `plan_type` e exportar helper `planLabel(planType)`.
2. `src/lib/pagante.ts` (novo) — helper `isPagante(store, plan)` usado tanto por KPIs quanto por listas.
3. `useStorePlan` já expõe `isVip` + `vipDiffs` — passa a ser fonte única (já parcialmente aplicado).
4. Componente `<PlanBadge planType />` e `<VipBadge diffs />` reutilizáveis.

**Fase 3 — correções pontuais** (nesta ordem):
1. Renomear `Financeiro > Auditoria` → "Auditoria Financeira".
2. `MensalidadesPanel` — remover `PlanosTab` embutido; incluir `supporter`/`autonomy` no filtro.
3. `AdminFixedPlanReceivables` — remover ou converter em view de `get_platform_receivables`.
4. Card de loja (`AdminPlanManager`) — nunca esconder linha VIP zerada; adicionar `<VipBadge>`.
5. Todos os componentes trocam string hardcoded por `planLabel(planType)`.
6. KPI vs lista do `FinanceTabFull` — alinhar filtro via `isPagante`.

Após Fase 3, bump de versão `1.11.95 → 1.11.96` (3 arquivos + versionCode +1).

---

**Este mapa é o entregável da Fase 1.** Revise, confirme o que quer manter/fundir e eu sigo para a Fase 2.