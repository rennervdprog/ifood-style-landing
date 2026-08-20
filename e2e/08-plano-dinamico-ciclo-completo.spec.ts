import { test, expect } from "@playwright/test";

/**
 * Ciclo completo do plano dinâmico Essencial.
 *
 * Delega para a edge function `e2e-dynamic-upgrade-flow` (executada com
 * service-role no backend externo) que faz o ciclo real:
 *   1. reseta loja sandbox para grátis
 *   2. injeta pedidos fake acima do threshold de R$ 5.000 do Essencial
 *   3. dispara `check-essencial-upgrade` → deve agendar upgrade
 *   4. simula grace period vencido + aceite do lojista
 *   5. dispara `check-essencial-upgrade` de novo → deve aplicar a fee do plan_templates
 *   6. cleanup: apaga pedidos fake e restaura estado original
 *
 * Requer secret E2E_ADMIN_SECRET (ou service key) no ambiente.
 */

const SUPABASE_URL =
  process.env.E2E_EDGE_URL ||
  process.env.EXTERNAL_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://qkjhguziuchqsbxzruea.supabase.co";
const E2E_ADMIN_SECRET = process.env.E2E_ADMIN_SECRET || "";

const STORE_ID = process.env.E2E_UPGRADE_STORE_ID || "";

async function runFlow(request: any, planType: "fixed") {
  const res = await request.post(`${SUPABASE_URL}/functions/v1/e2e-dynamic-upgrade-flow`, {
    headers: {
      "x-e2e-secret": E2E_ADMIN_SECRET,
      "content-type": "application/json",
    },
    data: { plan_type: planType, ...(STORE_ID ? { store_id: STORE_ID } : {}) },
    timeout: 60_000,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body };
}

test.describe("Plano dinâmico — ciclo completo (GMV → aceite → fee)", () => {
  test.skip(!E2E_ADMIN_SECRET, "E2E_ADMIN_SECRET não configurado — pulando ciclo real.");

  test("Essencial: injeta > R$ 5.000 → agenda → aceita → cobra R$ 89,90", async ({ request }) => {
    const { status, body } = await runFlow(request, "fixed");
    expect(status, JSON.stringify(body?.steps || body)).toBe(200);
    expect(body?.ok).toBe(true);
    expect(body?.expected_fee).toBe(89.9);
    expect(body?.applied_fee).toBe(89.9);
    expect(body?.threshold).toBe(5000);
  });

});