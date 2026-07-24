import { test, expect } from "../playwright-fixture";
import { expectSpaRendered } from "./helpers";

test("rota /entregador carrega sem 5xx", async ({ page }) => {
  const res = await page.goto("/entregador");
  expect(res?.status() ?? 200).toBeLessThan(500);
  await expectSpaRendered(page);
});