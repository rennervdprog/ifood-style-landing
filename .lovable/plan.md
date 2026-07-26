
## Diagnóstico

Na web o `header sticky top-0` funciona. No Capacitor não. Causas prováveis (já validadas no código):

1. **`backdrop-blur` + `bg-background/95`** — no Android WebView, `backdrop-filter` num elemento `position: sticky` frequentemente quebra a "pregação". O elemento vira layer composited e o browser deixa de re-stickar durante scroll do WebView.
2. **Dois containers de rolagem** — hoje `html.native-app { overflow-y: auto; height: 100% }` + `body { overflow-y: visible }`. Em teoria só o html rola, mas o `#root { min-height: 100svh }` combinado com `min-h-dvh` no wrapper do ClientHomeContent pode criar um segundo scroller virtual (100dvh mede a viewport visual, não a layout — WebView Android reporta valores diferentes conforme a status bar).
3. **Header dentro de `<div class="min-h-dvh">`** — se esse wrapper virar o scroller (por qualquer overflow implícito), o sticky gruda no topo do wrapper (que já está em 0) e "some" junto no scroll.
4. **Regra `body.native-app header.sticky.top-0 { padding-top: env(safe-area-inset-top) }`** — aplica padding só no header, mas o `top-0` fica ancorado no topo do container. Em Android sem edge-to-edge configurado corretamente, `env(safe-area-inset-top)` retorna 0, então o header cola na status bar e "some" atrás dela.

## O que fazer

### 1. Trocar backdrop-blur por fundo sólido no app nativo
No `src/pages/cliente/home/ClientHomeContent.tsx`, deixar o `<header>` sem `backdrop-blur` e usar `bg-background` opaco. Já temos regra global forçando `background-color: hsl(var(--card)) !important` em headers sticky no `.native-app` — reforçar removendo `backdrop-filter` da própria classe.

### 2. Garantir um único scroller e altura consistente
Em `src/index.css`:
- Trocar `min-height: 100%` / `min-h-100svh` do `html.native-app` por `height: 100dvh` fixo, e no `body` `height: auto`.
- Remover `min-h-dvh` do wrapper do ClientHomeContent no app nativo (usar classe condicional ou substituir por `min-h-full`). Wrappers com `min-h-dvh` competem com o `html` pelo papel de scroller.

### 3. Edge-to-edge + status bar transparente (Android)
Para `env(safe-area-inset-top)` retornar valor real no APK:
- `MainActivity.java`: chamar `WindowCompat.setDecorFitsSystemWindows(getWindow(), false)`.
- `styles.xml`: `<item name="android:statusBarColor">@android:color/transparent</item>` e `windowTranslucentStatus=false`.
- `capacitor.config.ts`: `StatusBar: { overlaysWebView: true, style: 'DARK', backgroundColor: '#00000000' }`.

Sem isso o header "cola" atrás da status bar e parece sumir.

### 4. Fallback JS de detecção
Se após 1–3 o problema persistir num device específico, adicionar em `nativeBoot.ts` um observador que aplica `position: fixed; top: 0` no header quando `Capacitor.isNativePlatform()` — fixed é imune a bug de sticky em WebView. Contrapartida: precisa `padding-top` equivalente à altura do header no `<main>` para não sobrepor conteúdo.

## Ordem de execução

1. Ajustar CSS do header (remover backdrop-blur no nativo) + tornar `html` o único scroller com altura fixa.
2. Habilitar edge-to-edge + StatusBar overlay no Android.
3. Gerar APK novo, testar. Se ainda falhar em algum device, aplicar fallback `position: fixed` só no `.native-app`.
4. Bump de versão (1.26.4) nos dois lugares (PerfilPage + build.gradle com versionCode+1).

## Detalhes técnicos

Arquivos afetados:
- `src/index.css` — regras `.native-app` de scroll/header.
- `src/pages/cliente/home/ClientHomeContent.tsx` — classes do `<header>` e do wrapper.
- `android/app/src/main/java/.../MainActivity.java` — edge-to-edge.
- `android/app/src/main/res/values/styles.xml` — status bar transparente.
- `capacitor.config.ts` — StatusBar overlaysWebView.
- `src/pages/PerfilPage.tsx` + `android/app/build.gradle` — bump 1.26.4.

Requer novo APK (mudanças nativas). OTA não cobre.
