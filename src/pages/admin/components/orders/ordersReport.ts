import { formatBRL } from "@/lib/utils";

/**
 * Relatórios de pedidos (Fase A) — helpers compartilhados pelas duas
 * OrdersSection e pela OrdersToolbar: classificação de origem, rótulos,
 * filtros extras, CSV completo e relatório imprimível do recorte filtrado.
 */

export type OrderSourceBucket = "delivery" | "pdv" | "manual" | "whatsapp";

/** Origem do pedido em baldes: só pdv/manual/whatsapp_bot têm balde próprio. */
export function classifyOrderSource(o: any): OrderSourceBucket {
  const raw = String(o?.order_source || "").toLowerCase().trim();
  if (raw === "pdv") return "pdv";
  if (raw === "manual") return "manual";
  if (raw === "whatsapp_bot") return "whatsapp";
  return "delivery";
}

export const SOURCE_LABELS: Record<OrderSourceBucket, string> = {
  delivery: "Delivery",
  pdv: "PDV",
  manual: "Manual",
  whatsapp: "WhatsApp",
};

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  cash: "Dinheiro",
  pix_direto: "Pix direto",
  pix: "Pix",
  pix_machine: "Pix na maquininha",
  pix_maquininha: "Pix na maquininha",
  cartao: "Cartão",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  maquininha_credito: "Cartão de crédito (maquininha)",
  maquininha_debito: "Cartão de débito (maquininha)",
};

export function paymentLabel(raw: string | null | undefined): string {
  if (!raw) return "Não informado";
  return PAYMENT_LABELS[String(raw).toLowerCase().trim()] || String(raw);
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  preparando: "Preparando",
  pronto_para_entrega: "Pronto para entrega",
  saiu_entrega: "Saiu para entrega",
  em_transito: "Em trânsito",
  entregue: "Entregue",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
  comprovante_enviado: "Comprovante enviado",
  aguardando_comprovante: "Aguardando comprovante",
  aguardando_pagamento: "Aguardando pagamento",
};

export function statusLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  return STATUS_LABELS[String(raw).toLowerCase().trim()] || String(raw);
}

export interface OrdersExtraFilters {
  payment: string;
  fulfillment: "all" | "delivery" | "pickup";
  neighborhood: string;
  minValue: string;
  maxValue: string;
  product: string;
}

export const EMPTY_EXTRA_FILTERS: OrdersExtraFilters = {
  payment: "",
  fulfillment: "all",
  neighborhood: "",
  minValue: "",
  maxValue: "",
  product: "",
};

export function matchesExtraFilters(o: any, f: OrdersExtraFilters): boolean {
  if (f.payment && String(o?.payment_method || "") !== f.payment) return false;
  const isPickup = o?.neighborhood === "RETIRADA";
  if (f.fulfillment === "pickup" && !isPickup) return false;
  if (f.fulfillment === "delivery" && isPickup) return false;
  if (f.neighborhood && o?.neighborhood !== f.neighborhood) return false;
  const total = Number(o?.total_price || 0);
  if (f.minValue && total < Number(f.minValue)) return false;
  if (f.maxValue && total > Number(f.maxValue)) return false;
  if (f.product) {
    const items = o?.order_items || [];
    if (!items.some((i: any) => i?.products?.name === f.product)) return false;
  }
  return true;
}

