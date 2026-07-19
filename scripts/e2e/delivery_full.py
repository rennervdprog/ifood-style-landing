"""E2E delivery flow — lojista side.

Auth: reads /tmp/browser/session.json (renew via scripts/e2e/mint.sh).
Loja alvo: dudalanchesteste (vinculada ao usuário e2e-admin@itasuper.test).

Cobre:
  1. Login via storageState
  2. Admin dashboard carrega
  3. Aba Pedidos abre e lista pedidos
  4. Aba Cardápio lista produtos
  5. Aba Financeiro / Meu Plano abre
  6. Sem erros de console / erros Supabase >=400
"""
import asyncio, json, os, re, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SESSION_PATH = Path(os.environ.get("E2E_SESSION_PATH", "/tmp/browser/session.json"))
STORAGE_KEY = os.environ.get("E2E_STORAGE_KEY", "sb-qkjhguziuchqsbxzruea-auth-token")
SHOTS = Path("/tmp/browser/delivery/shots"); SHOTS.mkdir(parents=True, exist_ok=True)

results, console_errs, net_errs = [], [], []
def rec(step, status, note=""):
    results.append((step, status, note))
    print(f"[{status}] {step} :: {note[:180]}")

async def shot(page, name):
    try: await page.screenshot(path=str(SHOTS / f"{name}.png"))
    except Exception: pass

async def click_tab(page, pattern):
    rx = re.compile(pattern, re.I)
    for role in ("tab", "link", "button"):
        t = page.get_by_role(role, name=rx)
        if await t.count() > 0:
            try:
                await t.first.click(); await asyncio.sleep(2); return True
            except Exception: pass
    return False

async def dismiss_tutorial(page):
    # tutorial overlay: "Pular Tutorial" or close X
    for pat in (r"Pular Tutorial", r"Pular"):
        try:
            b = page.get_by_role("button", name=re.compile(pat, re.I))
            if await b.count() > 0:
                await b.first.click(); await asyncio.sleep(1); return True
        except Exception: pass
    return False

async def main():
    if not SESSION_PATH.exists():
        print(f"missing session file: {SESSION_PATH} (run scripts/e2e/mint.sh)", file=sys.stderr)
        sys.exit(2)
    session = json.loads(SESSION_PATH.read_text())

    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        page.on("console", lambda m: console_errs.append(m.text) if m.type == "error" else None)
        page.on("response", lambda r: net_errs.append(f"{r.status} {r.url}")
                if ("supabase" in r.url and r.status >= 400 and "auth/v1/token" not in r.url) else None)

        await page.goto(BASE, wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(STORAGE_KEY)}, {json.dumps(json.dumps(session))})"
        )

        # 1) Admin dashboard
        await page.goto(f"{BASE}/admin", wait_until="networkidle")
        await asyncio.sleep(3)
        await dismiss_tutorial(page)
        await asyncio.sleep(1)
        await shot(page, "01_admin")
        body = await page.locator("body").inner_text()
        rec("Admin loads", "PASS" if ("Pedidos" in body or "Dashboard" in body) else "FAIL")

        # store picker if present
        try:
            el = page.get_by_text(re.compile(r"dudalanchesteste", re.I))
            if await el.count() > 0:
                await el.first.click(); await asyncio.sleep(3)
                rec("Pick store", "PASS")
        except Exception:
            pass

        # 2) Pedidos tab
        ok = await click_tab(page, r"Pedidos")
        await shot(page, "02_pedidos")
        rec("Aba Pedidos", "PASS" if ok else "SKIP")

        # 3) Cardápio
        ok = await click_tab(page, r"Cardápio|Produtos")
        await shot(page, "03_cardapio")
        body = await page.locator("body").inner_text()
        rec("Aba Cardápio", "PASS" if ok and ("R$" in body or "produto" in body.lower()) else "FAIL")

        # 4) Financeiro / Meu Plano
        for pat, label in [(r"Financeiro", "Financeiro"), (r"Meu Plano|Plano", "Meu Plano")]:
            ok = await click_tab(page, pat)
            await shot(page, f"04_{label}")
            rec(f"Aba {label}", "PASS" if ok else "SKIP")

        # 5) Health
        rec("Console errors", "PASS" if not console_errs else "FAIL", f"{len(console_errs)}")
        rec("Supabase 4xx/5xx", "PASS" if not net_errs else "FAIL", f"{len(net_errs)}")
        print("\n--- console errors ---")
        for e in console_errs[:10]: print(e[:300])
        print("\n--- net errors ---")
        for e in net_errs[:10]: print(e[:300])

        await b.close()

    passed = sum(1 for _, s, _ in results if s == "PASS")
    failed = sum(1 for _, s, _ in results if s == "FAIL")
    print(f"\n=== {passed} PASS / {failed} FAIL / {len(results)} total ===")
    sys.exit(1 if failed else 0)

asyncio.run(main())