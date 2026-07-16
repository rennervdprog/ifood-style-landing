import { formatBRL } from "@/lib/utils";
import { getOrderItemDisplayName, getOrderItemFlavors, getFractionAddonNames } from "./orderItemName";

// ─── Sanitização (XSS) ──────────────────────────────────────────────────
// Todo dado vindo do banco / cliente / operador passa por `esc()` antes de
// entrar em `innerHTML`. Sem isso, um nome de produto com `<script>` (ou
// observação enviada pelo cliente no checkout) era executado como HTML.
function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Formata data/hora sempre no fuso de São Paulo (evita cupom com hora errada). */
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return new Date(iso).toLocaleString("pt-BR");
  }
}

/**
 * Motor de impressão térmica unificado (delivery + PDV).
 *
 * Mantém os dois entry-points públicos (`printThermalReceipt`,
 * `printPdvReceipt`) como wrappers que apenas montam o HTML via os
 * mesmos helpers (`renderItems`, `renderPaymentBlock`, `renderAddress`,
 * `renderFooter`, `wrapCopies`, `applyPaperWidth`). Toda a regra de
 * itens/addons/bordas/tamanhos/complementos/observações/pagamento/troco/
 * endereço fica num único lugar — evita divergência entre fluxos.
 *
 * Recursos:
 *  - Nº de pedido sequencial (`order_number`) com fallback para UUID curto.
 *  - Banner de origem (DELIVERY / BALCÃO / MESA / RETIRADA).
 *  - Endereço quebrado em linhas (rua/nº/compl/bairro/cidade/CEP/ref).
 *  - Observação geral do pedido + observação por item.
 *  - Cupom em linha própria + desconto manual.
 *  - Split de pagamento e Recebido/Troco nos dois fluxos.
 *  - Telefone/CNPJ da loja no cabeçalho (quando informados).
 *  - 2 vias por padrão (cozinha + cliente) com page-break.
 *  - Largura configurável 58mm/80mm via `@page`.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────

interface PrintOrderItem {
  id?: string;
  quantity: number;
  unit_price: number;
  observations?: string | null;
  addons?: { name: string; price: number; required?: boolean; groupName?: string }[] | any | null;
  products?: { name: string } | null;
  /** Metadados livres (ex.: { weight_grams, price_per_kg }) usados na venda por peso. */
  metadata?: Record<string, any> | null;
}

interface PrintOrder {
  id: string;
  order_number?: number | null;
  created_at: string;
  subtotal: number;
  delivery_fee: number;
  total_price: number;
  payment_method: string;
  neighborhood: string;
  address_details: string;
  /** Endereço estruturado (opcional). */
  delivery_address?: {
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    cep?: string | null;
    reference?: string | null;
  } | null;
  notes?: string | null;
  observations?: string | null;
  needs_change?: boolean;
  change_for?: number | null;
  cash_received?: number | null;
  troco?: number | null;
  scheduled_for?: string | null;
  pdv_discount?: number | null;
  coupon_code?: string | null;
  coupon_discount?: number | null;
  delivery_mode?: string | null;
  client_phone?: string | null;
  payments?: { method: string; amount: number }[] | null;
  order_items?: PrintOrderItem[];
}

interface PrintPdvOrder {
  id: string;
  order_number?: number | null;
  created_at: string;
  subtotal: number;
  pdv_discount?: number | null;
  total_price: number;
  payment_method: string;
  cash_received?: number;
  troco?: number;
  table_identifier?: string | null;
  notes?: string | null;
  observations?: string | null;
  payments?: { method: string; amount: number }[] | null;
  order_items?: PrintOrderItem[];
}

export interface PrintOptions {
  storePhone?: string | null;
  storeCnpj?: string | null;
  /** Largura da bobina; padrão 80mm. */
  paperWidth?: 58 | 80;
  /** Quantidade de vias (1 = só cliente; 2 = cozinha + cliente). Padrão 2. */
  copies?: 1 | 2;
}

