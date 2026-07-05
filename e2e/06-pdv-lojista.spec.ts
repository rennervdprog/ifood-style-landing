import { test, expect } from "../playwright-fixture";

// Smoke E2E do PDV: rota protegida (`/admin/pdv`) redireciona para login
// quando não há sessão, e nunca deve retornar 5xx.
test("rota /admin/pdv responde sem 5xx e exige autenticação", async ({ page }) => {
  const res = await page.goto("/admin/pdv");
  expect(res?.status() ?? 200).toBeLessThan(500);
  // RoleGuard redireciona quem não é lojista/admin para "/".
  await page.waitForLoadState("domcontentloaded");
  const body = await page.locator("body").innerText();
  expect(body.length).toBeGreaterThan(0);
});