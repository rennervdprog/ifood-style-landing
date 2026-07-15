# Refatoração da Landing (StoreDirectory)

Objetivo: reconstruir a landing do lojista com visual moderno estilo Figma, copy de alta conversão e — o mais importante — **zero informação falsa**. Todos os números, taxas e recursos vêm da fonte única `src/lib/plansInfo.ts` e do que o app realmente entrega hoje.

## 1. Auditoria do que o sistema REALMENTE oferece (base da copy)

Confirmado no código:

**Planos ativos (novos cadastros)** — só 3, exatamente como `PLANS_ORDER`:
- **Essencial** — R$ 0/mês grátis até GMV de R$ 5.000 em 60 dias → depois R$ 180/mês. 0% comissão. PIX R$ 1,99/pedido. Plataforma soma +R$ 0,99 na taxa de entrega (cliente paga).
- **Autonomia** — R$ 0/mês grátis até GMV de R$ 2.500 em 60 dias → depois R$ 239,90/mês. 0% comissão. PIX R$ 1,99/pedido. **Sem** acréscimo de R$ 0,99 na entrega (você fica com 100% da taxa).
- **Somente PDV** — R$ 69/mês. Só frente de caixa presencial. Sem vitrine, sem delivery.

**Nova regra crítica (implementada essa semana):** ao atingir o GMV, aceitar o upgrade é obrigatório. Recusar **suspende a loja** até aceitar. Isso precisa aparecer com honestidade na landing (não esconder para forçar conversão).

**Módulos opcionais reais:** PDV add-on R$ 49/mês (para Essencial/Autonomia); WhatsApp bot é grátis.

**Recursos reais entregues:** cardápio digital com link próprio, pedido com mapa, PIX automático (Asaas) + Pix Direto (chave do lojista com confirmação manual), motoboy integrado com rastreio e código de confirmação, WhatsApp bot guiado (Evolution API) com fluxo de pedido, relatórios do dia, PDV completo (sessão, sangria, fechamento, relatórios), impressão térmica, cupons, fidelidade, promoções, banners.

**O que NÃO temos e não pode aparecer:** app nativo obrigatório pro cliente, integração iFood/Rappi, garantia de faturamento, "sem taxas" absoluto (PIX tem R$ 1,99), plano Apoiador/Crescimento/Comissão para novos (são legado).

## 2. Nova estrutura da página

Ordem pensada pra funil de conversão (dor → prova → solução → preço → objeção → CTA):

1. **Nav flutuante** — logo, âncoras (Recursos, Planos, FAQ), CTA "Criar loja grátis".
2. **Hero** — headline curta de alto impacto + subhead com prova ("grátis até R$ 5.000 em vendas"), 2 CTAs (Criar loja grátis / Ver planos), mock de celular à direita com print real do admin.
3. **Faixa de prova social** — logos/nomes de lojas ativas + números reais (nº de lojas, cidades) puxados via count no Supabase (ou fixos honestos).
4. **Bloco "Pra quem é"** — grid de segmentos (pizzaria, mercado, doceria, bar, lanche, loja física com PDV).
5. **Dor → Solução** — 4 pares em cards espelhados (papel × tela, ligações × WhatsApp automático, PIX no extrato × PIX na hora, sem controle × relatório do dia).
6. **Recursos reais** — bento grid estilo Figma com 6-8 cards: Cardápio digital, PIX automático + Pix Direto, WhatsApp bot guiado, Motoboy integrado, Relatórios, PDV, Cupons/Fidelidade, Impressão térmica.
7. **Como funciona** — 4 passos (criar conta → montar cardápio → compartilhar link → receber pedido).
8. **Planos** — 3 cards (Essencial destacado no meio, Autonomia à direita, Somente PDV à esquerda). Cada card com preço grande, gatilho de upgrade explícito, lista de features vinda de `PLANS[id].features`, badge, CTA. Rodapé do bloco com as duas notas oficiais: `DELIVERY_FEE_NOTE` e `PIX_FEE_NOTE`.
9. **Comparador** — reaproveita `PlansComparisonTable` colapsável ("Ver comparação completa").
10. **Simulador rápido** — reaproveita `PlanFeeBreakdown` com slider de valor do pedido, mostrando líquido nos 2 planos lado a lado (prova numérica honesta).
11. **Transparência sobre o upgrade obrigatório** — bloco discreto mas visível: "E depois dos R$ 5.000? Você aceita a mensalidade e continua, ou a loja fica suspensa até aceitar. Sem pegadinha — está nos Termos, cláusula 5.2." Link para Termos.
12. **Depoimentos** — 3 cards.
13. **FAQ** — accordion, incluindo perguntas sobre a taxa de R$ 0,99, o gatilho dos R$ 5.000, cancelamento, o que acontece se recusar upgrade.
14. **CTA final** — faixa full-width com headline forte e botão único.
15. **Footer** — links legais, badges Asaas, versão.

