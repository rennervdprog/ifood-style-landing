# Plano — APK Cliente: navegação Android + safe-areas

## 1. Botão Voltar do Android (fim dos bugs de "volta pra algo antigo")

Problema hoje: `capacitorNative.ts` chama `window.history.back()` cego. Isso pula pra qualquer entrada antiga do history (busca antiga, modal, deep-link OTA, etc.).

Solução — **stack de navegação controlado pelo app**, não pelo history do browser:

- Criar `src/lib/nativeNavStack.ts` — mantém uma pilha própria (`["/cliente", "/pizzaria-lagoinha", "/pizzaria-lagoinha?product=xyz"]`) baseada em `useLocation()`.
- Hook `useNativeNavStack()` no `App.tsx` que faz `push` em navegação nova e `pop` em back.
- Regras do back button (`capacitorNative.ts`):
  1. Se houver **modal/sheet/drawer aberto** (produto, carrinho, filtros) → fecha ele (dispara evento `native-back` que os modais escutam).
  2. Senão, se a stack tem >1 item → `pop` e `navigate(stack.top, { replace: true })`.
  3. Senão, se estiver em `/cliente` → `App.exitApp()` (minimiza).
  4. Senão → `navigate("/cliente")`.
- Modais (ProductModal, CartDrawer, SearchSheet) registram-se num `BackHandlerContext` com prioridade LIFO — o topo consome o back primeiro.
- Nunca mais usar `history.back()` cru.

## 2. Safe-areas — auditoria global

Criar utilitários únicos e aplicar em todas as telas fixas/sticky:

- `src/index.css`: classes `.safe-top`, `.safe-bottom`, `.safe-x` usando `env(safe-area-inset-*)` com fallback `0px`.
- Meta viewport: garantir `viewport-fit=cover` no `index.html`.
- `NativeShell.tsx`: aplicar `.safe-top` no wrapper raiz apenas quando não houver header fixo próprio da rota.

Componentes a auditar e corrigir:
- `BottomNav.tsx` — padding-bottom com safe-bottom (já feito, revalidar altura).
- `StorePage.tsx` header fixo — `.safe-top` (já feito).
- **Botão "Ver carrinho" flutuante** (`CartFloatingButton` / equivalente na StorePage) → `bottom: calc(env(safe-area-inset-bottom) + 88px)` para ficar acima do BottomNav.
- ProductModal, CartDrawer, CheckoutPage, AddressSheet, SearchSheet — top e bottom.
- OnboardingPermissions, Splash overlay, Toaster (`sonner` offset).
- ClientHome header (endereço) — safe-top.

## 3. Header sticky com transição on-scroll (igual web)

Problema: no APK o header da loja fica sempre branco. Na web, ele começa transparente sobre a capa e vira branco ao rolar, mantendo voltar/lupa/WhatsApp e a barra de categorias grudada.

Plano em `StorePage.tsx`:
- Extrair `StoreHeader.tsx` com estado `scrolled` via `useScrollY()` (throttle rAF).
- Estados:
  - `scrolled=false`: fundo transparente, ícones com bolha branca translúcida (como já é na web).
  - `scrolled=true`: fundo branco sólido, sombra sutil, mostra nome da loja + status "ABERTO".
- Abaixo do header, **CategoryTabs sticky** (`position: sticky; top: calc(env(safe-area-inset-top) + 56px)`) — mesma barra "Tradicional/Especial/Premium/Doces" da 2ª/3ª screenshot, mas grudando ao rolar.
- Garantir que ao rolar até uma seção, a tab correspondente ativa (IntersectionObserver por categoria).

## 4. Detalhes técnicos

- `nativeNavStack`: usar `useLocation().key` para deduplicar; ignorar navegações `replace`.
- `BackHandlerContext`: API `useBackHandler(fn, enabled)` — cada modal registra e desregistra no mount/unmount.
- Categoria sticky: usar `scroll-margin-top` nas seções pra o scroll-into-view não ficar atrás do header+tabs.
- Sem regressão web: tudo dentro de `if (isNativePlatform())` onde faz sentido; safe-areas usam `env()` que é 0 no browser.

## 5. Entregáveis / arquivos

Criar:
- `src/lib/nativeNavStack.ts`
- `src/lib/backHandler.tsx` (Context + hook)
- `src/components/store/StoreHeader.tsx`
- `src/components/store/CategoryTabsSticky.tsx`

Editar:
- `src/lib/capacitorNative.ts` (backButton reescrito)
- `src/App.tsx` (providers + tracker)
- `src/pages/StorePage.tsx` (usar StoreHeader + tabs sticky + safe-areas no botão carrinho)
- `src/components/ProductModal.tsx`, `CartDrawer.tsx`, `SearchSheet.tsx` (registrar back handler + safe-top)
- `src/components/BottomNav.tsx` (revalidar safe-bottom)
- `src/pages/CheckoutPage.tsx`, `AddressSheet` (safe-areas)
- `index.html` (`viewport-fit=cover`)
- `src/index.css` (classes safe-*)
- `src/lib/appVersion.ts` + `android/app/build.gradle` → v1.25.57 / versionCode 10020

## 6. Validação
- Playwright mobile viewport pra sticky header e botão carrinho.
- Checklist manual APK: voltar dentro de modal → fecha; voltar em loja → volta pra /cliente; voltar em /cliente → minimiza; header transita ao rolar; carrinho não encosta no BottomNav; nada atrás do notch.

Entrega tudo OTA (só JS/CSS) — não precisa novo APK.
