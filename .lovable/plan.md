# Plano: Auditoria e Padronização do Painel do Lojista

## Objetivo
Deixar todas as telas do painel do lojista com **visual único, limpo e fácil de entender**, usando apenas as cores do design system. Vermelho passa a ser exclusivo de **urgência crítica**.

---

## 1. Diagnóstico atual (o que está bagunçado)

Telas auditadas em `src/pages/admin/tabs/`:
- DashboardTab, OrdersTab, MenuTab, AddonsTab, BordasTab, ClientsTab, DriversTab, FinanceTab, CashRegisterTab, HoursTab, LoyaltyTab, RefundsTab, ReportsTab, SettingsTab, SubscriptionTab, TutoriaisTab.

Problemas recorrentes:
- **Excesso de cores arbitrárias** (verde, amarelo, azul, roxo, laranja, rosa) usadas como decoração — cada tela tem uma paleta diferente.
- **Vermelho usado para tudo** (botão excluir, badge informativo, alerta de estoque, totais) — perde força de alerta real.
- **Cards com gradientes e ícones coloridos** competindo com a informação principal.
- **Tipografia inconsistente** entre tabs (tamanhos de título, espaçamentos, padding).
- **Tabs/menus longos** sem agrupamento, dificultando achar funcionalidade.
- Mistura de classes diretas (`text-green-500`, `bg-blue-100`) em vez de tokens semânticos.

---

## 2. Regras de cor do novo padrão

| Token | Uso |
|---|---|
| `primary` | Ação principal, marca, destaques positivos |
| `foreground` / `muted-foreground` | Texto |
| `card` / `background` / `border` | Superfícies neutras |
| `muted` | Estados secundários, badges informativos |
| `destructive` (vermelho) | **APENAS** urgência crítica: erro real, exclusão definitiva, falha de pagamento, pedido travado, estoque zerado bloqueando venda |
| `secondary` / `accent` | Variações sutis, sem cor forte |

**Proibido nos componentes do painel:** `text-green-*`, `bg-blue-*`, `text-yellow-*`, `bg-purple-*`, gradientes coloridos decorativos, ícones em cores arbitrárias. Tudo passa por tokens do `index.css`.

Status semânticos (pedidos, financeiro) usam **um único tom neutro com ícone** — não cor forte — exceto quando exigem ação urgente.

---

## 3. Padrão visual unificado

- **Header de tab:** título grande + subtítulo curto explicando o que faz a tela.
- **Cards de métrica:** mesmo tamanho, mesmo padding, ícone monocromático em `muted-foreground`, número em `foreground`.
- **Botões:** `default` para ação principal, `outline` para secundária, `destructive` só para apagar/cancelar de verdade.
- **Badges:** `secondary` (neutro), `outline` (informativo), `destructive` (urgente). Sem cores customizadas.
- **Tabelas/listas:** zebra suave com `muted/30`, separadores `border`.
- **Espaçamento:** grid de 4/8/16/24px consistente entre todas as tabs.

---

## 4. Reorganização (reduzir confusão)

Agrupar as 16 tabs em **5 áreas claras** na sidebar:

```
Operação       → Dashboard, Pedidos, Caixa
Cardápio       → Menu, Adicionais, Bordas
Clientes       → Clientes, Fidelidade
Entrega        → Entregadores, Horários
Financeiro     → Financeiro, Reembolsos, Relatórios, Plano
Configurações  → Ajustes, Tutoriais
```

Cada área vira um grupo colapsável na sidebar do lojista, com a tab ativa destacada apenas com `primary`.

---

## 5. Execução (ordem proposta)

1. **Fundação visual** — revisar `index.css` / `tailwind.config.ts` para garantir tokens completos (sem mudar marca atual) e criar componentes base reutilizáveis: `PageHeader`, `MetricCard`, `StatusBadge`, `EmptyState`.
2. **Sidebar agrupada** — reorganizar navegação do painel em 5 grupos.
3. **Refatorar tabs em lote**, removendo cores arbitrárias e aplicando os componentes base:
   - Lote A: Dashboard, Pedidos, Caixa
   - Lote B: Menu, Adicionais, Bordas
   - Lote C: Clientes, Fidelidade, Entregadores, Horários
   - Lote D: Financeiro, Reembolsos, Relatórios, Plano
   - Lote E: Ajustes, Tutoriais
4. **Auditoria final do vermelho** — varredura `rg "destructive|red-|text-red"` confirmando que só aparece em ação crítica.
5. **QA visual** nas telas principais no preview mobile (384px) e desktop.

---

## 6. O que NÃO muda
- Funcionalidades, regras de negócio, dados, integrações.
- Estrutura de rotas e permissões.
- Logo, fontes e identidade da marca ItaSuper.

---

## Confirmação
Posso começar pela **Fundação visual + Lote A (Dashboard, Pedidos, Caixa)** já nesta rodada? Se preferir outra ordem (ex.: começar pelo Cardápio), me diga.
