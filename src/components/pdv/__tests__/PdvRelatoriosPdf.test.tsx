import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "fs";
import { join } from "path";
import { PdvRelatorios } from "../PdvRelatorios";

// Item 13 (2026-10-31) — prova no COMPONENTE REAL (lição do item 12:
// nada de réplica parcial do caminho). Antes da correção, o botão
// "PDF" de PdvRelatorios chamava `window.print()` — o preview modal
// do navegador prendia a página ("congelou, sem PDF, sem erro, só
// volta recarregando", na descrição da varredura) e nenhum arquivo
// era gerado. Este teste monta o relatório de verdade (Supabase
// mockado com linhas de venda), clica no botão de verdade e fixa:
//   1. window.print NUNCA é chamado;
//   2. um Blob application/pdf é gerado e baixado com o nome padrão;
//   3. a tela continua montada e o botão responde a um segundo clique
//      (a página segue responsiva — o oposto do travamento).

const NOW = new Date();
const iso = (d: Date) => d.toISOString();

const ORDER_ROWS = [1, 2, 3].map((n) => ({
  id: `order-${n}`,
  subtotal: 25,
  total_price: 25,
  pdv_discount: 0,
  payment_method: "dinheiro",
  created_at: iso(NOW),
  commission_rate: 1,
  pdv_session_id: null,
  status: "finalizado",
  order_items: [
    { quantity: 1, unit_price: 25, products: { name: "Porção de Nuggets" } },
  ],
}));

const MOVEMENT_ROWS = [1, 2, 3].map((n) => ({
  amount: 25,
  order_id: `order-${n}`,
  payment_method: "dinheiro",
  created_at: iso(NOW),
  created_by: "user-1",
  operator_id: null,
  type: "sale",
}));

const TABLE_ROWS: Record<string, unknown> = {
  orders: ORDER_ROWS,
  pdv_movements: MOVEMENT_ROWS,
  profiles: [{ id: "user-1", name: "Operador Teste", email: "op@teste.local" }],
  pdv_operators: [],
  stores: { name: "Loja Demonstração" },
};

function makeBuilder(rows: unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "lte", "in", "order", "neq"]) {
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
  supabase: {
    from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []),
  },
}));

// jsdom não tem ResizeObserver (o Recharts da tela usa) — stub de ambiente.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
}

function renderRelatorios() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <PdvRelatorios storeId="store-1" />
    </QueryClientProvider>,
  );
}

let printSpy: ReturnType<typeof vi.spyOn>;
let createObjectURL: ReturnType<typeof vi.fn>;
let downloads: string[];

beforeEach(() => {
  printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
  downloads = [];
  createObjectURL = vi.fn((_blob: Blob) => "blob:relatorio-pdf");
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    function (this: HTMLAnchorElement) {
      if (this.download) downloads.push(this.download);
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Item 13 — botão PDF do PdvRelatorios real", () => {
  it("clicar em PDF baixa um PDF de verdade, sem window.print, e a tela continua viva", async () => {
    const user = userEvent.setup();
    renderRelatorios();

    const pdfButton = await screen.findByRole("button", { name: /^PDF$/ });
    await user.click(pdfButton);

    // 1) O modal de impressão ficou fora do caminho.
    expect(printSpy).not.toHaveBeenCalled();

    // 2) Um PDF de verdade foi gerado e o download disparado.
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe("application/pdf");
    expect(blobArg.size).toBeGreaterThan(1000);
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^pdv-relatorio-week-\d{4}-\d{2}-\d{2}\.pdf$/);

    // 3) Página responsiva: o relatório continua montado e o botão
    // responde de novo (segundo clique → segundo download).
    expect(screen.getByText("Faturamento")).toBeInTheDocument();
    await user.click(pdfButton);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(downloads).toHaveLength(2);
    expect(printSpy).not.toHaveBeenCalled();
  });
});

describe("Item 13 — guarda de fidelidade nas fontes reais", () => {
  const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

  it("PdvRelatorios não chama window.print em nenhum ponto e usa a lib de PDF", () => {
    const src = read("../PdvRelatorios.tsx");
    expect(src).not.toContain("window.print");
    expect(src).toContain("downloadPdvReportPdf");
    expect(src).not.toContain("PdvRelatorioPrint");
  });

  it("PdvPage e PdvPageTeste montam o MESMO PdvRelatorios (correção cura os dois painéis)", () => {
    for (const rel of ["../../../pages/PdvPage.tsx", "../../../pages/PdvPageTeste.tsx"]) {
      const page = read(rel);
      expect(page).toContain("PdvRelatorios");
      expect(page).not.toContain("PdvRelatoriosTeste");
    }
  });
});
