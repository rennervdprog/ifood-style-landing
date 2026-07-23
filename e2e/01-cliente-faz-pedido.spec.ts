import { test, expect } from "../playwright-fixture";
import { expectSpaRendered } from "./helpers";

/**
 * Jornada 1 — Cliente faz pedido (smoke, sem auth real)
 * Verifica que a home carrega e oferece caminho até menu/login.
 */
test("home carrega e expõe rota de cliente", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\//);
  await expectSpaRendered(page);
});