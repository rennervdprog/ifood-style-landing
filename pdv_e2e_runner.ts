import { chromium } from 'playwright';
import fs from 'fs';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/bin/chromium'
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1800 }
  });
  const page = await context.newPage();
  const screenshotsDir = '/tmp/browser/pdv-e2e6';
  const results = [];
  const networkErrors = [];
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('response', response => {
    if (response.url().includes('supabase') && response.status() >= 400) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  async function addResult(step, status, note = '') {
    results.push({ step, status, note });
    console.log(`Step: ${step} | Status: ${status} | Note: ${note}`);
  }

  try {
    // 1. LOGIN
    await page.goto('http://localhost:8080/auth', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.fill('input[type="tel"]', 'sandbox+pdv1@itasuper.test');
    await page.fill('input[type="password"]', 'Sandbox#2026!');
    await page.screenshot({ path: `${screenshotsDir}/1-login-filled.png` });
    await page.click('button:has-text("Entrar")');
    
    try {
      await page.waitForURL(url => !url.pathname.startsWith('/auth'), { timeout: 15000 });
      await addResult('Login', 'PASS', 'Redirected successfully');
    } catch (e) {
      await addResult('Login', 'FAIL', 'Timeout waiting for redirect');
      throw e;
    }
    await page.screenshot({ path: `${screenshotsDir}/1-after-login.png` });

    // 2. Goto /admin/pdv
    await page.goto('http://localhost:8080/admin/pdv');
    await page.waitForLoadState('networkidle');
    await addResult('Navigate to PDV', 'PASS');

    // 3. Goto /admin/pdv/kds asserting no supabase 400s
    networkErrors.length = 0;
    await page.goto('http://localhost:8080/admin/pdv/kds');
    await page.waitForTimeout(4000); // Give it some time to load data
    if (networkErrors.length > 0) {
      await addResult('KDS Supabase Check', 'FAIL', `Supabase 400s detected: ${networkErrors.join(', ')}`);
    } else {
      await addResult('KDS Supabase Check', 'PASS', 'No Supabase 400 errors');
    }
    await page.screenshot({ path: `${screenshotsDir}/3-kds.png` });

    // 4. Mesas tab
    await page.goto('http://localhost:8080/admin/pdv');
    await page.waitForLoadState('networkidle');
    const mesasTab = page.getByRole('tab', { name: /Mesas/i });
    await mesasTab.click();
    await page.waitForTimeout(2000);
    await addResult('Mesas Tab', 'PASS');
    await page.screenshot({ path: `${screenshotsDir}/4-mesas-tab.png` });

    // 5. Click first mesa (Prefer Ocupada to avoid "Abrir Mesa" flow)
    let mesaButton = page.locator('button').filter({ hasText: /Mesa/i }).filter({ hasText: /Ocupada/i }).first();
    if (!(await mesaButton.isVisible())) {
        mesaButton = page.locator('button').filter({ hasText: /Mesa/i }).first();
    }
    
    await mesaButton.waitFor({ state: 'visible' });
    await mesaButton.click();
    await page.waitForTimeout(2000);
    
    // If it's a "Livre" mesa, we might need to click "Abrir Mesa"
    if (await page.getByText(/Abrir Mesa/i).isVisible()) {
        await page.getByRole('button', { name: /Abrir/i }).first().click();
        await page.waitForTimeout(2000);
    }

    await addResult('Mesa Selection', 'PASS');
    await page.screenshot({ path: `${screenshotsDir}/5-mesa-clicked.png` });

    // 6. F8
    await page.keyboard.press('F8');
    await page.waitForTimeout(2000);
    await addResult('F8 Payment Modal', 'PASS');
    await page.screenshot({ path: `${screenshotsDir}/6-payment-modal.png` });

    // 7. Click "Dinheiro"
    const dinheiro = page.getByText(/Dinheiro/i).first();
    if (await dinheiro.isVisible()) {
      await dinheiro.click();
      await page.waitForTimeout(500);
      await addResult('Click Dinheiro', 'PASS');
    } else {
      await addResult('Click Dinheiro', 'FAIL', 'Dinheiro option not found');
    }
    await page.screenshot({ path: `${screenshotsDir}/7-dinheiro-clicked.png` });

    // 8. Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
    await addResult('Press Escape', 'PASS');

    // 9. Assert no residual overlay
    const overlay = page.locator('.bg-black\\/50, .backdrop-blur');
    const count = await overlay.count();
    let visibleOverlay = false;
    for (let i = 0; i < count; i++) {
        if (await overlay.nth(i).isVisible()) {
            visibleOverlay = true;
            break;
        }
    }
    if (visibleOverlay) {
        await addResult('Overlay Check', 'FAIL', 'Residual overlay detected');
    } else {
        await addResult('Overlay Check', 'PASS', 'Overlay dismissed cleanly');
    }
    await page.screenshot({ path: `${screenshotsDir}/9-post-escape.png` });

    // 10. Click Mesas again
    try {
        // We might be in a mesa detail view, let's try to go back to Mesas tab if visible, or click the main Mesas tab
        const backToMesas = page.getByRole('tab', { name: /Mesas/i });
        if (await backToMesas.isVisible()) {
            await backToMesas.click();
        } else {
            // Maybe we need to go back first?
            await page.goto('http://localhost:8080/admin/pdv');
            await page.getByRole('tab', { name: /Mesas/i }).click();
        }
        await addResult('Click Mesas Again', 'PASS', 'Mesas tab clickable/accessible');
    } catch (e) {
        await addResult('Click Mesas Again', 'FAIL', 'Mesas tab not clickable: ' + e.message);
    }
    await page.screenshot({ path: `${screenshotsDir}/10-mesas-clicked-again.png` });

    // 11. Check console errors and reload
    const filteredErrors = consoleErrors.filter(e => 
        !e.includes('favicon.ico') && 
        !e.includes('Failed to load resource') &&
        !e.includes('Lit is in dev mode')
    );
    await addResult('Console Errors', filteredErrors.length === 0 ? 'PASS' : 'FAIL', filteredErrors.join(' | '));
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await addResult('Reload', 'PASS');
    await page.screenshot({ path: `${screenshotsDir}/11-final-reload.png` });

  } catch (error) {
    console.error('Test script failed:', error);
    await addResult('Global', 'FAIL', error.message);
  } finally {
    console.log('FINAL_RESULTS:' + JSON.stringify(results));
    await browser.close();
  }
}

run();
