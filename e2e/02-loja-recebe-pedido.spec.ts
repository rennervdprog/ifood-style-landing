import { test, expect } from "../playwright-fixture";

test("rota /loja carrega sem 5xx", async ({ page }) => {
  const res = await page.goto("/loja");
  expect(res?.status() ?? 200).toBeLessThan(500);
  const txt = await page.locator("body").innerText();
  expect(txt.length).toBeGreaterThan(0);
});