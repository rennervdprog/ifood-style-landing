import { test, expect } from "../playwright-fixture";
import { expectSpaRendered } from "./helpers";

test("rota /auth carrega sem 5xx", async ({ page }) => {
  const res = await page.goto("/auth");
  expect(res?.status() ?? 200).toBeLessThan(500);
  await expectSpaRendered(page);
});