## 3. Design "estilo Figma"

Sistema visual coeso, sem cara de template genérico:

- **Tokens novos em `index.css`**: gradient hero (`--gradient-hero`), gradient de card destaque, sombras suaves (`--shadow-card`, `--shadow-elevated`), radius maior (`--radius: 1.25rem`).
- **Tipografia**: manter fonte atual do projeto; hierarquia forte (display 48-64px no hero mobile-first, 96px desktop; H2 32-40px; body 16-18px).
- **Layout**: max-width 1200px, seções com respiração generosa (py-24 desktop, py-16 mobile), grid de 12 colunas onde faz sentido.
- **Componentes-chave**: cards com border 1px + sombra sutil + hover lift; badge pill no card destacado; ícones em círculo com fundo `bg-primary/10`; separadores usando gradiente sutil, não linha dura.
- **Motion**: fade-up em scroll (IntersectionObserver leve, sem lib nova), hover scale nos cards, pulse no CTA principal. Nada de parallax pesado.
- **Mobile-first real** — todos os grids colapsam limpo, hero com mock abaixo do texto, planos em carrossel horizontal com snap.
- **Cores**: primary do projeto + neutrals; usar apenas tokens semânticos (nada de `text-white`/`bg-black` hardcoded).

## 4. Cards de plano — a parte mais sensível

Fonte de verdade: `src/lib/plansInfo.ts`. A landing consome direto de `PLANS` e `PLANS_ORDER`, sem duplicar textos. Isso garante que quando o preço mudar em um lugar, muda em todos.

Cada card mostra:
- Nome + tagline oficial.
- Preço grande: "R$ 0" com sublinha "hoje" e chip "→ R$ 180/mês após R$ 5.000 em vendas" para deixar claro.
- Lista de features **exata** de `PLANS[id].features`.
- Selo de plano em destaque só no Essencial (é o mais popular).
- CTA "Começar grátis" (Essencial/Autonomia) ou "Contratar PDV" (Somente PDV).
- Micro-nota abaixo do card destacado: "Sem cartão de crédito. Cancelamento a qualquer momento."

Nada de features inventadas ("suporte 24h", "app nativo", "integração iFood") — só o que tem em `PLANS[id].features`.

## 5. Arquivos afetados

- `src/pages/StoreDirectory.tsx` — reescrita completa (arquivo grande hoje, vai encolher usando componentes).
- `src/pages/landing/` (novo diretório) — quebrar em componentes: `HeroSection.tsx`, `SegmentsSection.tsx`, `PainSolutionSection.tsx`, `FeaturesBento.tsx`, `HowItWorksSection.tsx`, `PlansSection.tsx`, `SimulatorSection.tsx`, `UpgradeTransparency.tsx`, `TestimonialsSection.tsx`, `FaqSection.tsx`, `FinalCta.tsx`, `LandingNav.tsx`, `LandingFooter.tsx`.
- `src/index.css` — 3-4 tokens novos (gradients, sombras).
- Sem tocar em `plansInfo.ts` (já é a fonte da verdade).
- Sem mudança no backend, sem migration.

## 6. SEO

- `<title>`: "ItaSuper — Cardápio digital, PIX na hora e motoboy integrado, grátis pra começar" (< 60).
- `<meta description>`: focar em grátis até R$ 5.000, PIX automático, cardápio próprio (< 160).
- H1 único no hero.
- Alt real em todas as imagens.
- JSON-LD `SoftwareApplication` com preço grátis inicial e ratings só se forem reais.

## 7. Bump de versão

Ao final: v1.15.46, build 1006, atualizado em `PerfilPage.tsx` e `android/app/build.gradle` (versionCode 1006).

## Detalhes técnicos

- Reaproveitar `PlansComparisonTable`, `PlanFeeBreakdown`, `DeliveryFeeExplainer` já existentes — não duplicar lógica de preço.
- IntersectionObserver custom hook (`useInView`) em vez de framer-motion pra não pesar bundle.
- Lazy-load das seções abaixo da dobra via `React.lazy` + `Suspense` (as sections pesadas: Simulator, Testimonials, FAQ) — já entra na regra de otimização do projeto.
- Imagens do mock: reutilizar screenshots já existentes em `src/assets/` se houver; caso contrário, gerar 1-2 imagens novas otimizadas em .webp.
- Manter `PartnerClientView` e `AsaasBadgeBar` (já usados).
- Testes: sem novo teste unitário (é página de conteúdo); smoke via preview.
