# Reformulação UI/UX — /cadastro-lojista

## Diagnóstico do estado atual

O Step 0 (Plano) hoje empilha por card: badge + ícone + tagline + preço + bloco trial (3 linhas) + grid 3 colunas (comissão/PIX/entrega) + parágrafo R$2 + parágrafo plano dinâmico + 3 features. Resultado: ~12 blocos de texto por card × 4 cards = parede de informação em tela 384px. Depois ainda vem um card "Como funciona", outro "Plano dinâmico" e o CTA. O lojista cansa antes de escolher.

Os Steps 1–3 (Conta, Loja, Dados) estão bem dimensionados — o problema é concentrado no Step 0.

## Princípios da reformulação

1. **Progressive disclosure**: mostrar o mínimo para decidir; detalhe sob demanda (tap "Ver detalhes").
2. **Uma frase de valor por plano**, não 5.
3. **Comparação visual rápida** em vez de leitura linear.
4. **Detalhes completos preservados** — nada de remover informação legal/comercial, só reorganizar.
5. Reutilizar componentes já existentes em `src/components/fees/` (PlanFeeBreakdown, WhyThisCharge).

## Mudanças por seção

### Step 0 — Plano (foco da reformulação)

**Topo enxuto** (3 linhas em vez de 5):
- Título "Escolha seu plano"
- Subtítulo único: "7 dias grátis · sem contrato · troque quando quiser"

**Card de plano compacto (estado fechado)** — apenas:
- Ícone + Nome do plano + badge (se houver)
- Preço grande à direita
- 1 frase de posicionamento ("Pra quem está começando", etc.)
- 3 chips horizontais: `Comissão X%` · `PIX Y` · `Entrega +R$2`
- Link "Ver detalhes ▾" (accordion)

**Card expandido (ao tocar "Ver detalhes")** revela:
- Bloco trial 7 dias (só planos pagos)
- Explicação dos R$2 da entrega
- Aviso de plano dinâmico (fixed/hybrid)
- Lista completa de features (5 itens, não 3)
- Exemplo numérico via `<PlanFeeBreakdown>` (pedido R$50)

**Card selecionado** auto-expande (usuário vê tudo do escolhido sem precisar tocar de novo).

**Remover** o bloco redundante "Como funciona o {plano}" abaixo dos cards — essa info passa a viver dentro do card expandido.

**Plano dinâmico**: o checkbox de aceite continua, mas só aparece depois do plano ser selecionado E o card expandido. Hoje fica solto no fim.

### Steps 1–3
Sem mudanças estruturais. Apenas:
- Unificar espaçamento (`space-y-4` consistente)
- Remover dois campos do mesmo passo quando couber lado a lado (CEP + número já está bom)
- Microcopy: trocar "Lojista deve ter 18 anos ou mais (cláusula 2.2 dos Termos)" por "Você precisa ter 18+" e mover a referência da cláusula para tooltip.

### Header / Stepper
- Manter o stepper visual atual (já é bom)
- Adicionar abaixo do stepper uma única linha: "Passo X de 4 · ~2 min" para dar previsibilidade

## Microcopy — antes/depois (exemplos)

| Antes | Depois |
|---|---|
| "Sem contrato. Troque quando quiser. Sem multa." + badge "Teste 7 dias grátis · só paga depois" | "7 dias grátis · sem contrato · troque quando quiser" |
| Bloco trial completo visível sempre | Chip "🎁 7 dias grátis" no card fechado; bloco completo no expandido |
| "💡 Os R$2 da entrega são somados à taxa que você cobra. Quem paga é o cliente — não sai do seu caixa." | Chip "Entrega +R$2" com `<WhyThisCharge>` (?) explicando no popover |
| "📈 Plano dinâmico: se faturar mais de R$5.000/mês..." (parágrafo) | Selo "📈 Dinâmico" no header do card; explicação completa só no expandido |

## Resultado esperado

- Step 0 cabe em ~1.5 scrolls em vez de ~4
- Decisão guiada: chip-comparison > leitura linear
- Informação completa preservada (acessível em 1 toque)
- Zero mudança em validação, schema Zod, fluxo de submit ou regra de negócio

## Detalhes técnicos

- Estado novo: `expandedPlan: StorePlanType | null` (auto-set ao selecionar)
- Refatorar card para componente local `<PlanCard plan expanded onToggle onSelect selected />` dentro do mesmo arquivo (não criar arquivo novo — escopo cirúrgico)
- Usar `<details>`/`<summary>` nativo ou estado controlado + `max-h` transition para o expandido (sem libs novas)
- Reaproveitar `PLANS`, `DELIVERY_FEE_NOTE`, `PIX_FEE_NOTE` de `plansInfo.ts` (fonte única já existe)
- Reaproveitar `PlanFeeBreakdown` e `WhyThisCharge` de `src/components/fees/`
- Sem mudanças em `plansInfo.ts`, `useStorePlan.ts`, `schema` Zod, edge functions ou banco
- Bump de versão ao final (appVersion.ts + build.gradle versionName/versionCode)

## Fora de escopo
- Steps 1–3 ganham só ajustes de microcopy, não redesign
- Não alterar lógica de supporter (já oculto)
- Não criar nova rota /ajuda/taxas (fase F do plano antigo, separado)
