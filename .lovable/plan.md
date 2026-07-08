# Plano — string-sweep de planos + alinhamento KPI×lista no FinanceTabFull

Fecha os 2 itens restantes das Fases 2/3. Baixo risco se feito em passos pequenos e validado após cada arquivo.

---

## Parte A — String-sweep: usar `planLabel()` em vez de strings hardcoded

Objetivo: uma única fonte para o nome do plano em todo o Super Admin/lojista.

**Método:** para cada arquivo, localizar mapas locais (`planLabels`, `KIND_META.label`, ternários `plan_type === 'fixed' ? 'Fixo' : ...`) e substituir por `planLabel(planType)` de `@/lib/plansInfo`. Não mexer em ícones/cores locais — só o texto.

**Arquivos a varrer (nesta ordem, um patch por arquivo):**

1. `src/components/AdminPlanManager.tsx` — substituir mapa `planLabels` interno por `planLabel()` nos pontos de exibição (mantém labels internos só onde forem chave de UI, não texto).
2. `src/components/StoreSubscription.tsx` — hero + card de detalhes.
3. `src/components/finance/MensalidadesPanel.tsx` — já feito (confirmar).
4. `src/pages/super-admin/tabs/AReceberTab.tsx` — coluna "Plano" e badges de linha.
5. `src/pages/super-admin/tabs/HistoricoRepassesTab.tsx` — coluna "Plano/Kind" (só a parte do plano, não `KIND_LABEL` que descreve o tipo de repasse).
6. `src/components/FinanceCenter.tsx` — cabeçalho e chips.
7. `src/pages/SuperAdminDashboard.tsx` (`FinanceTabFull`) — badges de linha da lista de lojas.

**Regra:** não tocar em `plansInfo.ts` nem no editor VIP (`AdminPlanManager > VIP config`) — lá o nome vem do template, já correto.

**Validação:** após cada arquivo, `tsgo --noEmit`; ao final, verificar no preview (headless) que cada tela abre sem erro e o nome do plano aparece igual em card de loja, hero do lojista e "A Receber".

---

## Parte B — Alinhar KPI × lista no `FinanceTabFull`

Objetivo: KPI "lojas pagantes" da Visão Geral bater com a quantidade exibida na listagem logo abaixo.

**Método:**
1. Ler `src/pages/SuperAdminDashboard.tsx` do bloco `FinanceTabFull` — localizar os dois filtros (o do KPI e o do `.map` da lista de lojas).
2. Substituir ambos por `isPagante(store, plan)` de `@/lib/pagante.ts`.
3. Passar `parentStorePlans` (já disponível) para o helper — cruzar por `store_id`.
4. Onde houver dedupe/soma financeira, garantir que usa a mesma lista filtrada (não recontar).

**Edge cases a testar:**
- Loja VIP com `monthly_fee = 0` → aparece na lista **e** conta no KPI (não é isento de "pagante", só isento de mensalidade).
- Loja `is_test = true` → fora dos dois.
- Loja sem plano ativo → fora dos dois.

**Validação:** Playwright headless logado como super admin → aba Financeiro > Visão Geral → conferir `qtdLojas` do KPI == `.length` visível da lista.

---

## Versão
Bump `1.11.96` → `1.11.97` em `src/lib/appVersion.ts` e `android/app/build.gradle` (versionCode 850 → 851).

## Fora do escopo
- `KIND_LABEL` de tipos de repasse (mensalidade/comissão/entrega_fee/pdv_fee) permanecem — descrevem o tipo de receita, não o plano.
- Redesign visual, cores, ícones.
- Edge functions / schema.

Aprova?
