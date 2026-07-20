import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:8080/auth', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.fill('input[type="tel"]', 'sandbox+pdv1@itasuper.test');
  await page.fill('input[type="password"]', 'Sandbox#2026!');
  await page.click('button:has-text("Entrar")');
  await page.waitForURL(url => !url.pathname.startsWith('/auth'), { timeout: 15000 });

  await page.goto('http://localhost:8080/admin/pdv');
  await page.waitForLoadState('networkidle');
  
  console.log('Current URL:', page.url());

  const mesasTab = page.getByRole('tab', { name: /Mesas/i });
  if (await mesasTab.isVisible()) {
    console.log('Clicking Mesas tab');
    await mesasTab.click();
    await page.waitForTimeout(3000);
  } else {
    console.log('Mesas tab NOT visible');
    const tabs = await page.getByRole('tab').allTextContents();
    console.log('Available tabs:', tabs);
  }

  const buttons = await page.getByRole('button').allTextContents();
  console.log('Buttons on page:', buttons.slice(0, 50));

  const textNodes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div, button, span, p')).filter(el => 
      el.children.length === 0 && el.textContent?.trim().length > 0
    ).map(el => el.textContent?.trim()).slice(0, 100);
  });
  console.log('Text nodes:', textNodes);

  await browser.close();
}
run();
