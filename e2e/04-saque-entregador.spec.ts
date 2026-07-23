import { test, expect } from "../playwright-fixture";
import { expectSpaRendered } from "./helpers";

test("rota /perfil carrega sem 5xx", async ({ page }) => {
  const res = await page.goto("/perfil");
  expect(res?.status() ?? 200).toBeLessThan(500);
  await expectSpaRendered(page);
});