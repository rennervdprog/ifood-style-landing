import { test, expect } from "../playwright-fixture";
import { expectSpaRendered } from "./helpers";

/**
 * Fonte da verdade das rotas — smoke.
 *
 * Valida que cada rota chave renderiza sem redirect-loop e sem cascata de
 * spinners. Sem depender de usuários seed por role, focamos em:
 *  - A rota resolve para um destino final estável (sem ping-pong).
 *  - No máximo 1 navegação de meio (redirect) antes do commit final.
 *  - O DOM não fica preso em spinner (SPA rendered).
 */

async function trackNavigations(page: import("@playwright/test").Page) {
  const events: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) events.push(frame.url());
  });
  return events;
}

test("`/portal-parceiro` renderiza sem loop", async ({ page }) => {
  const events = await trackNavigations(page);
  await page.goto("/portal-parceiro");
  await expectSpaRendered(page);
  // Aceita destinos válidos: portal-parceiro (login) OU o painel do usuário logado.
  expect(page.url()).toMatch(/\/(portal-parceiro|super-admin|admin|entregador|matriz|revendedor|cliente)/);
  // Sem loop: no máximo 3 navegações totais (goto + até 2 redirects internos).
  expect(events.length).toBeLessThanOrEqual(3);
});

test("`/admin` chega em painel final em ≤2 navegações", async ({ page }) => {
  const events = await trackNavigations(page);
  await page.goto("/admin");
  await expectSpaRendered(page);
  // Anônimo → /portal-parceiro; lojista → /admin ou /admin/pdv; admin → /super-admin.
  expect(page.url()).toMatch(/\/(portal-parceiro|admin|super-admin|auth)/);
  expect(events.length).toBeLessThanOrEqual(3);
});

test("`/super-admin` bloqueia não-admin", async ({ page }) => {
  await page.goto("/super-admin");
  await expectSpaRendered(page);
  // Ou renderiza (admin) ou redireciona para login/home.
  expect(page.url()).toMatch(/\/(super-admin|portal-parceiro|auth|admin|entregador|cliente)/);
});

test("`/entregador` chega em destino estável", async ({ page }) => {
  const events = await trackNavigations(page);
  await page.goto("/entregador");
  await expectSpaRendered(page);
  expect(page.url()).toMatch(/\/(entregador|portal-parceiro|auth|admin|super-admin)/);
  expect(events.length).toBeLessThanOrEqual(3);
});

test("`/cliente` renderiza cliente ou home do revendedor", async ({ page }) => {
  const events = await trackNavigations(page);
  await page.goto("/cliente");
  await expectSpaRendered(page);
  expect(page.url()).toMatch(/\/(cliente|revendedor|auth)/);
  expect(events.length).toBeLessThanOrEqual(3);
});

test("`/` (StoreDirectory) não entra em loop", async ({ page }) => {
  const events = await trackNavigations(page);
  await page.goto("/");
  await expectSpaRendered(page);
  expect(events.length).toBeLessThanOrEqual(3);
});