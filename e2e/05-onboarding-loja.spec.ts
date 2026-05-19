import { test, expect } from "../playwright-fixture";

test("rota /auth carrega sem 5xx", async ({ page }) => {
  const res = await page.goto("/auth");
  expect(res?.status() ?? 200).toBeLessThan(500);
  const txt = await page.locator("body").innerText();
  expect(txt.length).toBeGreaterThan(0);
});