// ─── Labels ───────────────────────────────────────────────────────────────

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  maquininha_credito: "Cartão Crédito (maquininha)",
  maquininha_debito: "Cartão Débito (maquininha)",
  maquininha_pix: "PIX (maquininha)",
};

const pdvPaymentLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  maquininha_credito: "Cartão Crédito",
  maquininha_debito: "Cartão Débito",
  maquininha_pix: "PIX Maquininha",
  pix: "PIX Online",
  cartao: "Cartão na Entrega",
};

// ─── Infra de container/CSS ───────────────────────────────────────────────

const PRINT_CONTAINER_ID = "thermal-print-container";

/**
 * Dispara `window.print()` de forma resiliente.
 * Chrome/Edge invalidam o callback de `requestAnimationFrame` se a aba perde
 * foco ou há re-render entre frames, causando:
 *   "Failed to execute 'print' on 'Window': The provided callback is no longer runnable"
 * Usamos setTimeout (não depende do RAF scheduler) + try/catch + retry curto.
 */
function safePrint(attempt = 0) {
  setTimeout(() => {
    try {
      window.print();
    } catch (err) {
      if (attempt < 2) {
        safePrint(attempt + 1);
      } else {
        console.warn("[thermalPrint] window.print() falhou:", err);
      }
    }
  }, 50);
}

function getOrCreatePrintContainer(): HTMLDivElement {
  let container = document.getElementById(PRINT_CONTAINER_ID) as HTMLDivElement | null;
  if (!container) {
    container = document.createElement("div");
    container.id = PRINT_CONTAINER_ID;
    container.className = "thermal-print-zone";
    document.body.appendChild(container);
  }
  return container;
}

/** Injeta @page com largura da bobina. */
function applyPaperWidth(width: 58 | 80) {
  if (typeof document === "undefined") return;
  const id = "thermal-print-page-style";
  let tag = document.getElementById(id) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = id;
    document.head.appendChild(tag);
  }
  tag.textContent = `@media print { @page { size: ${width}mm auto; margin: 2mm; } }`;
}

// ─── Helpers de render ────────────────────────────────────────────────────

function originBanner(label: string): string {
  return `<div class="tp-origin" style="text-align:center;font-weight:bold;font-size:14px;letter-spacing:2px;background:#000;color:#fff;padding:4px;margin:4px 0">${label}</div>`;
}

function formatOrderNumber(order: { id: string; order_number?: number | null }): { big: string; small: string } {
  if (order.order_number && order.order_number > 0) {
    return { big: `#${order.order_number}`, small: `ref: ${order.id.slice(0, 8).toUpperCase()}` };
  }
  return { big: `#${order.id.slice(0, 8).toUpperCase()}`, small: "" };
}

function renderAddress(order: PrintOrder): string {
  const a = order.delivery_address;
  const lines: string[] = [];
  if (a && (a.street || a.number || a.neighborhood || a.cep)) {
    if (a.street || a.number) lines.push(`${esc(a.street || "")}${a.number ? ", " + esc(a.number) : ""}`.trim());
    if (a.complement) lines.push(`Compl.: ${esc(a.complement)}`);
    if (a.neighborhood || order.neighborhood) lines.push(`Bairro: ${esc(a.neighborhood || order.neighborhood)}`);
    if (a.city || a.state) lines.push(`${esc(a.city || "")}${a.state ? "/" + esc(a.state) : ""}`.trim());
    if (a.cep) lines.push(`CEP: ${esc(a.cep)}`);
    if (a.reference) lines.push(`Ref.: ${esc(a.reference)}`);
  } else {
    if (order.neighborhood) lines.push(`<b>Bairro:</b> ${esc(order.neighborhood)}`);
    if (order.address_details) lines.push(`<b>Endereço:</b> ${esc(order.address_details)}`);
  }
  return lines.map((l) => `<div class="tp-info">${l}</div>`).join("");
}

