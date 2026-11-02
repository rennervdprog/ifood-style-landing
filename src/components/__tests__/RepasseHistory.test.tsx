import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "fs";
import { join } from "path";
import RepasseHistory from "../RepasseHistory";
import ValorAPagarCard from "../finance/ValorAPagarCard";

// Item 14 (2026-10-31) — prova com os COMPONENTES REAIS e o dataset da
// varredura de botões (30/10). Na varredura, a loja demo devia R$ 9,91
// (repasse de delivery 9 × R$ 0,99 = R$ 8,91 em store_balances +
// R$ 1,00 acumulado em store_plans.pdv_commission_pending, de 1 venda
// PDV finalizada × R$ 1,00 configurado no plano da demo). O Resumo e o
// card "A pagar" mostravam R$ 9,91; a sub-aba Cobranças (RepasseHistory)
// somava só repasse + comissão da store_balances e mostrava R$ 8,91.
// Este teste monta as telas de verdade (Supabase mockado com essas
// linhas) e fixa que Cobranças e o card "A pagar" — o mesmo card da aba
// Financeiro do PDV e do Resumo — exibem O MESMO total: R$ 9,91.

const TABLE_ROWS: Record<string, unknown> = {
  store_balances: { repasse_pendente: 8.91, comissao_pendente: 0 },
  store_plans: { plan_type: "fixed", pdv_commission_pending: 1.0 },
  store_repasse_history: [],
  financial_transactions: [],
};

function makeBuilder(rows: unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "order", "limit", "in", "neq", "gte", "lte"]) {
    b[m] = () => b;
  }
  b.maybeSingle = async () => ({
    data: Array.isArray(rows) ? (rows[0] ?? null) : rows,
    error: null,
  });
  b.single = async () => ({
    data: Array.isArray(rows) ? rows[0] : rows,
    error: null,
  });
  b.then = (
    res: (v: { data: unknown; error: null }) => unknown,
    rej?: (e: unknown) => unknown,
  ) => Promise.resolve({ data: rows, error: null }).then(res, rej);
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  supabase: {
    from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []),
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  },
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Item 14 — Cobranças × Resumo/PDV Financeiro mostram o mesmo 'a pagar'", () => {
  it("sub-aba Cobranças (RepasseHistory) inclui a parcela acumulada do PDV: R$ 9,91, não R$ 8,91", async () => {
    renderWithQuery(<RepasseHistory storeId="demo-store" />);
    expect(await screen.findByText("R$ 9,91")).toBeTruthy();
    expect(screen.queryByText("R$ 8,91")).toBeNull();
  });

  it("card 'A pagar' (aba Financeiro do PDV e Resumo) mostra os mesmos R$ 9,91", async () => {
    renderWithQuery(<ValorAPagarCard storeId="demo-store" />);
    expect(await screen.findByText("R$ 9,91")).toBeTruthy();
    // O detalhamento do card separa as parcelas que compõem o total.
    expect(screen.getByText("Taxa de plataforma nas entregas")).toBeTruthy();
    expect(screen.getByText("R$ 8,91")).toBeTruthy();
    expect(screen.getByText("R$ 1,00")).toBeTruthy();
  });

  it("guarda de fidelidade: RepasseHistory deriva do hook canônico, sem soma própria", () => {
    const src = readFileSync(join(process.cwd(), "src/components/RepasseHistory.tsx"), "utf8");
    expect(src).toContain("usePendingRepasse(storeId)");
    expect(src).not.toContain("store-balance-repasse");
    expect(src).not.toContain("repasse_pendente || 0) + Number(balance");
  });
});
