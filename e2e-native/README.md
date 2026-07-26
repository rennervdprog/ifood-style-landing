# E2E no WebView do app Android (Playwright via CDP)

Roda os mesmos specs que já usamos no browser (`e2e/`), porém **dentro do APK real** do ItaSuper.

## Pré-requisitos (uma vez só)

1. Build **debug** do app (`npx cap run android` ou Android Studio → Run).  
   Só builds debug expõem o WebView — release nunca expõe (já garantido no `MainActivity.java`).
2. Chrome instalado no desktop.
3. `adb` no PATH (vem com o Android SDK / Android Studio).

## Passo a passo

```bash
# 1. Conecte o celular via USB (com "Depuração USB" ligada) OU inicie um emulador.
adb devices          # deve listar 1 device

# 2. Abra o app ItaSuper Cliente no aparelho e navegue até /cliente.

# 3. Descubra a porta do WebView e faça o forward para localhost:9222
adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof app.lovable.e8d28aded6334d74be2161c8dbe24765)

# 4. Rode os specs apontando pro WebView:
npx playwright test --config=playwright.native.config.ts
```

O Playwright conecta em `http://127.0.0.1:9222` (CDP) e reaproveita a página
já aberta do WebView — sem abrir Chrome novo.

## Escrevendo um spec novo

Coloque em `e2e-native/*.spec.ts`. Diferente do browser, **não** dá `page.goto()`
para trocar de rota — use a navegação real do app (tap nos botões) para simular
o usuário. Se precisar resetar, feche e reabra o app.