function renderItems(items: PrintOrderItem[] | undefined): string {
  let html = "";
  (items || []).forEach((item) => {
    const displayName = getOrderItemDisplayName(item as any);
    const flavors = getOrderItemFlavors(item as any);
    const fractionNames = getFractionAddonNames(item as any);
    let rawAddons: any = item.addons;
    if (typeof rawAddons === "string") {
      try { rawAddons = JSON.parse(rawAddons); } catch { rawAddons = []; }
    }
    const addonsAll: any[] = Array.isArray(rawAddons) ? rawAddons : [];
    // Frações vão pra um bloco próprio de "SABORES" — não duplicar nos opcionais.
    const addons: any[] = addonsAll.filter((a: any) => !fractionNames.has(String(a?.name)));
    const addonsTotal = addons.reduce((s: number, a: any) => s + (Number(a?.price) || 0), 0);
    const baseUnitPrice = Number(item.unit_price) - addonsTotal;
    const lineTotal = baseUnitPrice * item.quantity;

    html += `<div class="tp-item-row" style="display:flex;justify-content:space-between"><span><b>${item.quantity}x</b> ${esc(displayName)}</span><span>${formatBRL(lineTotal)}</span></div>`;
    if (item.quantity > 1 && baseUnitPrice > 0) {
      html += `<div style="font-size:11px;color:#444;padding-left:14px">Unit.: ${formatBRL(baseUnitPrice)}</div>`;
    }
    // Linha extra para itens vendidos por peso (mostra gramas e R$/kg).
    const wg = Number((item as any)?.metadata?.weight_grams || 0);
    const ppk = Number((item as any)?.metadata?.price_per_kg || 0);
    if (wg > 0 && ppk > 0) {
      html += `<div style="font-size:11px;color:#444;padding-left:14px">${wg} g × ${formatBRL(ppk)}/kg</div>`;
    }

    // Bloco de sabores (meio a meio / 3 ou 4 sabores) — uma linha por sabor, destacado.
    if (flavors.length > 0) {
      html += `<div style="border:1px solid #000;margin:3px 0;padding:3px 4px;background:#eee">`;
      html += `<div style="font-size:11px;font-weight:bold;letter-spacing:1px;text-align:center;border-bottom:1px dashed #000;padding-bottom:2px;margin-bottom:3px">SABORES</div>`;
      flavors.forEach((f) => {
        html += `<div style="font-size:13px;font-weight:bold;padding:1px 0">▣ ${esc(f)}</div>`;
      });
      html += `</div>`;
    }

    if (addons.length > 0) {
      const isBorder = (a: any) => typeof a?.name === "string" && /^borda\s*:/i.test(a.name);
      const isSize = (a: any) => typeof a?.name === "string" && /^tamanho\s*:/i.test(a.name);
      const isComplement = (a: any) => typeof a?.name === "string" && /^complemento\s*:/i.test(a.name);

      const required = addons.filter((a) => a.required && a.groupName);
      const sizes = addons.filter((a) => !(a.required && a.groupName) && isSize(a));
      const borders = addons.filter((a) => !(a.required && a.groupName) && isBorder(a));
      const complements = addons.filter((a) => !(a.required && a.groupName) && isComplement(a));
      const optional = addons.filter((a) => !(a.required && a.groupName) && !isBorder(a) && !isSize(a) && !isComplement(a));

      required.forEach((a) => {
        const priceStr = Number(a.price) > 0 ? formatBRL(Number(a.price)) : "";
        html += `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border:1px solid #000;padding:2px 4px;margin:3px 0;background:#eee"><span>★ ${esc(a.groupName)}: ${esc(String(a.name).toUpperCase())}</span><span>${priceStr}</span></div>`;
      });
      sizes.forEach((a) => {
        const sizeName = String(a.name).replace(/^tamanho\s*:\s*/i, "").toUpperCase();
        html += `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border:1px solid #000;padding:2px 4px;margin:3px 0;background:#eee"><span>▣ TAMANHO: ${esc(sizeName)}</span><span></span></div>`;
      });
      borders.forEach((a) => {
        const priceStr = Number(a.price) > 0 ? formatBRL(Number(a.price)) : "";
        const borderName = String(a.name).replace(/^borda\s*:\s*/i, "").toUpperCase();
        html += `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border:1px solid #000;padding:2px 4px;margin:3px 0;background:#eee"><span>◆ BORDA: ${esc(borderName)}</span><span>${priceStr}</span></div>`;
      });
      complements.forEach((a) => {
        const cName = String(a.name).replace(/^complemento\s*:\s*/i, "").toUpperCase();
        const cPrice = Number(a.price) > 0 ? formatBRL(Number(a.price)) : "GRÁTIS";
        html += `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border:1px solid #000;padding:2px 4px;margin:3px 0;background:#eee"><span>✚ COMPLEMENTO: ${esc(cName)}</span><span>${cPrice}</span></div>`;
      });
      optional.forEach((a) => {
        const priceStr = Number(a.price) > 0 ? formatBRL(Number(a.price)) : "";
        html += `<div style="display:flex;justify-content:space-between;font-size:12px;padding-left:12px"><span>+ ${esc(a.name)}</span><span>${priceStr}</span></div>`;
      });
    }

    if (item.observations) {
      html += `<div class="tp-obs" style="font-size:12px;font-weight:bold;border:1px dashed #000;padding:3px 5px;margin:3px 0">⚠ OBS: ${esc(item.observations)}</div>`;
    }
  });
  return html;
}

