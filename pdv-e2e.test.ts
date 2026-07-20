import { test, expect } from '@playwright/test';
import fs from 'fs';

test('PDV E2E Validation', async ({ page }) => {
  const screenshotsDir = '/tmp/browser/pdv-e2e4';
  const results = [];
  const errors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  page.on('response', response => {
    if (response.url().includes('supabase') && response.status() >= 400) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  async function step(name, fn) {
    console.log(`Starting step: ${name}`);
    try {
      await fn();
      results.push({ step: name, status: 'PASS' });
      console.log(`Step passed: ${name}`);
    } catch (e) {
      console.error(`Step failed: ${name}`, e);
      results.push({ step: name, status: 'FAIL', note: e.message });
      await page.screenshot({ path: `${screenshotsDir}/fail-${name.replace(/\s+/g, '_')}.png` });
    }
  }

  // 1. Login
  await step('Login', async () => {
    await page.goto('http://localhost:8080/auth');
    await page.screenshot({ path: `${screenshotsDir}/1-auth-page.png` });

    const emailToggle = page.locator('button, span, div').filter({ hasText: /e-mail|email/i }).first();
    if (await emailToggle.isVisible()) {
      console.log('Clicking email toggle');
      await emailToggle.click();
      await page.screenshot({ path: `${screenshotsDir}/1-switched-to-email.png` });
    }

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const telInput = page.locator('input[type="tel"]');
    
    if (await emailInput.isVisible()) {
      await emailInput.fill('sandbox+pdv1@itasuper.test');
    } else if (await telInput.isVisible()) {
      await telInput.fill('sandbox+pdv1@itasuper.test');
    }

    await page.locator('input[type="password"]').fill('Sandbox#2026!');
    await page.screenshot({ path: `${screenshotsDir}/1-credentials-filled.png` });
    
    console.log('Submitting login form');
    await Promise.all([
      page.waitForURL(url => !url.pathname.startsWith('/auth'), { timeout: 15000 }),
      page.click('button[type="submit"]')
    ]);
    
    await page.screenshot({ path: `${screenshotsDir}/1-after-login.png` });
  });

  // 2. Goto /admin/pdv
  await step('Navigate to PDV', async () => {
    await page.goto('http://localhost:8080/admin/pdv');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*admin\/pdv/);
  });

  // 3. Goto /admin/pdv/kds
  await step('KDS Bug Validation', async () => {
    networkErrors.length = 0; // Reset for this step
    await page.goto('http://localhost:8080/admin/pdv/kds');
    await page.waitForTimeout(3000); 
    
    if (networkErrors.length > 0) {
      throw new Error(`Supabase errors detected on KDS: ${networkErrors.join(', ')}`);
    }
    await page.screenshot({ path: `${screenshotsDir}/3-kds-page.png` });
  });

  // 4. Back to /admin/pdv, click "Mesas" tab
  await step('Click Mesas Tab', async () => {
    await page.goto('http://localhost:8080/admin/pdv');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /Mesas/i }).click();
    await page.screenshot({ path: `${screenshotsDir}/4-mesas-tab.png` });
  });

  // 5. Click first Mesa card
  await step('Click first Mesa', async () => {
    const firstMesa = page.locator('.cursor-pointer, [role="button"]').filter({ hasText: /Mesa|M\d+/i }).first();
    await firstMesa.waitFor({ state: 'visible' });
    await firstMesa.click();
    await page.screenshot({ path: `${screenshotsDir}/5-mesa-selected.png` });
  });

  // 6. Try to add an item
  await step('Add Item (Best Effort)', async () => {
    const item = page.locator('[role="button"], button').filter({ hasText: /Item|Produto/i }).first();
    if (await item.isVisible()) {
      await item.click();
    }
    await page.screenshot({ path: `${screenshotsDir}/6-item-added.png` });
  });

  // 7. F8 Payment Modal
  await step('Open Payment Modal (F8)', async () => {
    await page.keyboard.press('F8');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotsDir}/7-payment-modal.png` });
  });

  // 8. Click Dinheiro then Escape
  await step('F8 Overlay Bug Fix Validation', async () => {
    const dinheiro = page.getByText(/Dinheiro/i);
    if (await dinheiro.isVisible()) {
      await dinheiro.click();
      await page.waitForTimeout(500);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    
    const overlay = page.locator('.bg-black\\/50, .backdrop-blur');
    const visibleOverlays = [];
    const count = await overlay.count();
    for (let i = 0; i < count; i++) {
      if (await overlay.nth(i).isVisible()) {
        const cls = await overlay.nth(i).getAttribute('class');
        visibleOverlays.push(cls);
      }
    }
    
    if (visibleOverlays.length > 0) {
      throw new Error(`Sticky overlay detected: ${visibleOverlays.join(' | ')}`);
    }
    await page.screenshot({ path: `${screenshotsDir}/8-overlay-gone.png` });
  });

  // 9. Click Mesas tab again
  await step('Navigate to Mesas after Payment', async () => {
    const mesasTab = page.getByRole('tab', { name: /Mesas/i });
    await mesasTab.click();
    await page.screenshot({ path: `${screenshotsDir}/9-mesas-clickable.png` });
  });

  // 10. Check console for critical errors
  await step('Console Check', async () => {
    const criticalErrors = errors.filter(e => !e.includes('favicon.ico') && !e.includes('Failed to load resource'));
    if (criticalErrors.length > 0) {
      const current = results[results.length-1];
      current.note = `Errors: ${criticalErrors.slice(0,3).join(', ')}`;
    }
  });

  // 11. Reload
  await step('Reload', async () => {
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  console.log('FINAL_RESULTS:' + JSON.stringify(results));
});
