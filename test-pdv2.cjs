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
  await page.fill('input[type="tel"]', 'sandbox+pdv1@itasuper.test');
  await page.fill('input[type="password"]', 'Sandbox#2026!');
  await page.click('button[type="submit"]').catch(()=>{});
  await page.waitForTimeout(3000);
  console.log('after login url', page.url());

  // Go to PDV
  await page.goto('http://localhost:8080/admin/pdv', { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
  await page.waitForTimeout(2500);
  await shot('03-pdv-initial');
  console.log('pdv url', page.url());
  const bodyTxt = await page.textContent('body').catch(()=>'');
  console.log('mentions PIN:', /pin/i.test(bodyTxt), 'mentions abrir caixa:', /abrir caixa/i.test(bodyTxt));

  // try PIN buttons (numeric keypad) if present
  const pinButtons = await page.$$('button');
  console.log('num buttons on page:', pinButtons.length);

  await page.waitForTimeout(1000);
  await shot('04-pdv-state2');

  console.log('ERRORS', JSON.stringify(errs));
  await browser.close();
})();