function renderPaymentBlock(args: {
  primaryMethod: string;
  splits: { method: string; amount: number }[];
  labels: Record<string, string>;
  isOnlinePaid: boolean;
  cashReceived?: number | null;
  troco?: number | null;
  changeFor?: number | null;
  isPdv?: boolean;
}): string {
  const { primaryMethod, splits, labels, isOnlinePaid, cashReceived, troco, changeFor, isPdv } = args;
  const hasSplit = splits.length > 1;
  let html = "";
  if (hasSplit) {
    html += `<div class="tp-info"><b>Pagamento (dividido):</b></div>`;
    splits.forEach((p) => {
      html += `<div style="display:flex;justify-content:space-between;font-size:12px;padding-left:8px"><span>• ${labels[p.method] || p.method}</span><span>${formatBRL(Number(p.amount) || 0)}</span></div>`;
    });
  } else {
    const tag = primaryMethod === "pix" && isOnlinePaid
      ? ' <span style="font-weight:bold">(PAGO ONLINE)</span>'
      : (!isPdv && (primaryMethod === "dinheiro" || primaryMethod === "cartao"))
        ? ' <span style="font-weight:bold">(RECEBER NA ENTREGA)</span>'
        : "";
    html += `<div class="tp-info"><b>Pagamento:</b> ${labels[primaryMethod] || primaryMethod}${tag}</div>`;
  }
  if (primaryMethod === "dinheiro") {
    if (cashReceived && cashReceived > 0) {
      html += `<div style="display:flex;justify-content:space-between;font-size:13px"><span>Recebido:</span><span>${formatBRL(cashReceived)}</span></div>`;
      html += `<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold"><span>Troco:</span><span>${formatBRL(Number(troco) || 0)}</span></div>`;
    } else if (changeFor && changeFor > 0) {
      html += `<div class="tp-change" style="font-weight:bold;border:2px solid #000;padding:4px;margin:4px 0;text-align:center">TROCO PARA: ${formatBRL(changeFor)}</div>`;
    }
  }
  return html;
}

function renderFooter(): string {
  return `
<div class="tp-footer"><p>Obrigado pela preferência!</p><p>ItaSuper</p></div>
<div class="tp-divider"></div>
<div style="text-align:center;font-size:9px;color:#666;line-height:1.4;padding:4px 0">
  <div>Serv. financeiros processados por</div>
  <div style="font-weight:bold">Asaas Gestão Financeira Inst. de Pagamento S.A.</div>
  <div>Autorizada pelo Banco Central do Brasil</div>
</div>`;
}

