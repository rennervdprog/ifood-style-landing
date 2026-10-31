/**
 * Exportação REAL em PDF dos relatórios do PDV (item 13 do plano de
 * correções, 2026-10-31).
 *
 * Antes, o botão "PDF" de `PdvRelatorios` chamava `window.print()`
 * sobre uma visão A4 montada via portal. Dois problemas provados:
 *
 *  1. `window.print()` abre o preview de impressão do navegador, que
 *     é MODAL (mecanismo provado no item 12): enquanto aberto, nenhum
 *     clique chega à página — na varredura de botões, o clique
 *     "congelou a página, sem PDF, sem erro visível, e o PDV só
 *     voltou recarregando". Além disso, `window.print()` nunca baixa
 *     arquivo: o botão prometia "Exportar PDF" e entregava um modal.
 *  2. Toda impressão de cupom injeta no <head> um estilo persistente
 *     `@page { size: 80mm auto }` (`applyPaperWidth`, nunca removido),
 *     que vence o `@page` do relatório no cascade — numa sessão normal
 *     de PDV, o relatório desenhado para A4 seria paginado em bobina
 *     de 80mm.
 *
 * Correção: gerar o PDF em memória (jsPDF + autotable) a partir dos
 * MESMOS dados que a visão de impressão renderizava — mesmas seções,
 * rótulos e formatação — e baixar via Blob, o mesmo padrão do botão
 * CSV vizinho. Sem `window.print()`: sem modal, a página continua
 * responsiva, o arquivo baixa de verdade e o resultado é imune ao
 * estado de impressão térmica da sessão.
 */
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatBRL } from "@/lib/utils";

// ─── tipos (mesmas formas que a visão de impressão consumia) ─────────────────

export interface PdvReportStats {
  totalSales: number;
  totalDiscount: number;
  totalCommission: number;
  avgTicket: number;
  count: number;
  byPayment: Record<string, number>;
  topProducts: { name: string; qty: number; revenue: number; abc: string }[];
  peakHour: { hour: number; count: number } | null;
  /** Conferência de caixa — presente no relatório de turno. */
  conferencia?: PdvReportConferencia | null;
}

export interface PdvReportOperator {
  user_id: string;
  name: string;
  count: number;
  total: number;
}

export interface PdvReportConferencia {
  operador: string;
  periodo: string;
  abertura: number;
  vendas: number;
  vendasQtd: number;
  vendasPorPagamento: Record<string, number>;
  suprimentos: number;
  sangrias: number;
  saldoEsperado: number;
  valorContado: number | null;
  diferenca: number | null;
}

export interface PdvReportPdfInput {
  storeName: string;
  periodLabel: string;
  dateRangeLabel: string;
  stats: PdvReportStats;
  operators: PdvReportOperator[];
  /** Nome do arquivo baixado (ex.: `pdv-relatorio-week-2026-10-31.pdf`). */
  filename: string;
  /** Sobrescrevível em testes; padrão = agora. */
  generatedAt?: Date;
}

// Rótulos idênticos aos da visão de impressão substituída.
const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  maquininha_credito: "Crédito",
  maquininha_debito: "Débito",
  maquininha_pix: "PIX maquininha",
};

const MARGIN_X = 14;
const PAGE_BOTTOM = 282; // A4 (297mm) menos a margem inferior de trabalho
const GRAY_500: [number, number, number] = [107, 114, 128];
const GRAY_200: [number, number, number] = [229, 231, 235];
const BLACK: [number, number, number] = [0, 0, 0];

function formatGeneratedAt(d: Date): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Doc = InstanceType<typeof jsPDF>;

function lastY(doc: Doc): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

/** Título de seção (caixa alta, como na visão de impressão) + cursor novo. */
function sectionTitle(doc: Doc, title: string, y: number): number {
  if (y > PAGE_BOTTOM - 12) {
    doc.addPage();
    y = 16;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(title.toUpperCase(), MARGIN_X, y);
  return y + 2;
}

/** Tabela rótulo → valor (Resumo / Conferência), sem cabeçalho. */
function labelValueTable(
  doc: Doc,
  rows: [string, string][],
  startY: number,
): number {
  autoTable(doc, {
    body: rows,
    startY,
    margin: { left: MARGIN_X, right: MARGIN_X },
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: { top: 1.7, bottom: 1.7, left: 0, right: 0 },
      textColor: BLACK,
      lineColor: GRAY_200,
      lineWidth: { bottom: 0.15 },
    },
    columnStyles: {
      0: { textColor: [75, 85, 99] },
      1: { halign: "right", fontStyle: "bold", cellWidth: 55 },
    },
  });
  return lastY(doc) + 7;
}

/** Tabela com cabeçalho (Pagamentos / Produtos / Operadores). */
function dataTable(
  doc: Doc,
  head: string[],
  body: (string | number)[][],
  startY: number,
  rightAlignedCols: number[],
): number {
  const columnStyles: Record<number, { halign: "right" }> = {};
  rightAlignedCols.forEach((c) => {
    columnStyles[c] = { halign: "right" };
  });
  autoTable(doc, {
    head: [head],
    body,
    startY,
    margin: { left: MARGIN_X, right: MARGIN_X },
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: { top: 1.7, bottom: 1.7, left: 0, right: 2 },
      textColor: BLACK,
      lineColor: GRAY_200,
      lineWidth: { bottom: 0.15 },
    },
    headStyles: {
      fontStyle: "bold",
      fontSize: 8,
      textColor: GRAY_500,
      lineWidth: { bottom: 0.3 },
    },
    columnStyles,
  });
  return lastY(doc) + 7;
}

