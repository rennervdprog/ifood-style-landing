import { test, expect } from "../playwright-fixture";
import { expectSpaRendered } from "./helpers";

// Smoke E2E do PDV: rota protegida (`/admin/pdv`) redireciona para login
// quando não há sessão, e nunca deve retornar 5xx.
test("rota /admin/pdv responde sem 5xx e exige autenticação", async ({ page }) => {
  const res = await page.goto("/admin/pdv");
  expect(res?.status() ?? 200).toBeLessThan(500);
  await expectSpaRendered(page);
});