function wrapCopies(html: string, copies: number, viaLabels?: string[]): string {
  const n = Math.max(1, Math.min(2, copies));
  if (n === 1) return html;
  const labels = viaLabels ?? ["VIA COZINHA", "VIA CLIENTE"];
  return Array.from({ length: n })
    .map((_, i) => {
      const label = `<div style="text-align:center;font-size:10px;font-weight:bold;letter-spacing:2px;padding:2px 0;border-top:1px dashed #000;border-bottom:1px dashed #000;margin-bottom:4px">${labels[i] || ""}</div>`;
      const pageBreak = i < n - 1 ? `<div style="page-break-after:always"></div>` : "";
      return label + html + pageBreak;
    })
    .join("");
}

function storeHeader(storeName: string, opt: PrintOptions): string {
  const extra = [
    opt.storePhone ? `<div class="tp-info">Tel.: ${esc(opt.storePhone)}</div>` : "",
    opt.storeCnpj ? `<div class="tp-info">CNPJ: ${esc(opt.storeCnpj)}</div>` : "",
  ].join("");
  return `<div class="tp-center"><div class="tp-title">ITASUPER</div><div class="tp-store">${esc(storeName)}</div>${extra}</div>`;
}

// ─── Wrappers públicos ────────────────────────────────────────────────────

/**
 * Recibo de pedido delivery / retirada.
 * `options` permite passar telefone/CNPJ da loja, largura (58/80mm) e nº de vias.
 */