/** Monta o PDF do relatório e devolve o Blob (sem baixar). */
export function buildPdvReportPdf(input: PdvReportPdfInput): Blob {
  const { stats, operators } = input;
  const generatedAt = formatGeneratedAt(input.generatedAt ?? new Date());
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // ── Cabeçalho ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...BLACK);
  doc.text(input.storeName || "Loja", MARGIN_X, 18);
  doc.setFontSize(12);
  doc.text(`Relatório PDV — ${input.periodLabel}`, MARGIN_X, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_500);
  doc.text(
    `Período: ${input.dateRangeLabel} · Gerado em ${generatedAt}`,
    MARGIN_X,
    30.5,
  );
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, 33, 210 - MARGIN_X, 33);

  let y = 40;

  // ── Conferência de caixa (relatório de turno) ──
  if (stats.conferencia) {
    const c = stats.conferencia;
    const rows: [string, string][] = [
      ["Operador", c.operador],
      ["Abertura", formatBRL(c.abertura)],
      [`Vendas (${c.vendasQtd})`, formatBRL(c.vendas)],
      ...Object.entries(c.vendasPorPagamento)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([m, v]): [string, string] => [
            `· ${PAYMENT_LABELS[m] ?? m}`,
            formatBRL(v),
          ],
        ),
      ["Suprimentos", formatBRL(c.suprimentos)],
      ["Sangrias", formatBRL(c.sangrias)],
      ["Saldo esperado", formatBRL(c.saldoEsperado)],
    ];
    if (c.valorContado !== null) rows.push(["Valor contado", formatBRL(c.valorContado)]);
    if (c.diferenca !== null) {
      rows.push([
        "Diferença",
        Math.abs(c.diferenca) < 0.05
          ? "Conferido"
          : c.diferenca > 0
            ? `Sobra ${formatBRL(c.diferenca)}`
            : `Falta ${formatBRL(Math.abs(c.diferenca))}`,
      ]);
    }
    y = labelValueTable(doc, rows, sectionTitle(doc, "Conferência de caixa", y));
  }

  // ── Resumo ──
  y = labelValueTable(
    doc,
    [
      ["Faturamento", formatBRL(stats.totalSales)],
      ["Nº de vendas", String(stats.count)],
      ["Ticket médio", formatBRL(stats.avgTicket)],
      ["Descontos", formatBRL(stats.totalDiscount)],
      ["Comissão plataforma", formatBRL(stats.totalCommission)],
    ],
    sectionTitle(doc, "Resumo", y),
  );

  // ── Formas de pagamento ──
  const payments = Object.entries(stats.byPayment).sort((a, b) => b[1] - a[1]);
  y = dataTable(
    doc,
    ["Método", "Valor", "%"],
    payments.map(([method, value]) => [
      PAYMENT_LABELS[method] ?? method,
      formatBRL(value),
      stats.totalSales > 0 ? `${((value / stats.totalSales) * 100).toFixed(1)}%` : "—",
    ]),
    sectionTitle(doc, "Formas de pagamento", y),
    [1, 2],
  );

  // ── Produtos (Curva ABC) ──
  if (stats.topProducts.length > 0) {
    y = dataTable(
      doc,
      ["#", "Produto", "Qtd", "Receita", "Classe"],
      stats.topProducts.map((p, i) => [
        String(i + 1),
        p.name,
        String(p.qty),
        formatBRL(p.revenue),
        p.abc,
      ]),
      sectionTitle(doc, "Produtos (Curva ABC)", y),
      [2, 3, 4],
    );
  }

  // ── Operadores ──
  if (operators.length > 0) {
    y = dataTable(
      doc,
      ["#", "Operador", "Vendas", "Faturamento"],
      operators.map((o, i) => [
        String(i + 1),
        o.name,
        String(o.count),
        formatBRL(o.total),
      ]),
      sectionTitle(doc, "Produtividade por operador", y),
      [2, 3],
    );
  }

  // ── Horário de pico + rodapé ──
  if (y > PAGE_BOTTOM - 14) {
    doc.addPage();
    y = 16;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  if (stats.peakHour) {
    doc.text(
      `Horário de pico: ${String(stats.peakHour.hour).padStart(2, "0")}:00 — ${stats.peakHour.count} vendas`,
      MARGIN_X,
      y,
    );
    y += 8;
  }
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(`Relatório gerado pelo ItaSuper PDV em ${generatedAt}`, MARGIN_X, y);

  return doc.output("blob");
}

/**
 * Gera o PDF e dispara o download — mesmo padrão do botão CSV vizinho
 * (Blob + object URL + clique em âncora). A página não sai do lugar:
 * sem `window.print()`, sem modal, sem recarregar.
 */
export function downloadPdvReportPdf(input: PdvReportPdfInput): void {
  const blob = buildPdvReportPdf(input);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = input.filename;
  a.click();
  URL.revokeObjectURL(url);
}