export function orderDisplayCode(o: any): string {
  if (o?.order_number != null) return `#${o.order_number}`;
  return `#${String(o?.id || "").slice(0, 8).toUpperCase()}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function itemsText(o: any): string {
  const items = o?.order_items || [];
  return items
    .map((i: any) => `${Number(i?.quantity || 1)}x ${i?.products?.name || "Item"}`)
    .join(" | ");
}

function itemsQty(o: any): number {
  return (o?.order_items || []).reduce((s: number, i: any) => s + Number(i?.quantity || 0), 0);
}

export interface OrdersReportGetters {
  getClientName: (clientId: string) => string;
  getClientWhatsApp: (clientId: string) => string;
}

/** CSV completo dos pedidos do recorte (uma linha por pedido). */
export function buildOrdersCsv(orders: any[], getters: OrdersReportGetters): string {
  const header = [
    "Data", "Pedido", "Origem", "Cliente", "Telefone", "Bairro", "Pagamento",
    "Status", "Itens", "Qtd itens", "Subtotal", "Taxa de entrega", "Total",
  ];
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = orders.map((o) =>
    [
      fmtDateTime(o.created_at),
      orderDisplayCode(o),
      SOURCE_LABELS[classifyOrderSource(o)],
      getters.getClientName(o.client_id),
      getters.getClientWhatsApp(o.client_id),
      o.neighborhood === "RETIRADA" ? "Retirada" : o.neighborhood || "",
      paymentLabel(o.payment_method),
      statusLabel(o.status),
      itemsText(o),
      String(itemsQty(o)),
      formatBRL(Number(o.subtotal || 0)),
      formatBRL(Number(o.delivery_fee || 0)),
      formatBRL(Number(o.total_price || 0)),
    ]
      .map(esc)
      .join(";")
  );
  return "\uFEFF" + [header.map(esc).join(";"), ...lines].join("\n");
}

function escHtml(v: string): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface OrdersReportParams {
  storeName: string;
  periodLabel: string;
  filtersLabel: string;
  orders: any[];
  getters: OrdersReportGetters;
}

/** Abre o relatório do recorte numa nova aba, pronto pra imprimir/salvar. */
export function openOrdersReport(params: OrdersReportParams): boolean {
  const { storeName, periodLabel, filtersLabel, orders, getters } = params;
  const valid = orders.filter((o) => o.status !== "cancelado");
  const cancelled = orders.filter((o) => o.status === "cancelado");
  const total = valid.reduce((s, o) => s + Number(o.total_price || 0), 0);
  const ticket = valid.length ? total / valid.length : 0;

  const breakdown = (keyFn: (o: any) => string) => {
    const map = new Map<string, { count: number; total: number }>();
    for (const o of valid) {
      const k = keyFn(o);
      const cur = map.get(k) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(o.total_price || 0);
      map.set(k, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  };
  const bySource = breakdown((o) => SOURCE_LABELS[classifyOrderSource(o)]);
  const byPayment = breakdown((o) => paymentLabel(o.payment_method));
  const byStatus = breakdown((o) => statusLabel(o.status));

  const breakdownTable = (title: string, rows: [string, { count: number; total: number }][]) =>
    `<h3>${title}</h3><table>${rows
      .map(
        ([k, v]) =>
          `<tr><td>${escHtml(k)}</td><td class="n">${v.count}</td><td class="n">${formatBRL(v.total)}</td></tr>`
      )
      .join("")}</table>`;

  const orderRows = [...orders]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(
      (o) =>
        `<tr><td>${fmtDateTime(o.created_at)}</td><td>${orderDisplayCode(o)}</td><td>${escHtml(
          getters.getClientName(o.client_id)
        )}</td><td>${SOURCE_LABELS[classifyOrderSource(o)]}</td><td>${paymentLabel(
          o.payment_method
        )}</td><td>${statusLabel(o.status)}</td><td>${escHtml(itemsText(o))}</td><td class="n">${formatBRL(
          Number(o.total_price || 0)
        )}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório de pedidos — ${escHtml(storeName)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1F2430; margin: 24px; }
  header { border-bottom: 4px solid #FF6A00; padding-bottom: 10px; margin-bottom: 14px; }
  h1 { font-size: 20px; margin: 0; } h2 { font-size: 14px; color: #5B6472; font-weight: normal; margin: 4px 0 0; }
  h3 { font-size: 13px; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: .04em; color: #5B6472; }
  .kpis { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0; }
  .kpi { border: 1px solid #E6E6E9; border-radius: 10px; padding: 10px 14px; min-width: 130px; }
  .kpi .l { font-size: 11px; color: #5B6472; text-transform: uppercase; } .kpi .v { font-size: 18px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #EDEDEF; padding: 5px 6px; text-align: left; }
  th { font-size: 10.5px; text-transform: uppercase; color: #5B6472; }
  td.n, th.n { text-align: right; }
  .cols { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; }
  @media print { .noprint { display: none; } body { margin: 10px; } }
</style></head><body>
<header>
  <h1>${escHtml(storeName)} — Relatório de pedidos</h1>
  <h2>Período: ${escHtml(periodLabel)} · Filtros: ${escHtml(filtersLabel)} · Gerado em ${fmtDateTime(new Date().toISOString())}</h2>
</header>
<button class="noprint" onclick="window.print()" style="background:#FF6A00;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer;">Imprimir</button>
<div class="kpis">
  <div class="kpi"><div class="l">Pedidos no recorte</div><div class="v">${orders.length}</div></div>
  <div class="kpi"><div class="l">Faturamento (sem cancelados)</div><div class="v">${formatBRL(total)}</div></div>
  <div class="kpi"><div class="l">Ticket médio</div><div class="v">${formatBRL(ticket)}</div></div>
  <div class="kpi"><div class="l">Cancelados</div><div class="v">${cancelled.length}</div></div>
</div>
<div class="cols">
  <div>${breakdownTable("Por origem", bySource)}</div>
  <div>${breakdownTable("Por pagamento", byPayment)}</div>
  <div>${breakdownTable("Por status", byStatus)}</div>
</div>
<h3>Pedidos do recorte</h3>
<table>
  <tr><th>Data</th><th>Pedido</th><th>Cliente</th><th>Origem</th><th>Pagamento</th><th>Status</th><th>Itens</th><th class="n">Total</th></tr>
  ${orderRows || '<tr><td colspan="8">Nenhum pedido no recorte.</td></tr>'}
</table>
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) return false;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