export function printThermalReceipt(
  order: PrintOrder,
  storeName: string,
  clientName: string,
  clientPhone?: string | null,
  options: PrintOptions = {},
) {
  const paperWidth = options.paperWidth ?? 80;
  const copies = options.copies ?? 2;
  applyPaperWidth(paperWidth);

  const date = fmtDate(order.created_at);
  const num = formatOrderNumber(order);
  const phone = clientPhone || order.client_phone || "";
  const subtotalNum = Number(order.subtotal) || 0;
  const deliveryNum = Number(order.delivery_fee) || 0;
  const totalNum = Number(order.total_price) || 0;

  // Cupom e desconto em linhas separadas.
  const couponNum = Number(order.coupon_discount || 0);
  const manualDiscount = Number(order.pdv_discount || 0);
  const computedDiscount = Math.max(0, subtotalNum + deliveryNum - totalNum);
  const fallback = couponNum <= 0 && manualDiscount <= 0 ? computedDiscount : 0;

  const couponShown = couponNum > 0 ? couponNum : (order.coupon_code && fallback > 0 ? fallback : 0);
  const discountShown = manualDiscount > 0 ? manualDiscount : (!order.coupon_code && fallback > 0 ? fallback : 0);

  const couponHtml = couponShown > 0.009
    ? `<div class="tp-total-row" style="display:flex;justify-content:space-between"><span>Cupom${order.coupon_code ? ` (${order.coupon_code})` : ""}:</span><span>-${formatBRL(couponShown)}</span></div>`
    : "";
  const discountHtml = discountShown > 0.009
    ? `<div class="tp-total-row" style="display:flex;justify-content:space-between"><span>Desconto:</span><span>-${formatBRL(discountShown)}</span></div>`
    : "";

  let scheduledHtml = "";
  if (order.scheduled_for) {
    const d = new Date(order.scheduled_for);
    const s = d.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    scheduledHtml = `
<div class="tp-scheduled" style="border:3px solid #000;padding:8px;margin:8px 0;text-align:center;background:#000;color:#fff;font-size:16px;font-weight:bold;letter-spacing:1px">
  ⏰ PEDIDO AGENDADO ⏰<br/>
  <span style="font-size:18px">${s}</span><br/>
  <span style="font-size:12px">⚠ NÃO PREPARAR AGORA ⚠</span>
</div>`;
  }

  const generalObs = order.notes || order.observations;
  const generalObsHtml = generalObs
    ? `<div class="tp-obs-general" style="border:2px dashed #000;padding:6px;margin:6px 0;font-size:13px"><b>⚠ OBSERVAÇÃO DO PEDIDO:</b><br/>${esc(generalObs)}</div>`
    : "";

  const splits = Array.isArray(order.payments) ? order.payments : [];
  const paymentHtml = renderPaymentBlock({
    primaryMethod: order.payment_method,
    splits,
    labels: paymentLabels,
    isOnlinePaid: order.payment_method === "pix",
    cashReceived: order.cash_received,
    troco: order.troco,
    changeFor: order.needs_change ? Number(order.change_for) : null,
  });

  const isPickup = ["retirada", "pickup"].includes(String(order.delivery_mode || "").toLowerCase());
  const origin = isPickup ? "RETIRADA NO BALCÃO" : "DELIVERY";

  const body = `
${storeHeader(storeName, options)}
<div class="tp-info" style="text-align:center">${date}</div>
${originBanner(origin)}
<div class="tp-order-id" style="text-align:center;font-size:22px;font-weight:bold">PEDIDO ${num.big}</div>
${num.small ? `<div style="text-align:center;font-size:10px;color:#666">${num.small}</div>` : ""}
${scheduledHtml}
<div class="tp-divider"></div>
${renderItems(order.order_items)}
${generalObsHtml}
<div class="tp-divider"></div>
<div class="tp-total-row" style="display:flex;justify-content:space-between"><span>Subtotal:</span><span>${formatBRL(subtotalNum)}</span></div>
<div class="tp-total-row" style="display:flex;justify-content:space-between"><span>Entrega:</span><span>${formatBRL(deliveryNum)}</span></div>
${couponHtml}
${discountHtml}
<div class="tp-total-big" style="display:flex;justify-content:space-between;font-weight:bold;font-size:18px"><span>TOTAL:</span><span>${formatBRL(totalNum)}</span></div>
<div class="tp-divider"></div>
${paymentHtml}
<div class="tp-divider"></div>
<div class="tp-info"><b>Cliente:</b> ${esc(clientName)}</div>
${phone ? `<div class="tp-info"><b>Telefone:</b> ${esc(phone)}</div>` : ""}
${isPickup ? `<div class="tp-info" style="font-weight:bold">✓ Cliente vai retirar no balcão</div>` : renderAddress(order)}
<div class="tp-divider"></div>
${renderFooter()}
`;

  const container = getOrCreatePrintContainer();
  container.innerHTML = wrapCopies(body, copies, ["VIA COZINHA", "VIA CLIENTE"]);

  safePrint();
}

// ─── PDV: recibos operacionais (movimentação e Z) ─────────────────────────

interface PrintMovementInput {
  type: "sangria" | "suprimento";
  amount: number;
  reason?: string | null;
  description?: string | null;
  operator?: string | null;
  sessionOpenedAt?: string | null;
}

/** Comprovante de sangria ou suprimento — 1 via (para o gerente/cofre). */
export function printMovementReceipt(
  mv: PrintMovementInput,
  storeName: string,
  options: PrintOptions = {},
) {
  const paperWidth = options.paperWidth ?? 80;
  applyPaperWidth(paperWidth);

  const now = fmtDate(new Date().toISOString());
  const isSangria = mv.type === "sangria";
  const label = isSangria ? "SANGRIA (SAÍDA)" : "SUPRIMENTO (ENTRADA)";
  const signed = `${isSangria ? "-" : "+"} ${formatBRL(Math.abs(Number(mv.amount) || 0))}`;

  const body = `
${storeHeader(storeName, options)}
<div class="tp-info" style="text-align:center">${now}</div>
${originBanner(label)}
<div class="tp-divider"></div>
<div class="tp-total-big" style="display:flex;justify-content:space-between;font-weight:bold;font-size:22px"><span>VALOR</span><span>${esc(signed)}</span></div>
<div class="tp-divider"></div>
${mv.reason ? `<div class="tp-info"><b>Motivo:</b> ${esc(mv.reason)}</div>` : ""}
${mv.description ? `<div class="tp-info"><b>Obs.:</b> ${esc(mv.description)}</div>` : ""}
${mv.operator ? `<div class="tp-info"><b>Operador:</b> ${esc(mv.operator)}</div>` : ""}
${mv.sessionOpenedAt ? `<div class="tp-info"><b>Turno aberto:</b> ${esc(fmtDate(mv.sessionOpenedAt))}</div>` : ""}
<div class="tp-divider"></div>
<div style="font-size:11px;margin-top:8px">Assinatura do responsável:</div>
<div style="border-bottom:1px solid #000;height:36px;margin:6px 20px 8px"></div>
${renderFooter()}
`;

  const container = getOrCreatePrintContainer();
  container.innerHTML = wrapCopies(body, 1);
  safePrint();
}

