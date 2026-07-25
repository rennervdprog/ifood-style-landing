# Plano — App Cliente (Capacitor) v1.25.52

## Problemas observados
1. **Topo colado no notch / bottom colado nos gestos** — `NativeShell` só é usado em algumas telas; `/cliente` e `/loja/:slug` renderizam fora dele, então `env(safe-area-inset-*)` não é aplicado.
2. **Splash com fundo laranja + texto** — hoje a splash usa `@drawable/splash` (imagem cheia). Precisa virar fundo branco + ícone centralizado.
3. **Permissão de localização dispara ANTES da tela explicativa** — no boot do app, algum efeito chama `readGps()` / `requestLocationPermission()` automaticamente, então o prompt nativo aparece sem contexto.

## O que vou mudar

### 1. Safe-area global no APK Cliente
- Envelopar `<Outlet />` do layout cliente com um wrapper que aplica `padding-top: env(safe-area-inset-top)` e `padding-bottom: env(safe-area-inset-bottom) + altura-bottom-tabs` **em todas as rotas do cliente** (não só nas que usam `NativeShell`).
- Ajustar header branco do `/cliente` e header da `StorePage` para respeitar o inset do topo (background estende até o topo, conteúdo desce).
- Configurar `StatusBar.setOverlaysWebView({ overlay: false })` + `setBackgroundColor("#FFFFFF")` + `setStyle(Style.Dark)` no boot do APK Cliente (já parcialmente feito, revisar).
- Configurar `NavigationBar` (plugin `@capacitor-community/navigation-bar`) para cor branca e ícones escuros no Android, evitando barra preta cortando conteúdo.

### 2. Splash screen só com ícone
- Substituir `android/app/src/main/res/drawable/splash.xml` por um `<layer-list>` com fundo branco (`#FFFFFF`) e o ícone `@mipmap/ic_launcher` centralizado (tamanho fixo ~200dp).
- Ajustar `capacitor.config.ts` → `SplashScreen`: `backgroundColor: "#FFFFFF"`, `androidScaleType: "CENTER"`, `showSpinner: false`, `splashFullScreen: false`, `splashImmersive: false`.
- Remover qualquer texto/logo composto da splash antiga.

### 3. Prompt de localização controlado
- Auditar `nativeBoot.ts`, `ClientHomeContent.tsx`, `useUserLocation.ts` e `location/resolve.ts` para achar quem chama `requestLocationPermission` / `readGps` no mount.
- Regra nova no APK Cliente: **nunca** chamar `requestLocationPermission()` automaticamente. Só disparar via gesto do usuário (clique em "Usar minha localização" ou no seletor "ENTREGAR EM").
- Boot do cliente usa apenas cache (`cacheGet`) — se não houver, exibe estado "Selecione sua cidade" sem prompt.
- Criar tela/bottom-sheet explicativa `LocationPermissionSheet` que abre ao clicar no seletor: mostra por que precisamos, e só então chama `requestLocationPermission()`.

### 4. Versão
- Bump `src/lib/appVersion.ts` → `1.25.52`.
- Bump `android/app/build.gradle` → `versionName "1.25.52"`, `versionCode 10015`.

## Detalhes técnicos
- Layout wrapper: novo `ClientNativeLayout` com `className="min-h-dvh pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+4.5rem)]"` aplicado no `Route` do `/cliente/*`, `/loja/*`, `/carrinho`, `/checkout`, `/pedidos`, `/perfil` quando `isClientNative`.
- Splash: manter `splashResourceName: "splash"` mas o drawable vira layer-list branco + ícone.
- Guard de permissão: `LOCATION_AUTO_REQUEST` flag = `false` em APK Cliente; hooks respeitam a flag.

## Pós-deploy
Usuário faz `git pull` → roda workflow **Build Android APKs → cliente** → instala v1.25.52.
