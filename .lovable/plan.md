# Auditoria — Como explicamos Planos, Taxas e Entregas

Objetivo: garantir que lojista, cliente e entregador entendam **na hora**, sem precisar perguntar no WhatsApp, **quanto pagam, quanto recebem e por quê**. Hoje a informação existe mas está **espalhada, repetida com números diferentes e em jargão técnico**.

---

## 1. Mapeamento — onde os planos/taxas aparecem hoje

| Tela / componente | Para quem | O que mostra hoje | Problema |
|---|---|---|---|
| `PlanosPage.tsx` | Lojista (público) | 4 planos lado a lado | Falta exemplo prático "se vender R$X, recebe R$Y" no topo |
| `CadastroLojista.tsx` | Lojista (signup) | Seleção de plano | Repete tabela, não amarra com PlanosPage |
| `PlansComparisonTable.tsx` | Lojista | Tabela comparativa | OK — mas é a única fonte clara. Deveria ser reusada em todo lugar |
| `StoreSubscription.tsx` | Lojista logado | Plano atual + cobrança | Não mostra "quanto você economizou esse mês" |
| `StoreFinancePanel.tsx` / `StoreFinanceBasic.tsx` | Lojista | Saldo, taxas descontadas | Mostra valores mas não **explica** de onde vem cada desconto |
| `StoreSettings.tsx` (taxa de entrega) | Lojista | Input de taxa | Não avisa "+R$2 da plataforma será somado" no input |
| `DeliveryFeeConfig.tsx` | Admin global | Configura split | Interno — ok |
| `CheckoutPage.tsx` | **Cliente** | Subtotal + taxa entrega + total | **Cliente vê só "Taxa de entrega R$7" — não sabe que R$5 vai pro lojista e R$2 pra plataforma** (e nem precisa, mas hoje gera dúvida) |
| `CartPage.tsx` | Cliente | Resumo | Idem |
| `PedidosPage.tsx` | Cliente | Histórico | Mesma quebra |
| `DriverDashboard.tsx` | Entregador | Ganho por corrida | Não explica split (R$5 do lojista, quanto fica pro motoboy) |
| `Index.tsx` (landing) | Visitante | Pitch geral | Sem menção a "como cobramos" |
| `TermosDeUso.tsx` / `PoliticaPrivacidade.tsx` | Todos | Texto legal | Não bate com PlansComparisonTable |
| `CommissionAlert.tsx` / `PlatformSplitAlert.tsx` | Lojista | Avisos pontuais | Linguagem técnica ("split", "subaccount") |

**Fonte de verdade técnica:** `src/lib/plansInfo.ts` (✅ já existe — bom) + `useStorePlan.ts` (✅).
**Constantes-chave já centralizadas:** `DELIVERY_FEE_NOTE`, `PIX_FEE_NOTE`.

---

## 2. Problemas que a auditoria encontrou

1. **3 lugares dizem coisas diferentes sobre a R$2 da plataforma**
   - PlansComparisonTable: "somada à sua taxa, paga pelo cliente" ✅
   - StoreSettings: input "Taxa de entrega" sem aviso → lojista acha que está cobrando a mais
   - CheckoutPage (cliente): só mostra o total final → cliente acha que a loja cobra R$7
2. **Taxa PIX R$1,99** aparece só na tabela. No painel financeiro o lojista vê o desconto mas **não vê o porquê** linkado ao plano.
3. **Comissão (2,5% / 6%)** aparece como número, nunca como exemplo: "Pedido R$50 → comissão R$3"
4. **Trial / mudança de plano** — `StoreSubscription` não diz claramente "se mudar agora, paga proporcional a X dias"
5. **Entregador** não tem nenhuma tela explicando "você recebe R$X por corrida porque o split é Y"
6. **Landing (Index)** não vende a transparência — concorrentes (iFood) escondem; podemos ganhar mostrando

---

## 3. Plano de melhorias (por fases, sem mudar regra de negócio)

