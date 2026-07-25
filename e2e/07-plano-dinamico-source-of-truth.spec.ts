import { test, expect } from "@playwright/test";

/**
 * Fonte da verdade dos planos dinâmicos (Essencial + Autonomia).
 * Garante que plan_templates no banco reflete os valores acordados.
 */

// Backend externo (mesmo que src/integrations/supabase/client.ts). Hardcoded para
// não depender de VITE_* no ambiente de CI, que apontaria para o projeto errado.
const SUPABASE_URL = "https://qkjhguziuchqsbxzruea.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFramhndXppdWNocXNieHpydWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDg4NTUsImV4cCI6MjA5MDYyNDg1NX0.2sTeKchqAEN2gCqnH1_Zn9cJmUSmZgryt05A66tgm2Y";

test.describe("Planos — fonte da verdade única", () => {
  test("plan_templates no banco bate com os valores acordados", async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/plan_templates?select=plan_key,monthly_fee,revenue_threshold,platform_fee_included,is_active`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
    );
    expect(res.ok()).toBeTruthy();
    const rows = (await res.json()) as Array<Record<string, any>>;
    const byKey = Object.fromEntries(rows.map((r) => [r.plan_key, r]));

    // Essencial dinâmico: grátis até 5000 → R$ 89,90 + taxa R$ 0,99.
    expect(Number(byKey.fixed?.monthly_fee)).toBe(89.9);
    expect(Number(byKey.fixed?.revenue_threshold)).toBe(5000);
    expect(byKey.fixed?.platform_fee_included).toBe(true);
    expect(byKey.fixed?.is_active).toBe(true);

    // Autonomia dinâmico: grátis até 2500 → R$ 199,90 sem taxa da plataforma.
    expect(Number(byKey.autonomy?.monthly_fee)).toBe(199.9);
    expect(Number(byKey.autonomy?.revenue_threshold)).toBe(2500);
    expect(byKey.autonomy?.platform_fee_included).toBe(false);
    expect(byKey.autonomy?.is_active).toBe(true);

    // PDV Only fixo R$ 69,00 sem taxa.
    expect(Number(byKey.pdv_only?.monthly_fee)).toBe(69);
    expect(byKey.pdv_only?.is_active).toBe(true);

    // Planos legados desativados: a RLS pública filtra por is_active=true,
    // então nem devem aparecer no resultado do anon.
    expect(byKey.hybrid).toBeUndefined();
    expect(byKey.supporter).toBeUndefined();
  });
});