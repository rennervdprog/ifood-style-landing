import { test, expect, chromium } from "@playwright/test";

/**
 * Exemplo: conecta ao WebView do app já aberto no /cliente e verifica
 * que o header do marketplace renderizou. Serve de template pros próximos
 * specs nativos.
 */
test("cliente home renderiza no WebView do APK", async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  try {
    const contexts = browser.contexts();
    const context = contexts[0] ?? (await browser.newContext());
    const pages = context.pages();
    const page = pages[0] ?? (await context.newPage());

    // Espera o React montar (o app já está aberto — não damos goto).
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();

    // Ajuste o seletor conforme sua Home real.
    const anyStoreCard = page.locator('[data-native-scroll-pan], [data-testid="store-card"]').first();
    await anyStoreCard.waitFor({ timeout: 10_000 });
  } finally {
    await browser.close();
  }
});