interface PrintZReportInput {
  sessionId: string;
  openedAt: string;
  closedAt?: string;
  operator?: string | null;
  openingAmount: number;
  totalSales: number;
  totalOrders: number;
  ticketMedio: number;
  byPayment: Record<string, number>;
  paymentLabels?: Record<string, string>;
  sangrias: number;
  suprimentos: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  blindClose: boolean;
}

/** Relatório Z (cupom de fechamento) — 2 vias (operador + gerência). */
export function printZReport(
  z: PrintZReportInput,
  storeName: string,
  options: PrintOptions = {},
) {
  const paperWidth = options.paperWidth ?? 80;
  applyPaperWidth(paperWidth);

  const labels = z.paymentLabels || {};
  const paymentRows = Object.entries(z.byPayment)
    .map(
      ([m, v]) =>
        `<div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(labels[m] || m)}</span><span>${formatBRL(Number(v) || 0)}</span></div>`,
    )
    .join("");

  const diff = Number(z.difference) || 0;
  const diffLabel = Math.abs(diff) < 0.05 ? "Conferido" : diff > 0 ? "Sobra" : "Falta";
  const diffValue = Math.abs(diff) < 0.05 ? "—" : formatBRL(Math.abs(diff));

  const cashBlock = z.blindClose
    ? `<div style="font-size:12px;text-align:center;margin:6px 0">** Fechamento CEGO — esperado oculto para o operador **</div>`
    : `<div style="display:flex;justify-content:space-between;font-size:13px"><span>Dinheiro esperado:</span><span>${formatBRL(z.expectedCash)}</span></div>`;

  const body = `
${storeHeader(storeName, options)}
<div class="tp-info" style="text-align:center">${fmtDate(z.closedAt || new Date().toISOString())}</div>
${originBanner("RELATÓRIO Z — FECHAMENTO DE CAIXA")}
<div class="tp-info"><b>Turno:</b> ${z.sessionId.slice(0, 8)}</div>
<div class="tp-info"><b>Aberto:</b> ${esc(fmtDate(z.openedAt))}</div>
${z.operator ? `<div class="tp-info"><b>Operador:</b> ${esc(z.operator)}</div>` : ""}
<div class="tp-divider"></div>
<div style="font-weight:bold;font-size:13px;margin:4px 0">MOVIMENTAÇÃO</div>
<div style="display:flex;justify-content:space-between;font-size:13px"><span>Abertura (troco):</span><span>${formatBRL(z.openingAmount)}</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px"><span>Vendas (${z.totalOrders}):</span><span>${formatBRL(z.totalSales)}</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px"><span>Ticket médio:</span><span>${formatBRL(z.ticketMedio)}</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px"><span>Suprimentos:</span><span>+ ${formatBRL(z.suprimentos)}</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px"><span>Sangrias:</span><span>- ${formatBRL(z.sangrias)}</span></div>
<div class="tp-divider"></div>
<div style="font-weight:bold;font-size:13px;margin:4px 0">POR FORMA DE PAGAMENTO</div>
${paymentRows || `<div style="font-size:12px;color:#666">Sem vendas no turno.</div>`}
<div class="tp-divider"></div>
<div style="font-weight:bold;font-size:13px;margin:4px 0">CONFERÊNCIA DE CAIXA</div>
${cashBlock}
<div style="display:flex;justify-content:space-between;font-size:13px"><span>Dinheiro contado:</span><span>${formatBRL(z.countedCash)}</span></div>
<div class="tp-total-big" style="display:flex;justify-content:space-between;font-weight:bold;font-size:18px;margin-top:4px"><span>${diffLabel.toUpperCase()}:</span><span>${diffValue}</span></div>
<div class="tp-divider"></div>
<div style="font-size:11px;margin-top:8px">Assinatura do operador:</div>
<div style="border-bottom:1px solid #000;height:36px;margin:6px 20px 12px"></div>
<div style="font-size:11px">Assinatura do gerente:</div>
<div style="border-bottom:1px solid #000;height:36px;margin:6px 20px 8px"></div>
${renderFooter()}
`;

  const container = getOrCreatePrintContainer();
  container.innerHTML = wrapCopies(body, 2, ["VIA OPERADOR", "VIA GERÊNCIA"]);
  safePrint();
}

