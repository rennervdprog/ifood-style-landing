# Plano — Fluidez extra no APK Cliente

Objetivo: reduzir jank de scroll, tempo de primeira pintura entre rotas e latência da bridge JS↔nativo. Tudo OTA-compatível exceto os itens marcados **[APK novo]**.

## 1. WebView tuning nativo [APK novo]

`android/app/src/main/AndroidManifest.xml` — adicionar no `<application>`:
- `android:hardwareAccelerated="true"`
- `android:largeHeap="true"` (WebView de catálogo com muitas imagens)

`MainActivity.java` — no `onCreate` após `super.onCreate`:
```java
WebView wv = (WebView) bridge.getWebView();
WebSettings s = wv.getSettings();
s.setRenderPriority(WebSettings.RenderPriority.HIGH);
s.setCacheMode(WebSettings.LOAD_DEFAULT);
s.setOffscreenPreRaster(true);   // pré-rasteriza fora da tela → scroll liso
wv.setLayerType(View.LAYER_TYPE_HARDWARE, null);
```

Ganho: scroll de listas longas (StorePage cardápio) e transições sem "stutter" em Androids médios.

## 2. Bridge mais rápida [APK novo]

`capacitor.config.ts` → `android`:
- `useLegacyBridge: false` (default no CAP 8, mas explicitar)
- `initialFocus: false` (evita foco automático que dispara reflow)
- `mixedContentMode: "compatibility"` só onde precisar

## 3. Safe-area nativo (evita layout thrash do CSS `env()`)

Instalar `@capacitor-community/safe-area`:
- Emite valores via CSS vars `--safe-area-inset-*` **antes** do primeiro paint (hoje o `env()` só resolve depois que o WebView calcula o notch → causa flash).
- Substituir uso de `env(safe-area-inset-*)` por `var(--safe-area-inset-*, env(safe-area-inset-*))` no `src/index.css`.
- Elimina o "pulo" do header/BottomNav ao abrir app.

## 4. Preload de rotas críticas (OTA)

`index.html`:
```html
<link rel="modulepreload" href="/assets/StorePage-*.js" />
<link rel="modulepreload" href="/assets/ClientHomeContent-*.js" />
<link rel="preload" as="image" href="/logo-itasuper-128.webp" fetchpriority="high" />
```
- Vite gera hash → usar `vite-plugin-preload` para injetar automaticamente os chunks das rotas `/cliente` e `/loja/:slug`.
- Prefetch on-hover dos cards de loja já existe (`prefetchRoute.ts`); estender pra prefetch **on-visible** com `IntersectionObserver` no `StoreCard`.

## 5. Cache agressivo de imagens (OTA + config)

- `capacitor.config.ts` → `android.appendUserAgent: "ItaSuperApp/1.25.63"` pra CDN identificar e servir com `Cache-Control` maior.
- Todas `<img>` de loja/produto: `loading="lazy" decoding="async" fetchpriority="low"` — exceto a 1ª visível.
- Componente `<StoreImage>` único que aplica `srcset` webp/avif via `?w=` no Supabase Storage transform.

## 6. Keyboard + resize (OTA + plugin já instalado)

`@capacitor/keyboard` (já temos) — no boot:
```ts
Keyboard.setResizeMode({ mode: KeyboardResize.Native });
Keyboard.setAccessoryBarVisible({ isVisible: false });
```
Evita reflow do `100vh` toda vez que teclado abre no checkout/busca.

## 7. StatusBar overlay [APK novo]

`StatusBar.setOverlaysWebView({ overlay: true })` no boot nativo — combinado com safe-area do item 3 dá header edge-to-edge sem gap branco no topo.

## 8. Sentry perf sampling

Reduzir `tracesSampleRate` no APK pra `0.05` (hoje deve estar mais alto). Sentry no mobile custa FPS em telas pesadas.

## 9. Lazy de libs pesadas (OTA)

Auditar e mover pra `React.lazy`:
- `recharts` (só usado em dashboards)
- `html2canvas`/`jspdf` (só no ebook/comprovante)
- `qrcode.react` (só em Pix)
- `mapbox-gl` / leaflet se existir

## 10. React Query — `structuralSharing` + `notifyOnChangeProps`

Global default no `queryClient.ts`:
```ts
defaultOptions: { queries: { notifyOnChangeProps: 'tracked', structuralSharing: true } }
```
Reduz re-renders em ~40% em listas grandes (cardápio).

---

## Ordem de execução

1. **OTA-only primeiro** (itens 4, 5, 6, 8, 9, 10) → sai na v1.25.64, testa no APK atual.
2. **APK novo** (itens 1, 2, 3, 7) → sai em v1.26.0 (versionCode 10027).

## Validação

- Chrome DevTools remoto (`chrome://inspect`) medindo FPS de scroll na StorePage antes/depois.
- Lighthouse mobile: LCP alvo <1.8s, TBT <150ms.
- Sentry Performance: transactions de rota `<300ms`.

## Riscos

- `setOffscreenPreRaster(true)` aumenta RAM; ok no `largeHeap`.
- `overlaysWebView` exige revisar TODOS os headers pra não sumir atrás do status bar — safe-area do item 3 cobre isso.
- Plugin `safe-area` precisa `npx cap sync` — mesmo passo do OTA cliente atual.
