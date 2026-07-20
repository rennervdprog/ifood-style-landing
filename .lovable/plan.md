# Plano — Landing StoreDirectory v2 (dados reais + copy persuasivo)

## Objetivo
A landing atual está bonita, mas genérica em cima de "grátis". Vamos plugar **informações reais do sistema** que ninguém sabe que existem (ex.: quem paga a taxa da plataforma — cliente, meio-a-meio ou lojista), aprofundar prova social/rapport e reforçar autoridade — sem quebrar o que já funciona.

## Princípios de copy (persuasão + rapport)
- **Cialdini**: reciprocidade (grátis até R$5k), prova social (X lojas ativas), autoridade (Asaas, LGPD, contrato), escassez (10 vagas Apoiador), compromisso ("sem multa, cancela a qualquer momento"), afinidade ("feito em Itatinga, pra loja de bairro").
- **Rapport**: linguagem do lojista ("cai no seu PIX", "sem depender de marketplace"), quebra de objeção antes da pergunta.
- **Hierarquia**: 1 promessa por seção, 1 CTA por dobra, benefício antes de feature.

## Novas seções (a inserir na StoreDirectory)

### 1. Bloco "Você escolhe quem paga a taxa de entrega" *(NOVO — diferencial exclusivo)*
Hoje o sistema já tem `stores.platform_fee_split` com 3 modos, mas **ninguém comunica isso**. Isso é ouro competitivo.

3 cards lado a lado, cada um com ícone + título + micro-copy + exemplo numérico:
- **Cliente paga** (padrão): "R$ 0,99 somado à taxa. Zero do seu caixa."
- **Meio a meio**: "Você absorve R$ 0,49 e passa R$ 0,50 pro cliente. Mostra cuidado sem doer."
- **Lojista paga**: "Taxa some pro cliente. Converte mais em ticket alto."
Encerra com selo: "Muda quando quiser, sem sair do painel."

### 2. Bloco "O que o iFood não te dá" *(comparativo direto)*
Tabela 3 colunas: **ItaSuper × Marketplace × WhatsApp na mão**. Linhas com dados reais:
- Comissão (0% Essencial × ~27% × 0%)
- PIX na sua conta (Sim × Não × Manual)
- Dono da base de clientes (Você × Eles × Você)
- Bot de WhatsApp guiado, PDV, Motoboy próprio, Cupom/Fidelidade próprios.

### 3. Bloco "Modos de recebimento reais" *(reforça confiança)*
Cards horizontais mostrando o que já existe:
- **PIX Automático (Asaas)** — cai confirmado, libera pedido sozinho.
- **Pix Direto** — cai na sua chave, você confirma com 1 toque (novo, do lojista que pediu).
- **Dinheiro / Cartão na entrega / PIX Maquininha** — plataforma acumula só o R$ 0,99, cobra por PIX quando passar de R$ 30.
Cada card com o texto real dos Termos, resumido.

### 4. Bloco "Módulos que você liga quando precisar" *(add-ons reais)*
Grid dos add-ons que já cobramos separado:
- **PDV Balcão** — R$ 49/mês (só Essencial/Autonomia; grátis se for plano PDV Only).
- **WhatsApp Bot Guiado** — cliente pede sem sair da conversa.
- **Motoboy próprio** — cadastra seus entregadores, comissão configurável.
- **Cardápio Boutique (roupas)** — grade P/M/G, estoque por variação, etiqueta com código de barras.
Copy: "Paga só o que usar. Cancela o add-on em 2 cliques na aba Meu Plano."

### 5. Bloco "Regras do jogo, sem letra miúda" *(quebra de objeção)*
3 quadros honestos:
- **Quando a mensalidade começa**: "Essencial: após R$ 5.000 em 60 dias → R$ 180/mês. Autonomia: após R$ 2.500 → R$ 239,90/mês. Com 30 dias de aviso e aceite expresso (cláusula 5.2)."
- **Cobrança PIX pendente**: "Saldo passa de R$ 30 → gera PIX pra segunda-feira. Passa de R$ 500 → painel limita até quitar."
- **Cancelamento**: "Sem multa, sem fidelidade. Desativa a loja no painel."

### 6. Bloco "Feito por quem entende de loja de bairro" *(rapport local)*
Micro-manifesto curto + logo Asaas + selo LGPD + link Termos/Privacidade. Frase-âncora: "Não somos um marketplace. Somos o seu sistema — a marca é sua, o cliente é seu, o PIX é seu."

### 7. Ajustes nas seções existentes
- **Hero**: trocar sub-título por promessa mensurável: "Comece grátis. Você só paga mensalidade depois de faturar R$ 5.000."
- **Planos**: puxar valores direto de `src/lib/plansInfo.ts` (fonte única) e mostrar o **exemplo prático** (`plan.example(50)`) que já existe no código e não está sendo usado.
- **FAQ**: adicionar 3 perguntas novas — "Posso passar a taxa pro cliente?", "E se eu quiser só o PDV?", "O bot do WhatsApp responde sozinho?".
- **Depoimentos**: marcar como "depoimentos ilustrativos" até termos reais (evita risco jurídico) OU trocar por métricas neutras ("X pedidos processados", "Y cidades atendidas") puxadas do banco.

## UI/UX
- Manter o design system atual (tokens semânticos, sem cor hardcoded).
- Cada bloco novo com: eyebrow pequeno + H2 forte + 1 linha de suporte + conteúdo + micro-CTA.
- Micro-animações discretas (fade-up no scroll) — nada de parallax pesado.
- Mobile-first: cards viram carrossel horizontal com snap onde couber (bloco 1, 3 e 4).
- Ícones do lucide já usados; nada novo pesado.
- Contraste WCAG AA verificado em light/dark.

## Detalhes técnicos
- Arquivo único: `src/pages/StoreDirectory.tsx` (mantém estrutura, adiciona 6 seções entre "Recursos" e "Planos" e ajusta hero/FAQ).
- Constantes novas (`FEE_SPLIT_MODES`, `PAYMENT_MODES`, `ADDONS`, `RULES`) no topo do arquivo, seguindo o padrão de `PAINS`/`FEATURES`.
- Planos: importar `PLANS` de `@/lib/plansInfo.ts` (já importado) e usar `plan.example(50)` no card.
- Sem chamadas novas de backend — só conteúdo estático que reflete regras reais.
- Incrementar versão em `PerfilPage.tsx` e `android/app/build.gradle` (patch + versionCode).

## Fora de escopo
- Não mexer em rotas, auth, cadastro, ou lógica de cobrança.
- Não gerar imagens novas (usar ícones existentes).
- Não alterar `plansInfo.ts` (só consumir).
