# Plano — Frentes 3 + 4 (cold start Parceiro) sem quebrar nada

Objetivo: cortar mais **1–2 s** no cold start do APK Parceiro **sem** afetar o APK Cliente nem a versão web. Estratégia: mudanças **aditivas e reversíveis**, cada uma por trás de um gate explícito (`isPartnerNative` em runtime ou `VITE_CAPACITOR_APP_MODE` em build), com validação de build entre etapas.

---

## Etapa A — Detecção síncrona do modo Parceiro

**Por quê.** Hoje `getCapacitorAppMode()` mistura runtime + storage + `App.getInfo()` async. Para gate no `App.tsx` precisamos de um booleano **síncrono e estável** no primeiro render, senão os componentes ancillary vão montar e desmontar (pior que não fazer nada).

**Ação.** Adicionar em `capacitorAppMode.ts` uma função `isPartnerNativeSync()` que só olha:
1. `import.meta.env.VITE_CAPACITOR_APP_MODE === "parceiro"` (build time — infalível quando o workflow setar), OU
2. `window.__CAP_PARTNER_REDIRECTED` (já setado pelo `main.tsx` no rewrite de `/` → `/portal-parceiro`), OU
3. `localStorage.cap_app_mode === "partner"` (sessão anterior).

Sem async, sem `App.getInfo()`. Se qualquer um for true → partner. Falso-negativo é seguro (só perde a otimização, não quebra nada).

**Risco.** Zero — é uma função nova, não altera comportamento existente.

---

## Etapa B — Gate `showAncillary` no `App.tsx`

**Por quê.** Hoje todos estes componentes montam no primeiro render, mesmo no Parceiro: `InstallPrompt`, `NotificationPrompt`, `DownloadAppPrompt`, `GlobalRealtimeSync`, `CapacitorPermissionsOnboarding`, `TermsChecker`, `ClientPinChecker`, `RecoveryRedirect`, `StoreAppGuard`, `DebugOverlay`.

**Ação.**
- Introduzir `const [showAncillary, setShowAncillary] = useState(false)` que vira `true` via `requestIdleCallback` (fallback `setTimeout(800)`).
- Envolver o bloco de componentes ancillary em `{showAncillary && <>…</>}`.
- Adicionalmente, no Parceiro (`isPartnerNativeSync()`), **nunca** montar: `InstallPrompt`, `NotificationPrompt`, `DownloadAppPrompt` (banners web-only).
- `CartProvider`, `StoreProvider` continuam eager — muitos hooks dependem deles (StorePage, CartPage), remover quebraria rotas de cliente do bundle compartilhado. Mantidos.

**Risco baixo.** Componentes ancillary não são visíveis nos primeiros 800 ms de qualquer forma (splash cobre). O único efeito colateral possível: `TermsChecker` mostra modal 800 ms depois — aceitável. `RecoveryRedirect` só age quando URL tem token de recovery — deferir 800 ms é irrelevante.

**Validação:** build + smoke-test na rota `/portal-parceiro` no preview.

---

## Etapa C — Prefetch inteligente ao invés de "excluir chunks"

**Por quê.** O plano original propunha um plugin Vite que substituía páginas de cliente por stubs no APK Parceiro. **Isso é frágil**: quebra fácil qualquer `import` cruzado (ex.: um util que uma página cliente exporta e uma partner importa), força manter duas listas paralelas de rotas e complica debugging. **Não vale o risco.**

**Ação alternativa (mais segura, ganho quase igual).** Como as rotas já são todas `React.lazy`, cada página é um chunk async separado. O que importa no cold start é **quais chunks o webview baixa nos primeiros 2 s**. Vamos:

1. Emitir `<link rel="modulepreload">` para os chunks certos **no `index.html` gerado**, via plugin Vite mínimo:
   - Se `VITE_CAPACITOR_APP_MODE=parceiro` → preload `PartnerLogin` + `AdminDashboardV2` + `DriverDashboardV2`.
   - Se `cliente` ou vazio → preload `StoreDirectory` + `ClientHome`.
2. Garantir no workflow `build-android.yml` que o build Parceiro roda com `VITE_CAPACITOR_APP_MODE=parceiro`.
3. Confirmar que `App.tsx` já faz o prefetch das outras rotas do parceiro em idle (já faz — linhas 291-316).

**Risco.** Zero — `modulepreload` é meramente uma dica ao browser, mesmo se apontar para chunk errado o app funciona (só perde a otimização).

**Ganho estimado:** -800 ms a -1,5 s no tempo até a rota inicial ser interativa (chunks baixam em paralelo com o parse do main bundle, não sequencialmente).

---

## Etapa D — Auditoria pós-mudança

Após A+B+C:
1. `bun run build` local (garante build passa).
2. Verificar visualmente `/portal-parceiro` e `/` no preview web (nenhum banner deve sumir na web — o gate é `isPartnerNativeSync`, que retorna false no browser).
3. Bump para **v1.11.43** / `versionCode 797`.
4. Rodar o workflow Android e medir cold start real com `adb shell am start -W` na próxima abertura.
5. Rápida revisão de segurança conforme sua preferência: confirmar que o gate `isPartnerNativeSync` não expõe nenhum path admin ao usuário errado (é só sobre montar UI ancillary, não sobre RoleGuard/policies — estes ficam intactos).

---

## O que NÃO vou fazer

- ❌ Plugin Vite que remove/stubba páginas — alto risco de quebrar imports cruzados.
- ❌ Remover `StoreProvider` ou `CartProvider` do Parceiro — hooks espalhados em rotas compartilhadas quebrariam.
- ❌ Mexer em `RoleGuard`, RLS, edge functions ou qualquer camada de segurança.
- ❌ Trocar router, QueryClient, tema ou qualquer coisa que force retest de tudo.

## Arquivos que mudam

- `src/lib/capacitorAppMode.ts` — adiciona `isPartnerNativeSync()`.
- `src/App.tsx` — gate `showAncillary` + gate `isPartnerNative` para banners.
- `vite.config.ts` — pequeno plugin `modulepreload-initial-route` que lê `VITE_CAPACITOR_APP_MODE` e injeta `<link rel="modulepreload">` no HTML final.
- `.github/workflows/build-android.yml` — passar `VITE_CAPACITOR_APP_MODE=parceiro` (se ainda não passa) no step do build Parceiro.
- `src/lib/appVersion.ts` + `android/app/build.gradle` — bump 1.11.43 / vc 797.

Tudo reversível com um único revert por arquivo.
