## Objetivo

Atualizar textos da `src/pages/StoreDirectory.tsx` com SEO puro (foco em intenção de busca real de lojistas) e adicionar o **4º card de plano "Somente PDV (R$ 69/mês)"**, alinhado a `plansInfo.ts` (`pdv_only`) e ao restante do sistema.

Escopo: **somente frontend** desta página. Nada de lógica de billing/backend.

---

## 1. Card "Somente PDV" no bloco de Planos

Adicionar como 4º card do array `plans`:

- id: `pdv_only`
- name: `Somente PDV`
- tagline: `Só o caixa, sem delivery`
- price: `69`
- commission: `Sem comissão`
- icon: `CreditCard`
- badge: `Balcão`
- features:
  - PDV completo (vendas, sangria, fechamento)
  - Cadastro de produtos ilimitado
  - Relatórios do caixa
  - WhatsApp integrado (grátis)
  - Sem vitrine pública, sem delivery

Ajustes de grid: mudar `lg:grid-cols-4` já existe → 4 cards cabem naturalmente. Manter Essencial como `highlight`.

Adicionar 1 linha de nota abaixo dos planos:
> "Já tem clientela na loja física? O plano **Somente PDV** é a frente de caixa pura — se quiser abrir delivery depois, migra num clique."

---

## 2. SEO puro — textos reescritos com foco em busca real

Alvo de intenção (queries reais que lojistas digitam no Google):
`sistema para delivery`, `cardápio digital grátis`, `PDV para restaurante`, `sistema de PDV barato`, `alternativa iFood`, `PDV com controle de caixa`, `sistema para pizzaria delivery`, `PDV para loja física`.

### 2.1. `<title>` e `<meta description>` (dentro do `useEffect`)

- **title**: `Sistema de Delivery e PDV para Restaurantes e Lojas | ItaSuper`
- **description**: `Sistema completo de delivery com cardápio digital, PIX automático, motoboy integrado e PDV para loja física. Sem comissão no plano fixo. Grátis para começar.`
- **og:title**: `ItaSuper — Delivery e PDV num app só`
- **og:description**: mesma da description

### 2.1.1. Corrigir canonical/og:url

Trocar `https://itasuper.com.br/` por `https://itasuper.lovable.app/` (domínio real hoje).

### 2.2. H1 (hero)

De: *"Cardápio digital, PIX e motoboy em 10 minutos."*
Para: **"Sistema de delivery e PDV para sua loja — pronto em 10 minutos."**

Subtítulo:
`Cardápio digital, PIX automático, motoboy integrado e frente de caixa (PDV) num app só. Sem mensalidade pra começar.`

### 2.3. H2s com palavras-chave

| Seção | Novo H2 |
| --- | --- |
| Dor → Solução | Chega de anotar pedido no papel e conferir PIX no banco |
| Como funciona | Como montar seu delivery em 10 minutos |
| Features (bento) | Tudo que restaurante, mercado e loja precisam |
| Segmentos | Feito para pizzarias, mercados, docerias, bares e lojas físicas |
| Motoboy | Motoboy integrado com mapa e código de entrega |
| Planos | Planos de delivery e PDV — cancele quando quiser |
| Autonomia | Plano sem a taxa de R$2 da plataforma na entrega |
| Depoimentos | O que os lojistas dizem sobre o ItaSuper |
| FAQ | Perguntas frequentes sobre o sistema |
| Final CTA | Cadastre sua loja e comece a vender hoje |

### 2.4. Ajustes de copy com keywords (sem enfeitar demais)

- **Feature "PDV de balcão"** → renomear para **"PDV para loja física"**, desc: `Frente de caixa completa: vendas, troco, sangria e fechamento do dia. Contrate à parte ou use o plano Somente PDV.`
- **Feature "Cardápio digital"** desc: `Cardápio digital com link próprio da sua loja — cliente abre no navegador, sem instalar app.`
- **Segmento "Serviços"** → **"Lojas físicas"**, desc: `Barbearia, pet shop, loja de roupa — use só o PDV, sem vitrine online.`

### 2.5. Novas FAQs (SEO long-tail)

Adicionar 2 perguntas ao array `faqs`:

- *"O ItaSuper é uma alternativa ao iFood?"* — Sim. Você tem seu próprio cardápio digital, recebe pedidos direto no seu link, PIX cai na sua conta na hora e a comissão é bem menor (0% no plano Essencial, contra ~27% das grandes plataformas).
- *"Serve para pizzaria com meio-a-meio e bordas?"* — Sim. O cardápio suporta sabor meio-a-meio, escolha de borda, adicionais e observações do cliente sem erro.

### 2.6. JSON-LD adicional

Além do `FAQPage` já existente, injetar no mesmo `useEffect`:

- **SoftwareApplication** (com `name`, `applicationCategory: "BusinessApplication"`, `operatingSystem: "Web, Android"`, `offers` listando os 4 planos com preço).
- **Organization** (name, url, logo `/itasuper-logo-horizontal.webp`, `sameAs` — vazio se não houver).

### 2.7. Alt/aria

Confirmar `alt="ItaSuper — sistema de delivery e PDV"` no logo do navbar (não só "ItaSuper").

---

## 3. Fora de escopo

- Nada de mexer em `plansInfo.ts`, billing, backend, rotas.
- Sem novas imagens.
- Sem mudança visual estrutural — só cópia + 1 card novo.

---

## 4. Versão

Após aplicar: bump patch → `v1.13.24 (build 883)` em `src/lib/appVersion.ts`, `src/pages/PerfilPage.tsx` e `android/app/build.gradle` (versionName + versionCode +1).
