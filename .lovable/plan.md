# Plano — Redesign UI/UX do Super Admin

Foco: reorganizar navegação, hierarquia visual e leitura. **Nada de lógica de negócio muda** — apenas apresentação, agrupamentos, componentes visuais e responsividade. Mantém paleta laranja ItaSuper (`hsl(25 100% 50%)`), tokens semânticos e as 23 telas existentes.

## 1. Diagnóstico atual

Hoje o Super Admin (`SuperAdminDashboardV2.tsx`) tem 23 abas espalhadas em 7 grupos (Início, Operação, Financeiro, Pessoas, Marketing, Sistema). Problemas observados:

- Grupos desequilibrados (Sistema tem 4 abas técnicas misturadas com WhatsApp; Marketing mistura conteúdo e IA).
- No mobile: bottom-tabs + sheet "Mais" com lista longa e sem busca.
- No desktop: sidebar fixa larga, sem colapsar, títulos repetidos ("Financeiro" grupo + aba).
- Subtítulos como única forma de contexto; falta breadcrumb / hierarquia visual.
- Badges de pendência (aprovações, saques) aparecem só como toast/inline, não no menu.

## 2. Nova arquitetura de informação (5 grupos)

Reduz de 7→5 grupos, sem remover nenhuma aba (só realoca):

```text
┌─ Início        → Visão Geral
├─ Lojas         → Lojas · Aprovações · Cidades · Cupons · Entrega
├─ Financeiro    → Resumo · Pagamentos · Saques · Planos · Sócios · Teste
├─ Crescimento   → Página do App · Links · Notificações · Coach IA · Moderadores · Suporte
└─ Sistema       → Sincronizar · Auditoria · Logs · Jurídico · WhatsApp Plataforma
```

Regras:
- "Aprovações" sai de card volante e vira aba real dentro de **Lojas** (com badge no menu).
- "Cidades" e "Entrega" viram sub-abas de **Lojas** (já são operacionais de loja).
- "Links" volta como sub-aba de **Página do App** (relacionados).
- "Logs" fica sub-aba de **Auditoria**.
- Nada é removido; nenhuma rota interna muda.

## 3. Desktop — Shell novo

```text
┌───────────────────────────────────────────────────────────────┐
│ [Logo] ItaSuper Admin        [🔍 buscar…]   [🔔3]  [avatar]   │
├──────────┬────────────────────────────────────────────────────┤
│ SIDEBAR  │ Breadcrumb: Lojas › Aprovações                     │
│ (240px)  │ ┌────────────────────────────────────────────────┐ │
│ colapsa  │ │ Sub-tabs (pills)                               │ │
│ p/ 64px  │ │ [Lojas] [Aprovações •3] [Cidades] [Cupons]    │ │
│          │ ├────────────────────────────────────────────────┤ │
│  Início  │ │                                                │ │
│  Lojas • │ │            Conteúdo da aba                     │ │
│  Financ. │ │                                                │ │
│  Cresc.  │ │                                                │ │
│  Sistema │ │                                                │ │
└──────────┴────────────────────────────────────────────────────┘
```

- Sidebar colapsável (usa `shadcn/ui sidebar` já disponível), com ícones sempre visíveis.
- Badges de pendências (aprovações, saques) aparecem tanto no item do grupo quanto na sub-tab.
- Header sticky com busca global de aba (⌘K estilo Linear) — reaproveita `sidebarItems`.
- Sub-tabs em pills horizontais (padrão já usado em `GroupTabsBar`), consistência com admin de loja.

## 4. Mobile — Bottom nav + Command sheet

```text
┌────────────────────────────┐
│ Aprovações       [🔔3]     │  header compacto
│ 3 cadastros pendentes      │
├────────────────────────────┤
│                            │
│      conteúdo scrollável   │
│                            │
├────────────────────────────┤
│ 🏠   🏬•  💰   📣   ☰      │  bottom nav (5 slots fixos)
│Início Lojas Fin. Cresc. Mais│
└────────────────────────────┘
```

- 5 slots fixos = 4 grupos principais + "Mais" (abre sheet full-height com busca + lista agrupada).
- Sheet "Mais" com input de busca (filtra sidebarItems) e agrupamento por seção.
- Sub-tabs viram scroll horizontal snap dentro de cada grupo.
- Safe-area top/bottom via `NativeShell` já existente.

## 5. Sistema visual (mantém cores)

Tokens já existentes em `index.css` — nada de hex hardcoded:

- **Superfícies:** `bg-background` / `bg-card` / `bg-muted/40` para painéis empilhados.
- **Primária:** laranja ItaSuper preservada (`--primary`) — usada em abas ativas, botões primários e badges de foco.
- **Feedback:** `--destructive` para pendências urgentes, `--warning` (âmbar) para alertas, `--success` (esmeralda) para conciliações OK.
- **Tipografia:** Nunito (já configurada). Escala: `text-xs` micro, `text-sm` corpo, `text-base` títulos de card, `text-xl` H1 de aba.
- **Ritmo:** grid `gap-3` mobile / `gap-4` desktop, cards `rounded-2xl` e `border-border` (já é o padrão do projeto).
- **KPI cards:** padrão único (ícone tint + label micro + valor bold) — extrai `AdminKpiCard` reutilizado em todo o painel.

## 6. Entregáveis (ordem de execução)

1. Criar `src/pages/super-admin/shell/` com: `AdminShell.tsx`, `AdminSidebar.tsx`, `AdminBottomNav.tsx`, `AdminMoreSheet.tsx`, `AdminSubTabs.tsx`, `AdminKpiCard.tsx`, `AdminHeader.tsx`.
2. Reescrever apenas o **layout** de `SuperAdminDashboardV2.tsx` para consumir o shell — todos os `activeTab === "x"` e handlers permanecem intactos.
3. Ajustar `sidebarItems` para o novo agrupamento (mesma tipagem `AdminTab`, mesmos keys).
4. Ligar badges (`pendingApprovalsCount`, `pendingWithdrawals.length`) no sidebar/bottom-nav.
5. Bump de versão (`appVersion.ts` + `android/app/build.gradle` patch+versionCode).

## Detalhes técnicos

- **Zero mudanças em:** RPCs, queries React Query, edge functions, hooks (`useAuth`, `useIsAdmin`), tipagens `AdminTab`, roteamento `App.tsx`.
- Continua single-page com `activeTab` state; apenas o chrome muda.
- Sidebar usa `SidebarProvider` já mapeado em `src/components/ui/sidebar.tsx` (padrão Lovable).
- Command palette usa `Command` do shadcn (já instalado).
- Lazy loading atual (`Suspense` + `TabFallback`) é preservado.
- Sem quebras de rota: `/super-admin` continua único ponto de entrada.
- Testes E2E existentes (`e2e/06-*`, super-admin) continuam válidos — seletores baseados em texto de label não mudam.
