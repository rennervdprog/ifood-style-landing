## Diagnóstico

- **Web ok, Partner APK ok, Cliente APK travado.** Como partner e cliente compartilham a mesma base, mas usam **canais OTA separados** (feito na v1.25.62), o partner ainda não recebeu as últimas mudanças — logo o problema está numa alteração recente aplicada só ao cliente.
- **Sintoma:** scroll vertical só funciona quando o dedo começa sobre a `BottomNav`. Em qualquer área de conteúdo o gesto é engolido.
- **Suspeitos recentes (v1.25.72 → 1.25.78):**
  1. Troca de ícones Lucide → **Iconify** (`AppIcon` com SVG renderizado async).
  2. Refactor de `<button>` para `<div role="button">` nos cards.
  3. Regras globais de `touch-action` em `src/index.css` (última patch minha).
  4. `captureInput: true` + `useLegacyBridge: false` no `capacitor.config.ts`.

## Plano de correção (em ordem, cada passo publicado via OTA para o cliente)

### Passo 1 — Isolar a causa raiz (sem chutar)
- Adicionar log temporário no `main.tsx` do cliente: registrar `touchstart`/`touchmove` no `document` com `{passive:true}` logando `event.target.tagName`, `event.defaultPrevented` e `getComputedStyle(target).touchAction`.
- Publicar OTA; próximo turn os logs do console do WebView aparecem automaticamente no meu contexto.

### Passo 2 — Reverter o global de `touch-action` que introduzi
- No `src/index.css`, remover o bloco `.native-app, .native-app button, .native-app a, [role="button"] { touch-action: pan-y }`. Definir `touch-action` no root altera comportamento do WebView de forma imprevisível; voltar para o `data-native-scroll-pan` cirúrgico + `touch-action: auto` no `#root`.

### Passo 3 — Neutralizar Iconify como suspeito
- Envolver `<Icon>` do Iconify com `<span style="pointer-events:none; touch-action:pan-y">`. SVGs do Iconify chegam com `<svg>` que em alguns WebViews Android capturam o `touchstart` até serem "hidratados", bloqueando o scroll no primeiro gesto.

### Passo 4 — Reverter os `<div role="button">` para `<button>` novamente
- A conversão pra `div` não resolveu (a origem era outra) e adiciona custo de acessibilidade. Voltar para `<button type="button">` com `touch-action: manipulation` apenas no botão, sem herdar para filhos.

### Passo 5 — Ajustes no `capacitor.config.ts` (requer novo APK, opcional)
- `captureInput: false` (deixa a View nativa não interceptar toques).
- `useLegacyBridge: true` temporariamente para comparar; a bridge nova tem tickets abertos de touch-lag em Android 12/13.
- Isso NÃO vai por OTA — só entra se os passos 1–4 não resolverem.

### Passo 6 — Validação
- Rodar Playwright headless em `localhost:8080` com viewport mobile e `hasTouch:true` para confirmar que a mudança não regride a web.
- Bumpar versão a cada iteração (`1.25.79`, `.80`…) e sincronizar `PerfilPage` + `build.gradle`.
- Pedir ao usuário para atualizar o app cliente e testar o scroll na home e em pelo menos uma tela extra.

## Detalhes técnicos

- Bibliotecas envolvidas: `@iconify/react`, `@capacitor/core`, `@capgo/capacitor-updater`.
- Arquivos que devem mudar nesta rodada: `src/index.css`, `src/components/ui/app-icon.tsx`, `src/pages/cliente/home/StoreCard.tsx`, `BentoHero.tsx`, `HighlightsBento.tsx`, `DiscoverGrid.tsx`, `ClientHomeContent.tsx`, `src/main.tsx` (log temporário), `src/lib/appVersion.ts`, `android/app/build.gradle`, `src/pages/PerfilPage.tsx`.
- Sem alteração de banco, edge functions ou lógica de negócio.

## Ordem de execução proposta

```text
1. Instrumentar logs   → OTA v1.25.79
2. Ler console na próxima mensagem do usuário
3. Aplicar fixes 2+3+4 juntos → OTA v1.25.80
4. Se persistir → mudar capacitor.config.ts + novo APK
```

Confirma que posso executar os passos 1 e 2 (instrumentação + reversões CSS/JSX) já nesta rodada?