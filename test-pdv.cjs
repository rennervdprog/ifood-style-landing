const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
  const errs = [];
  page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
  const shot = n => page.screenshot({ path: `/tmp/browser/pdv-faseA/${n}.png`, fullPage: true });

  await page.goto('http://localhost:8080/auth', { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
  await page.waitForTimeout(1000);
  // look for email toggle
  const bodyText = await page.textContent('body').catch(()=>'');
  console.log('has email word:', /e-?mail/i.test(bodyText));
  const emailToggle = await page.$('text=/e-?mail/i');
  if (emailToggle) { await emailToggle.click().catch(()=>{}); await page.waitForTimeout(500); }
  await shot('01b-auth-toggled');
  const emailInput = await page.$('input[type="email"]');
  console.log('email input found:', !!emailInput);
  if (emailInput) {
    await emailInput.fill('sandbox+pdv1@itasuper.test');
    await page.fill('input[type="password"]', 'Sandbox#2026!');
  } else {
    await page.fill('input[type="tel"]', 'sandbox+pdv1@itasuper.test').catch(()=>{});
    await page.fill('input[type="password"]', 'Sandbox#2026!').catch(()=>{});
  }
  await shot('01c-filled');
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) await submitBtn.click(); else await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  await shot('02-after-login');
  console.log('URL after login:', page.url());
  console.log('ERRORS', JSON.stringify(errs));
  await browser.close();
})();
