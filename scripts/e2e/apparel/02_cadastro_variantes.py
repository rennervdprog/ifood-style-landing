"""E2E Fase 2 PDV Boutique — cria modelo com grade P/M/G × 2 cores.
Requer storage_state autenticado com dono da loja apparel."""
import asyncio, os
from pathlib import Path
from playwright.async_api import async_playwright, expect

OUT = Path(__file__).parent / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)
STORAGE_STATE = os.environ.get("APPAREL_STORAGE_STATE", "/tmp/browser/apparel.json")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 1800},
            storage_state=STORAGE_STATE if Path(STORAGE_STATE).exists() else None,
        )
        page = await ctx.new_page()
        await page.goto("http://localhost:8080/admin/pdv/cardapio", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path=str(OUT / "01_menu.png"))

        await expect(page.get_by_role("button", name="Modelos & Grade")).to_be_visible()
        await page.get_by_placeholder("Ex.: Camiseta Básica").fill("Camiseta Básica E2E")
        await page.get_by_placeholder("49.90").fill("59.90")
        await page.locator('input[type="number"]').first.fill("5")
        await page.screenshot(path=str(OUT / "02_form.png"))
        await page.get_by_role("button", name="Salvar modelo").click()
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(OUT / "03_saved.png"))
        await expect(page.get_by_text("Camiseta Básica E2E")).to_be_visible()
        await browser.close()

asyncio.run(main())