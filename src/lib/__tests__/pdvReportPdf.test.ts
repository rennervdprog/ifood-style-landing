import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildPdvReportPdf,
  downloadPdvReportPdf,
  type PdvReportPdfInput,
} from "../pdvReportPdf";

// Item 13 (2026-10-31) — o "Exportar PDF" dos relatórios do PDV era
// `window.print()`: abria o preview modal do navegador (página refém,
// nenhum arquivo) e ainda paginava o relatório A4 sob o `@page`
// térmico de 80mm injetado pelas impressões de cupom da sessão.
// A correção gera um PDF de verdade em memória e baixa via Blob.
// Estes testes executam a geração REAL (jsPDF + autotable) com um
// dataset volumoso e fixam: arquivo válido, conteúdo escalando em
// páginas, conclusão rápida (trabalho limitado — sem o travamento) e
// NENHUMA chamada a window.print no caminho.

function bigInput(over: Partial<PdvReportPdfInput> = {}): PdvReportPdfInput {
  const products = Array.from({ length: 120 }, (_, i) => ({
    name: `Produto ${String(i + 1).padStart(3, "0")}`,
    qty: 300 - i,
    revenue: (300 - i) * 12.5,
    abc: i < 40 ? "A" : i < 90 ? "B" : "C",
  }));
  return {
    storeName: "Loja Demonstração",
    periodLabel: "Este mês",
    dateRangeLabel: "01/10/2026 – 31/10/2026",
    filename: "pdv-relatorio-month-2026-10-31.pdf",
    generatedAt: new Date(2026, 9, 31, 10, 30),
    stats: {
      totalSales: 48930.55,
      totalDiscount: 812.3,
      totalCommission: 489.31,
      avgTicket: 79.89,
      count: 612,
      byPayment: {
        dinheiro: 15200.1,
        maquininha_credito: 18900.2,
        maquininha_debito: 6100.05,
        maquininha_pix: 8730.2,
      },
      topProducts: products,
      peakHour: { hour: 19, count: 74 },
      conferencia: {
        operador: "Operador Teste",
        periodo: "31/10/2026 08:00 → 31/10/2026 18:00",
        abertura: 200,
        vendas: 3120.4,
        vendasQtd: 41,
        vendasPorPagamento: { dinheiro: 1500.4, maquininha_pix: 1620 },
        suprimentos: 100,
        sangrias: 500,
        saldoEsperado: 2920.4,
        valorContado: 2920.4,
        diferenca: 0,
      },
    },
    operators: [
      { user_id: "op-1", name: "Operador Um", count: 300, total: 24100.1 },
      { user_id: "op-2", name: "Operador Dois", count: 210, total: 16300.25 },
      { user_id: "op-3", name: "Operador Três", count: 102, total: 8530.2 },
    ],
    ...over,
  };
}

async function pdfText(blob: Blob): Promise<string> {
  // O Blob do jsdom não tem arrayBuffer() — FileReader é o caminho.
  const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
  return new TextDecoder("latin1").decode(buf);
}

function pageCount(raw: string): number {
  const m = raw.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/);
  if (m) return Number(m[1]);
  return (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
}

let printSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Item 13 — buildPdvReportPdf gera um PDF de verdade", () => {
  it("dataset volumoso (612 vendas, 120 produtos): PDF válido, multipágina, rápido e sem window.print", async () => {
    const t0 = performance.now();
    const blob = buildPdvReportPdf(bigInput());
    const elapsed = performance.now() - t0;

    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(3000);

    const raw = await pdfText(blob);
    expect(raw.startsWith("%PDF-")).toBe(true);
    // 120 produtos + conferência não cabem em 1 página A4.
    expect(pageCount(raw)).toBeGreaterThanOrEqual(3);
    // Trabalho limitado e síncrono curto — o oposto do travamento:
    // nada de modal, nada de espera infinita.
    expect(elapsed).toBeLessThan(3000);
    expect(printSpy).not.toHaveBeenCalled();
  });

  it("dataset pequeno gera PDF de 1 página (o tamanho acompanha o conteúdo)", async () => {
    const blob = buildPdvReportPdf(
      bigInput({
        stats: {
          totalSales: 25,
          totalDiscount: 0,
          totalCommission: 0.25,
          avgTicket: 25,
          count: 1,
          byPayment: { dinheiro: 25 },
          topProducts: [{ name: "Porção de Nuggets", qty: 1, revenue: 25, abc: "A" }],
          peakHour: { hour: 12, count: 1 },
          conferencia: null,
        },
        operators: [{ user_id: "op-1", name: "Operador Um", count: 1, total: 25 }],
      }),
    );
    const raw = await pdfText(blob);
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(pageCount(raw)).toBe(1);
  });
});

describe("Item 13 — downloadPdvReportPdf baixa o arquivo sem tocar na página", () => {
  it("cria object URL com o Blob do PDF e clica numa âncora com o nome certo", () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:relatorio-pdf");
    const revokeObjectURL = vi.fn((_url: string) => {});
    (URL as unknown as { createObjectURL: typeof createObjectURL }).createObjectURL =
      createObjectURL;
    (URL as unknown as { revokeObjectURL: typeof revokeObjectURL }).revokeObjectURL =
      revokeObjectURL;

    const downloads: { href: string; download: string }[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push({ href: this.href, download: this.download });
      });

    downloadPdvReportPdf(bigInput());

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe("application/pdf");
    expect(downloads).toEqual([
      { href: "blob:relatorio-pdf", download: "pdv-relatorio-month-2026-10-31.pdf" },
    ]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:relatorio-pdf");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    // O cerne do item 13: o caminho do PDF NÃO passa por window.print.
    expect(printSpy).not.toHaveBeenCalled();
  });
});
