import { expect, type Page } from "@playwright/test";

export async function expectSpaRendered(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => {
    const root = document.getElementById("root");
    return Boolean(root && root.childElementCount > 0 && root.innerHTML.trim().length > 0);
  });
  await expect(page.locator("#root")).not.toBeEmpty();
}