/** Recibo do PDV (balcão / mesa). */
export function printPdvReceipt(order: PrintPdvOrder, storeName: string, options: PrintOptions = {}) {
  const paperWidth = options.paperWidth ?? 80;
  const copies = options.copies ?? 2;
  applyPaperWidth(paperWidth);

  const date = fmtDate(order.created_at);
  const num = formatOrderNumber(order);
  const discount = Number(order.pdv_discount || 0);
  const splits = Array.isArray(order.payments) ? order.payments : [];

  const origin = order.table_identifier
    ? `MESA / COMANDA ${esc(String(order.table_identifier).toUpperCase())}`
    : "BALCÃO";

  const discountHtml = discount > 0
    ? `<div style="display:flex;justify-content:space-between;font-size:13px"><span>Desconto:</span><span>-${formatBRL(discount)}</span></div>`
    : "";

  const paymentHtml = renderPaymentBlock({
    primaryMethod: order.payment_method,
    splits,
    labels: pdvPaymentLabels,
    isOnlinePaid: false,
    cashReceived: order.cash_received,
    troco: order.troco,
    changeFor: null,
    isPdv: true,
  });

  const generalObs = order.notes || order.observations;
  const generalObsHtml = generalObs
    ? `<div class="tp-obs-general" style="border:2px dashed #000;padding:6px;margin:6px 0;font-size:13px"><b>⚠ OBSERVAÇÃO:</b><br/>${esc(generalObs)}</div>`
    : "";

  const body = `
${storeHeader(storeName, options)}
<div class="tp-info" style="text-align:center">${date}</div>
${originBanner(origin)}
<div class="tp-order-id" style="text-align:center;font-size:22px;font-weight:bold">VENDA PDV ${num.big}</div>
${num.small ? `<div style="text-align:center;font-size:10px;color:#666">${num.small}</div>` : ""}
<div class="tp-divider"></div>
${renderItems(order.order_items)}
${generalObsHtml}
<div class="tp-divider"></div>
<div class="tp-total-row" style="display:flex;justify-content:space-between"><span>Subtotal:</span><span>${formatBRL(Number(order.subtotal))}</span></div>
${discountHtml}
<div class="tp-total-big" style="display:flex;justify-content:space-between;font-weight:bold;font-size:18px"><span>TOTAL:</span><span>${formatBRL(Number(order.total_price))}</span></div>
<div class="tp-divider"></div>
${paymentHtml}
<div class="tp-divider"></div>
${renderFooter()}
`;

  const container = getOrCreatePrintContainer();
  container.innerHTML = wrapCopies(body, copies, ["VIA INTERNA", "VIA CLIENTE"]);

  safePrint();
}