### Fase A — Componentes reutilizáveis de explicação (1 dia)
Criar 3 componentes pequenos em `src/components/fees/`:
- `<PlanFeeBreakdown plan orderValue payment />` → tabela "Pedido R$50 via PIX no plano Crescimento → você recebe R$48,75"
- `<DeliveryFeeExplainer mode="store" | "client" | "driver" />` → texto curto contextual, lê de `plansInfo.ts`
- `<WhyThisCharge tooltip />` → ícone (?) com popover explicando cada linha de cobrança

Tudo lê de `plansInfo.ts` e `useStorePlan.ts` — zero duplicação.

### Fase B — Lojista (tela por tela)
- **StoreSettings** (taxa de entrega): abaixo do input mostrar live "Cliente verá: R$ {sua_taxa + 2,00}". Usar `DeliveryFeeExplainer mode=store`.
- **StoreFinancePanel / Basic**: cada linha de desconto tem `<WhyThisCharge>` (comissão, PIX, R$2 entrega). Card no topo "Plano atual: Crescimento — economia esse mês vs Comissão: R$X".
- **StoreSubscription**: incluir `<PlansComparisonTable>` colapsado + cálculo "no seu volume (últimos 30d = R$X), o plano ideal seria Y, economia R$Z".
- **CadastroLojista**: substituir tabela duplicada por `<PlansComparisonTable>`.
- **CommissionAlert / PlatformSplitAlert**: reescrever em PT-BR claro, sem "split/subaccount".

### Fase C — Cliente
- **CheckoutPage / CartPage**: linha "Taxa de entrega" com `<WhyThisCharge>` discreto: "R$5 vai pra loja (entrega), R$2 mantém o app funcionando". Sem ser invasivo.
- **PedidosPage** (detalhe): mesmo tooltip no histórico.

### Fase D — Entregador
- **DriverDashboard**: card de ganho de corrida com breakdown "Taxa da loja R$5 → motoboy R$X, plataforma R$Y". Usar `DeliveryFeeExplainer mode=driver`.

### Fase E — Público / institucional
- **Index.tsx**: seção "Como cobramos — sem letra miúda" reusando `<PlansComparisonTable>` resumida + 1 frase por plano.
- **PlanosPage**: adicionar calculadora interativa no topo (slider de faturamento mensal → mostra qual plano paga menos). Maior conversão.
- **TermosDeUso**: sincronizar valores com `plansInfo.ts` (importar constantes em vez de hardcode).

### Fase F — Glossário único
Criar `/ajuda/taxas` (rota pública) com FAQ curto: "O que é a R$2 da plataforma?", "Por que PIX tem taxa?", "Quando muda meu plano?". Linkar de todos os `<WhyThisCharge>`.

---

## 4. Princípios de copy (aplicar em tudo)

1. **Sempre exemplo numérico** — nunca só %.
2. **Sempre dizer quem paga** — "você (lojista)", "o cliente", "a plataforma".
3. **Zero jargão** — proibido: split, subaccount, gateway, MDR. Permitido: taxa, repasse, comissão.
4. **Uma fonte de verdade** — `plansInfo.ts`. Qualquer valor hardcoded em outro arquivo é bug.
5. **Mostrar economia, não custo** — "você economiza R$X" converte melhor que "você paga R$Y".

---

## 5. Detalhes técnicos

- Linter para evitar regressão: regra ESLint custom proibindo strings `"R$ 2"`, `"2,5%"`, `"6%"`, `"R$ 1,99"`, `"R$ 180"`, `"R$ 100"` fora de `src/lib/plansInfo.ts` e testes.
- Testes: snapshot de `<PlanFeeBreakdown>` para os 4 planos × 3 valores de pedido.
- Sem migration de banco. Sem mudança em edge function. Apenas frontend + copy.
- Versionar normalmente a cada fase concluída (`appVersion.ts` + `build.gradle`).

---

## 6. Ordem sugerida

A (componentes) → B (lojista, maior dor) → C (cliente, maior volume) → E (landing/conversão) → D (entregador) → F (glossário). Cada fase entrega valor sozinha.
