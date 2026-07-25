# Plano: Correção do APK Cliente (navegação travada + safe-areas Android)

## Problemas identificados

### 1. Navegação presa em `/cliente`
No `CapacitorRouteGuard.tsx`, o whitelist do modo **client** (`CLIENT_ALLOWED_PREFIXES`) **não inclui**:
- `/` (raiz — o `<Link to="/loja/:id">` do `StoreCard` passa por aqui em alguns fluxos)
- rotas dinâmicas de loja por **slug** (ex.: `/dudalanches`) — o catch-all `/:slug` que renderiza `StorePage` cai fora da whitelist e é redirecionado de volta para `/cliente`
- `/lojas`, `/cidade/*`, `/busca`

Resultado: qualquer clique em card de loja/produto que resolva para slug (não `/loja/:id`) é interceptado e devolvido para `/cliente` → **efeito "preso na home"**.

### 2. Safe-areas Android (notch + gesture bar)
- `capacitor.config.ts` não declara `overrideUserInterfaceStyle` nem plugin `StatusBar`/`EdgeToEdge`.
- `AndroidManifest` / `styles.xml` provavelmente sem `windowLayoutInDisplayCutoutMode=shortEdges` e sem `enableEdgeToEdge`.
- O CSS usa `pb-[5.25rem]` fixo em `NativeShell`, sem `env(safe-area-inset-bottom)`, então a bottom-tab cobre a barra de gestos e o conteúdo entra embaixo do notch.

---

## Passos

### A. Liberar navegação no APK Cliente
1. Em `CapacitorRouteGuard.tsx`:
   - Trocar a lógica do modo `client`: em vez de whitelist restritiva, usar **blacklist** = apenas `PARTNER_ROUTES` são bloqueadas. Todo o resto (incluindo `/:slug`, `/loja/:id`, `/`, `/cidade/*`) é liberado.
   - Manter o redirect `/` → `/cliente` só quando o usuário está logado como cliente puro (não quebra navegação profunda).
2. Garantir que links do `StoreCard`, `DiscoverGrid` e `HighlightsBento` usem rotas absolutas conhecidas (`/loja/:id` ou `/:slug`) — já usam, só destravar o guard resolve.

### B. Safe-areas / Edge-to-edge Android
1. `capacitor.config.ts`: adicionar plugin `StatusBar` com `overlaysWebView: false`, `style: 'DARK'`, `backgroundColor: '#FFFFFF'` (header branco do /cliente).
2. Instalar `@capacitor/status-bar` (já pode estar) e aplicar no `nativeBoot.ts`:
   - `StatusBar.setOverlaysWebView({ overlay: false })`
   - `StatusBar.setBackgroundColor({ color: '#FFFFFF' })`
3. `android/app/src/main/res/values/styles.xml`: adicionar `<item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>` e `<item name="android:fitsSystemWindows">true</item>` no `AppTheme.NoActionBarLaunch`.
4. CSS global (`index.css`): adicionar utilitário `.safe-top { padding-top: env(safe-area-inset-top); }` e `.safe-bottom { padding-bottom: calc(env(safe-area-inset-bottom) + 5.25rem); }`.
5. `NativeShell.tsx`: trocar `pb-[5.25rem]` por `safe-bottom`; header do `/cliente` ganha `safe-top`.
6. `NativeBottomTabs`: adicionar `padding-bottom: env(safe-area-inset-bottom)` no container.

### C. Bump de versão + rebuild
- `appVersion.ts` → v1.25.51
- `build.gradle` → versionName "1.25.51", versionCode 10014
- Rodar workflow **Build Android APKs → cliente** e reinstalar.

---

## Detalhes técnicos

- Blacklist em vez de whitelist reduz risco de regressão futura ao adicionar rotas cliente.
- `overlaysWebView: false` é o modo mais seguro (não precisa refatorar todos os headers para respeitar `safe-area-inset-top`); se quiser visual "cheio até o topo" depois, invertemos.
- `shortEdges` no cutout mode faz o app usar a área do notch em landscape sem esconder conteúdo.
- Nenhum impacto no APK Parceiro — mudanças no guard são dentro do branch `currentMode === "client"`; StatusBar/styles são compartilhados mas neutros no parceiro (fundo escuro já combina).

## Fora do escopo
- Refatorar visual dos headers para "immersive full bleed" (deixamos para depois se quiser).
- iOS (não gera APK, mas as mudanças de CSS/plugin já ficam prontas para quando for buildar).
