# Profissionalização da página `/cliente`

Hoje `src/pages/ClientHome.tsx` tem **861 linhas** num único arquivo, misturando: tela de autenticação (login/cadastro/recuperação/reset), home logada (busca, lojas próximas, "pedir de novo", pedidos recentes), ordenação geográfica, status de loja e bottom nav. Visualmente é funcional, mas não tem a hierarquia de um app de delivery moderno (iFood, Rappi, Uber Eats): falta hero contextual, skeleton states, categorias, ofertas, endereço no topo, e o fluxo de auth ocupa a página inteira ao invés de ser um sheet.

---

## Fase 1 — Reorganização estrutural (sem mudança visual)

Quebrar `ClientHome.tsx` em módulos coesos, mantendo a rota `/cliente` como wrapper fino.

```text
src/pages/cliente/
├── ClientHome.tsx              (wrapper, ~80 linhas: decide auth vs home)
├── auth/
│   ├── ClientAuthSheet.tsx     (login/signup/forgot/reset)
│   ├── useClientAuth.ts        (lógica de submit, remember-me)
│   └── authValidation.ts       (CPF/CNPJ, WhatsApp, senha)
├── home/
│   ├── ClientHomeHeader.tsx    (saudação + endereço + busca)
│   ├── NearbyStoresSection.tsx
│   ├── ReorderSection.tsx      ("pedir de novo")
│   ├── RecentOrdersSection.tsx
│   └── CategoryChips.tsx       (novo)
└── hooks/
    ├── useNearbyStores.ts      (query + mapStoresWithHours)
    └── useReorderSuggestions.ts
```

Sem mudar API pública nem rota.

## Fase 2 — Novo layout da Home logada (visual)

Inspiração: iFood/Rappi, mas com identidade ItaSuper (sem roxo genérico).

- **Header sticky** com saudação (`Olá, Renner`), endereço atual clicável (abre seletor) e ícone de notificações.
- **Search bar grande** com placeholder rotativo ("Buscar pizza", "Buscar mercado"...).
- **Chips de categoria** horizontais (Pizza, Mercado, Marmita, Farmácia, Hortifruti) com ícones.
- **Carrossel "Pedir de novo"** (cards horizontais com foto do produto/loja).
- **Seção "Perto de você"** com cards densos: foto, nome, tag (Aberto/Fechado), distância, tempo estimado, taxa de entrega, rating.
- **Banner promocional** dinâmico (cupons ativos / lojas em destaque).
- **Skeleton loaders** em todas as seções (hoje há flicker).
- **Empty states** ilustrados quando não há lojas próximas.

## Fase 3 — Novo fluxo de Autenticação

Tirar o auth da página cheia. Quando o usuário não está logado:

- Mostrar **preview da home** (lojas em destaque, sem dados pessoais) com call-to-action "Entrar para pedir".
- **Bottom sheet** mobile / **modal centralizado** desktop para login/cadastro.
- **Login social** (Google) em destaque, e-mail/senha secundário.
- **Cadastro em etapas** (e-mail+senha → nome+CPF → WhatsApp) com progress bar — reduz abandono.
- **Recuperação de senha** em sheet, sem trocar de tela.

## Fase 4 — Personalização & contexto

- **Endereço ativo** no topo (vindo de `useUserLocation` + endereços salvos no profile). Clicar abre seletor de endereços salvos + opção "usar localização atual".
- **Histórico inteligente**: ordenar "Pedir de novo" pelos itens mais repetidos nas últimas 4 semanas, não só o último pedido.
- **Recomendações por horário**: às 11h destacar marmitarias, às 19h pizzarias.
- **Saudação dinâmica** (Bom dia/tarde/noite + primeiro nome).

## Fase 5 — Performance & PWA

- Code-split de `ClientAuthSheet` (lazy quando user é null).
- `useQuery` com `staleTime` agressivo (5min) para lojas e horários.
- Pré-carregar `StorePage` ao passar o dedo sobre o card (`onPointerEnter` + `<link rel="prefetch">`).
- Imagens das lojas em `loading="lazy"` + `decoding="async"` + placeholder blur.
- Skeleton no primeiro paint enquanto bootstrap roda (evitar CLS, como já fizemos na StorePage).

## Fase 6 — Acessibilidade & polish

- Labels ARIA em todos os botões de ícone.
- Foco visível em chips e cards.
- Suporte completo a teclado (Tab/Enter).
- Dark mode coerente com tokens existentes (sem hardcode).
- Vibração tátil leve em ações principais (Capacitor Haptics) no app nativo.

---

## Estratégia de execução

Mesma do PDV: **"trocar o pneu com o carro andando"**. Cada fase entrega valor isolado, sem quebrar a rota `/cliente`. A Fase 1 é puramente técnica (split de arquivos, zero risco visual); a Fase 2 já entrega impacto visível ao usuário.

## Perguntas antes de começar

1. **Por onde começar?** Fase 1 (limpeza técnica primeiro) ou Fase 2 (resultado visual imediato)?
2. **Login social Google** já está configurado no backend ou precisa habilitar no fluxo desta refatoração?
3. **Categorias** (Pizza, Mercado, Marmita...) — usar as categorias reais das lojas no banco ou criar uma taxonomia fixa no front?
