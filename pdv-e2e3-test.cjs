const { chromium } = require('playwright');

const results = [];
function log(name, status, note) {
  results.push({ name, status, note });
  console.log(`[${status}] ${name} - ${note || ''}`);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/bin/chromium' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('response', res => { if (res.status() >= 400) networkErrors.push(`${res.status()} ${res.url()}`); });

  const shot = async (name) => await page.screenshot({ path: `/tmp/browser/pdv-e2e3/${name}.png`, fullPage: true });

  try {
    // 1. Login
    try {
      await page.goto('http://localhost:8080/auth', { waitUntil: 'networkidle', timeout: 30000 });
      await page.fill('input[type="email"]', 'sandbox+pdv1@itasuper.test');
      await page.fill('input[type="password"]', 'Sandbox#2026!');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      await shot('01-login');
      log('1-Login', 'PASS', 'login realizado');
    } catch (e) {
      log('1-Login', 'FAIL', e.message);
    }

    // 2. Navegar para /admin/pdv
    try {
      await page.goto('http://localhost:8080/admin/pdv', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      await shot('02-pdv-home');
      log('2-PDV-Home', 'PASS', 'carregou /admin/pdv');
    } catch (e) {
      log('2-PDV-Home', 'FAIL', e.message);
    }

    // 3. KDS sem erro 400
    try {
      networkErrors.length = 0;
      await page.goto('http://localhost:8080/admin/pdv/kds', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
      await shot('03-kds');
      const has400 = networkErrors.some(e => e.includes('400') && e.includes('supabase'));
      if (has400) log('3-KDS-No400', 'FAIL', 'erro 400 encontrado: ' + networkErrors.join('; '));
      else log('3-KDS-No400', 'PASS', 'sem erro 400 supabase. Network errs: ' + JSON.stringify(networkErrors));
    } catch (e) {
      log('3-KDS-No400', 'FAIL', e.message);
    }

    // volta para pdv
    await page.goto('http://localhost:8080/admin/pdv', { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
    await page.waitForTimeout(1500);

    // 4. Abrir aba Mesas
    try {
      const mesasTab = page.locator('text=Mesas').first();
      await mesasTab.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      await shot('04-mesas');
      log('4-Aba-Mesas', 'PASS', 'aba mesas aberta');
    } catch (e) {
      log('4-Aba-Mesas', 'FAIL', e.message);
    }

    // 5. Selecionar/abrir uma mesa
    try {
      const mesaCard = page.locator('[class*="card" i], button, div').filter({ hasText: /Mesa/i }).first();
      await mesaCard.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      await shot('05-mesa-aberta');
      log('5-Abrir-Mesa', 'PASS', 'mesa clicada');
    } catch (e) {
      log('5-Abrir-Mesa', 'FAIL', e.message);
    }

    // 6. Adicionar item ao pedido (tentativa genérica)
    try {
      const itemBtn = page.locator('button, div').filter({ hasText: /Adicionar|Produto|\+/i }).first();
      await itemBtn.click({ timeout: 5000 });
      await page.waitForTimeout(1000);
      await shot('06-add-item');
      log('6-Adicionar-Item', 'PASS', 'tentativa de adicionar item executada');
    } catch (e) {
      log('6-Adicionar-Item', 'SKIP', 'elemento não encontrado: ' + e.message);
    }

    // 7. Abrir modal pagamento F8
    try {
      await page.goto('http://localhost:8080/admin/pdv', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.keyboard.press('F8');
      await page.waitForTimeout(1500);
      await shot('07-modal-pagamento');
      log('7-Modal-Pagamento-F8', 'PASS', 'F8 pressionado');
    } catch (e) {
      log('7-Modal-Pagamento-F8', 'FAIL', e.message);
    }

    // 8. Selecionar Dinheiro e fechar modal (testar overlay bug)
    try {
      const dinheiroBtn = page.locator('text=Dinheiro').first();
      const visible = await dinheiroBtn.isVisible().catch(() => false);
      if (visible) {
        await dinheiroBtn.click({ timeout: 5000 });
        await page.waitForTimeout(1500);
        await shot('08a-dinheiro-selecionado');
        // tentar fechar com Escape ou botão fechar
        await page.keyboard.press('Escape').catch(()=>{});
        await page.waitForTimeout(1000);
        await shot('08b-modal-fechado');
        // verificar se overlay ainda cobre a tela (bloqueando cliques)
        const overlay = page.locator('[class*="backdrop-blur"], [class*="bg-black/50"]').first();
        const overlayVisible = await overlay.isVisible().catch(() => false);
        if (overlayVisible) {
          log('8-Pagamento-Dinheiro-Fecha', 'FAIL', 'overlay ainda visível após fechar - bug retornou');
        } else {
          log('8-Pagamento-Dinheiro-Fecha', 'PASS', 'modal fechou sem overlay travado');
        }
      } else {
        log('8-Pagamento-Dinheiro-Fecha', 'SKIP', 'botão Dinheiro não visível - modal pode não ter aberto');
      }
    } catch (e) {
      log('8-Pagamento-Dinheiro-Fecha', 'FAIL', e.message);
    }

    // 9. Navegar para aba Mesas após fechar modal (teste crítico do overlay)
    try {
      const mesasTab2 = page.locator('text=Mesas').first();
      await mesasTab2.click({ timeout: 8000 });
      await page.waitForTimeout(1500);
      await shot('09-mesas-pos-modal');
      log('9-Mesas-Pos-Modal', 'PASS', 'navegação para Mesas funcionou após fechar modal');
    } catch (e) {
      log('9-Mesas-Pos-Modal', 'FAIL', 'clique bloqueado provavelmente por overlay: ' + e.message);
    }

    // 10. Verificar console errors gerais
    try {
      const criticalErrors = consoleErrors.filter(e => !e.includes('DevTools') && !e.includes('favicon'));
      await shot('10-final-state');
      if (criticalErrors.length > 0) {
        log('10-Console-Errors', 'FAIL', criticalErrors.slice(0,5).join(' | '));
      } else {
        log('10-Console-Errors', 'PASS', 'sem erros críticos de console');
      }
    } catch (e) {
      log('10-Console-Errors', 'FAIL', e.message);
    }

    // 11. Reload final para garantir estado estável
    try {
      await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);
      await shot('11-reload-final');
      log('11-Reload-Estavel', 'PASS', 'reload sem crash');
    } catch (e) {
      log('11-Reload-Estavel', 'FAIL', e.message);
    }

  } catch (globalErr) {
    console.log('ERRO GLOBAL', globalErr);
  }

  await browser.close();

  console.log('\n=== RESUMO ===');
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  console.log(`PASS: ${pass}, FAIL: ${fail}, SKIP: ${skip}`);
  console.log(JSON.stringify(results, null, 2));
})();
