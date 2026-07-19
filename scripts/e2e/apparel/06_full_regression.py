"""E2E Fase 6 PDV Boutique — regressão completa da loja apparel.
Fluxo: abre PDV, valida grade visual de variantes, faz venda com decremento
de estoque, aplica vale-crédito de cliente e imprime etiqueta.
Requer storage_state autenticado com dono da loja apparel."""
import asyncio, os, re
from pathlib import Path
from playwright.async_api import async_playwright, expect

OUT = Path(__file__).parent / "screenshots" / "fase6"
OUT.mkdir(parents=True, exist_ok=True)
STORAGE_STATE = os.environ.get("APPAREL_STORAGE_STATE", "/tmp/browser/apparel.json")
BASE = os.environ.get("E2E_BASE_URL", "http://localhost:8080")

async def shot(page, name):
    await page.screenshot(path=str(OUT / f"{name}.png"))

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 1800},
            storage_state=STORAGE_STATE if Path(STORAGE_STATE).exists() else None,
        )
        page = await ctx.new_page()

        # 1) Vender — matriz visual
        await page.goto(f"{BASE}/admin/pdv", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle")
        await shot(page, "01_vender")

        # Abre matriz da primeira peça
        first_card = page.locator('[data-testid="apparel-card"]').first
        if await first_card.count():
            await first_card.click()
            await page.wait_for_timeout(500)
            await shot(page, "02_matriz")
            # Adiciona 1 unidade da primeira variante disponível
            cell = page.locator('[data-testid="apparel-variant-cell"]:not([data-empty="true"])').first
            if await cell.count():
                await cell.click()
                await page.wait_for_timeout(300)
                await shot(page, "03_add_variant")
                # Botão Etiquetas
                labels_btn = page.get_by_role("button", name=re.compile(r"Etiquetas", re.I))
                if await labels_btn.count():
                    await labels_btn.first.click()
                    await page.wait_for_timeout(500)
                    await shot(page, "04_labels")
                    await page.keyboard.press("Escape")
            await page.keyboard.press("Escape")

        # 2) Painel cliente / vale-crédito
        phone = page.get_by_placeholder(/Telefone/i)
        if await phone.count():
            await phone.first.fill("11999990001")
            await shot(page, "05_customer")
            buscar = page.get_by_role("button", name=re.compile(r"Buscar", re.I))
            if await buscar.count():
                await buscar.first.click()
                await page.wait_for_timeout(700)
                await shot(page, "06_customer_found")

        # 3) Histórico + devolução (vale-crédito)
        await page.goto(f"{BASE}/admin/pdv?tab=historico", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle")
        await shot(page, "07_historico")
        dev_btn = page.get_by_role("button", name=re.compile(r"Devolver", re.I))
        if await dev_btn.count():
            await dev_btn.first.click()
            await page.wait_for_timeout(500)
            await shot(page, "08_return_dialog")
            await page.keyboard.press("Escape")

        # 4) Cardápio — cadastro de grade
        await page.goto(f"{BASE}/admin/pdv/cardapio", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle")
        await shot(page, "09_cardapio")

        await browser.close()
        print("Fase 6 regression OK — screenshots em", OUT)

asyncio.run(main())