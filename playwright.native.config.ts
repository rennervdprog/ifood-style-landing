import { defineConfig } from "@playwright/test";

/**
 * Playwright config para rodar E2E DENTRO do WebView do APK do ItaSuper.
 *
 * Requer:
 * - build debug do app rodando no device/emulator
 * - `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`
 *
 * Ver `e2e-native/README.md` para o passo a passo.
 */
export default defineConfig({
  testDir: "./e2e-native",
  fullyParallel: false,   // WebView é 1 só; nada de paralelismo
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    // O Playwright vai se anexar ao WebView via CDP; a URL base só serve
    // pra logs — a navegação de verdade acontece dentro do app.
    baseURL: "http://localhost",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
});