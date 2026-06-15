import { formatBRL } from "@/lib/utils";
import { getOrderItemDisplayName } from "./orderItemName";

interface PrintOrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  observations?: string | null;
  addons?: { name: string; price: number; required?: boolean; groupName?: string }[] | null;
  products?: { name: string } | null;
}

interface PrintOrder {
  id: string;
  created_at: string;
  subtotal: number;
  delivery_fee: number;
  total_price: number;
  payment_method: string;
  neighborhood: string;
  address_details: string;
  needs_change?: boolean;
  change_for?: number | null;
  scheduled_for?: string | null;
  order_items?: PrintOrderItem[];
}

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
};

const PRINT_CONTAINER_ID = "thermal-print-container";

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

/**
 * CORREÇÃO: Removido o uso de onAfterPrint com setTimeout que matava o token
 * de gesto do usuário e impedia o WhatsApp de abrir no navegador.
 *
 * A função agora apenas renderiza o HTML e dispara window.print().
 * O WhatsApp deve ser aberto pelo chamador ANTES de chamar esta função,
 * usando um link <a target="_blank"> no JSX (não window.open).
 */
export function printThermalReceipt(
  order: PrintOrder,
  storeName: string,
  clientName: string
) {
  const date = new Date(order.created_at).toLocaleString("pt-BR");
  const orderId = order.id.slice(0, 8).toUpperCase();

  let itemsHtml = "";
  order.order_items?.forEach((item) => {
    const displayName = getOrderItemDisplayName(item);

    let rawAddons = item.addons as any;
    if (typeof rawAddons === "string") {
      try { rawAddons = JSON.parse(rawAddons); } catch { rawAddons = []; }
    }
    const addons = Array.isArray(rawAddons) ? rawAddons : [];
    const addonsTotal = addons.reduce((s: number, a: any) => s + (Number(a?.price) || 0), 0);
    const baseUnitPrice = item.unit_price - addonsTotal;
    const lineTotal = (baseUnitPrice * item.quantity).toFixed(2);
    itemsHtml += `<div class="tp-item-row"><span><b>${item.quantity}x</b> ${displayName}</span><span>R$ ${lineTotal}</span></div>`;

    if (addons.length > 0) {
      const requiredAddons = addons.filter((a: any) => a.required && a.groupName);
      const isBorder = (a: any) => typeof a?.name === "string" && /^borda\s*:/i.test(a.name);
      const isSize = (a: any) => typeof a?.name === "string" && /^tamanho\s*:/i.test(a.name);
      const isComplement = (a: any) => typeof a?.name === "string" && /^complemento\s*:/i.test(a.name);
      const sizeAddons = addons.filter((a: any) => !(a.required && a.groupName) && isSize(a));
      const borderAddons = addons.filter((a: any) => !(a.required && a.groupName) && isBorder(a));
      const complementAddons = addons.filter((a: any) => !(a.required && a.groupName) && isComplement(a));
      const optionalAddons = addons.filter((a: any) => !(a.required && a.groupName) && !isBorder(a) && !isSize(a) && !isComplement(a));

      requiredAddons.forEach((a: any) => {
        const priceStr = Number(a.price) > 0 ? formatBRL(Number(a.price)) : "";
        itemsHtml += `<div class="tp-required-addon" style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border:1px solid #000;padding:2px 4px;margin:3px 0;background:#eee"><span>★ ${a.groupName}: ${a.name.toUpperCase()}</span><span>${priceStr}</span></div>`;
      });

      sizeAddons.forEach((a: any) => {
        const sizeName = String(a.name).replace(/^tamanho\s*:\s*/i, "").toUpperCase();
        itemsHtml += `<div class="tp-size-addon" style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border:1px solid #000;padding:2px 4px;margin:3px 0;background:#eee"><span>▣ TAMANHO: ${sizeName}</span><span></span></div>`;
      });

      borderAddons.forEach((a: any) => {
        const priceStr = Number(a.price) > 0 ? formatBRL(Number(a.price)) : "";
        const borderName = String(a.name).replace(/^borda\s*:\s*/i, "").toUpperCase();
        itemsHtml += `<div class="tp-border-addon" style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border:1px solid #000;padding:2px 4px;margin:3px 0;background:#eee"><span>◆ BORDA: ${borderName}</span><span>${priceStr}</span></div>`;
      });

      complementAddons.forEach((a: any) => {
        const priceStr = Number(a.price) > 0 ? formatBRL(Number(a.price)) : "GRÁTIS";
        const cName = String(a.name).replace(/^complemento\s*:\s*/i, "").toUpperCase();
        itemsHtml += `<div class="tp-complement-addon" style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border:1px solid #000;padding:2px 4px;margin:3px 0;background:#eee"><span>✚ COMPLEMENTO: ${cName}</span><span>${priceStr}</span></div>`;
      });

      optionalAddons.forEach((a: any) => {
        const priceStr = Number(a.price) > 0 ? formatBRL(Number(a.price)) : "";
        itemsHtml += `<div class="tp-addon" style="display:flex;justify-content:space-between"><span>+ ${a.name}</span><span>${priceStr}</span></div>`;
      });
    }
    if (item.observations) {
      itemsHtml += `<div class="tp-obs">⚠ OBS: ${item.observations}</div>`;
    }
  });

  let changeHtml = "";
  if (order.payment_method === "dinheiro" && order.needs_change && Number(order.change_for) > 0) {
    changeHtml = `<div class="tp-change"><b>TROCO PARA: ${formatBRL(Number(order.change_for))}</b></div>`;
  }

  let scheduledHtml = "";
  if (order.scheduled_for) {
    const scheduledDate = new Date(order.scheduled_for);
    const scheduledStr = scheduledDate.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    scheduledHtml = `
<div class="tp-scheduled" style="border:3px solid #000;padding:8px;margin:8px 0;text-align:center;background:#000;color:#fff;font-size:16px;font-weight:bold;letter-spacing:1px">
  ⏰ PEDIDO AGENDADO ⏰<br/>
  <span style="font-size:18px">${scheduledStr}</span><br/>
  <span style="font-size:12px">⚠ NÃO PREPARAR AGORA ⚠</span>
</div>`;
  }

  const container = getOrCreatePrintContainer();
  container.innerHTML = `
<div class="tp-center"><div class="tp-title">ITASUPER</div><div class="tp-store">${storeName}</div><div class="tp-date">${date}</div></div>
<div class="tp-divider"></div>
<div class="tp-order-id">PEDIDO #${orderId}</div>
${scheduledHtml}
<div class="tp-divider"></div>
${itemsHtml}
<div class="tp-divider"></div>
<div class="tp-total-row"><span>Subtotal:</span><span>${formatBRL(Number(order.subtotal))}</span></div>
<div class="tp-total-row"><span>Entrega:</span><span>${formatBRL(Number(order.delivery_fee))}</span></div>
<div class="tp-total-big"><span>TOTAL:</span><span>${formatBRL(Number(order.total_price))}</span></div>
<div class="tp-divider"></div>
<div class="tp-info"><b>Pagamento:</b> ${paymentLabels[order.payment_method] || order.payment_method} ${order.payment_method === "pix" ? '<span style="font-weight:bold">(PAGO ONLINE)</span>' : '<span style="font-weight:bold">(RECEBER NA ENTREGA)</span>'}</div>
${changeHtml}
<div class="tp-info"><b>Cliente:</b> ${clientName}</div>
<div class="tp-info"><b>Bairro:</b> ${order.neighborhood}</div>
<div class="tp-info"><b>Endereço:</b> ${order.address_details}</div>
<div class="tp-divider"></div>
<div class="tp-footer"><p>Obrigado pela preferência!</p><p>ItaSuper</p></div>
<div class="tp-divider"></div>
<div style="text-align:center;font-size:9px;color:#666;line-height:1.4;padding:4px 0">
  <div>Serv. financeiros processados por</div>
  <div style="font-weight:bold">Asaas Gestão Financeira Inst. de Pagamento S.A.</div>
  <div>Autorizada pelo Banco Central do Brasil</div>
</div>
`;

  // requestAnimationFrame garante 1 frame de render do DOM antes de imprimir
  // sem usar setTimeout (que mataria o token de gesto do usuário e bloquearia o WhatsApp)
  requestAnimationFrame(() => {
    window.print();
  });
}

// ─── Labels de pagamento PDV ───────────────────────────────────────────────

const pdvPaymentLabels: Record<string, string> = {
  dinheiro:           "Dinheiro",
  maquininha_credito: "Cartão Crédito",
  maquininha_debito:  "Cartão Débito",
  maquininha_pix:     "PIX Maquininha",
  // compatibilidade com labels do delivery
  pix:    "PIX Online",
  cartao: "Cartão na Entrega",
};

// ─── Interface do recibo PDV ───────────────────────────────────────────────

interface PrintPdvOrder {
  id: string;
  created_at: string;
  subtotal: number;
  pdv_discount?: number | null;
  total_price: number;
  payment_method: string;
  cash_received?: number;
  troco?: number;
  table_identifier?: string | null;
  order_items?: {
    quantity: number;
    unit_price: number;
    products?: { name: string } | null;
    observations?: string | null;
    addons?: any;
  }[];
}

// ─── Função de impressão PDV ───────────────────────────────────────────────

export function printPdvReceipt(order: PrintPdvOrder, storeName: string) {
  const date = new Date(order.created_at).toLocaleString("pt-BR");
  const orderId = order.id.slice(0, 8).toUpperCase();
  const discount = Number(order.pdv_discount || 0);
  const payLabel = pdvPaymentLabels[order.payment_method] || order.payment_method;

  // Itens
  let itemsHtml = "";
  order.order_items?.forEach(item => {
    const name = getOrderItemDisplayName(item as any);
    let rawAddons = (item as any).addons;
    if (typeof rawAddons === "string") {
      try { rawAddons = JSON.parse(rawAddons); } catch { rawAddons = []; }
    }
    const addons = Array.isArray(rawAddons) ? rawAddons : [];
    const addonsTotal = addons.reduce((s: number, a: any) => s + (Number(a?.price) || 0), 0);
    const baseUnitPrice = Number(item.unit_price) - addonsTotal;
    const unitPrice = formatBRL(baseUnitPrice);
    const totalItem = formatBRL(baseUnitPrice * item.quantity);
    itemsHtml += `
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px">
        <span><b>${item.quantity}x</b> ${name}</span>
        <span>${totalItem}</span>
      </div>`;
    if (baseUnitPrice > 0) {
      itemsHtml += `<div style="font-size:11px;color:#555;padding-left:16px">Unitário: ${unitPrice}</div>`;
    }
    if (addons.length > 0) {
      const isBorder = (a: any) => typeof a?.name === "string" && /^borda\s*:/i.test(a.name);
      const isSize = (a: any) => typeof a?.name === "string" && /^tamanho\s*:/i.test(a.name);
      const isComplement = (a: any) => typeof a?.name === "string" && /^complemento\s*:/i.test(a.name);
      addons.forEach((a: any) => {
        const priceStr = Number(a.price) > 0 ? formatBRL(Number(a.price)) : "";
        if (a.required && a.groupName) {
          itemsHtml += `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:12px;border:1px solid #000;padding:2px 4px;margin:3px 0;background:#eee"><span>★ ${a.groupName}: ${String(a.name).toUpperCase()}</span><span>${priceStr}</span></div>`;
        } else if (isSize(a)) {
          const sizeName = String(a.name).replace(/^tamanho\s*:\s*/i, "").toUpperCase();
          itemsHtml += `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:12px;border:1px solid #000;padding:2px 4px;margin:3px 0;background:#eee"><span>▣ TAMANHO: ${sizeName}</span><span></span></div>`;
        } else if (isBorder(a)) {
          const borderName = String(a.name).replace(/^borda\s*:\s*/i, "").toUpperCase();
          itemsHtml += `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:12px;border:1px solid #000;padding:2px 4px;margin:3px 0;background:#eee"><span>◆ BORDA: ${borderName}</span><span>${priceStr}</span></div>`;
        } else if (isComplement(a)) {
          const cName = String(a.name).replace(/^complemento\s*:\s*/i, "").toUpperCase();
          const cPrice = Number(a.price) > 0 ? formatBRL(Number(a.price)) : "GRÁTIS";
          itemsHtml += `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:12px;border:1px solid #000;padding:2px 4px;margin:3px 0;background:#eee"><span>✚ COMPLEMENTO: ${cName}</span><span>${cPrice}</span></div>`;
        } else {
          itemsHtml += `<div style="display:flex;justify-content:space-between;font-size:11px;padding-left:12px"><span>+ ${a.name}</span><span>${priceStr}</span></div>`;
        }
      });
    }
    if (item.observations) {
      itemsHtml += `<div style="font-size:11px;font-style:italic;padding-left:16px">Obs: ${item.observations}</div>`;
    }
  });

  // Mesa/comanda
  const tableHtml = order.table_identifier
    ? `<div style="font-size:14px;font-weight:bold;text-align:center;border:2px solid #000;padding:4px;margin:4px 0">${order.table_identifier}</div>`
    : "";

  // Desconto
  const discountHtml = discount > 0
    ? `<div style="display:flex;justify-content:space-between;font-size:13px"><span>Desconto:</span><span>-${formatBRL(discount)}</span></div>`
    : "";

  // Troco
  let trocoHtml = "";
  if (order.payment_method === "dinheiro" && order.cash_received) {
    trocoHtml = `
      <div style="display:flex;justify-content:space-between;font-size:13px"><span>Recebido:</span><span>${formatBRL(order.cash_received)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold"><span>Troco:</span><span>${formatBRL(order.troco ?? 0)}</span></div>`;
  }

  const container = getOrCreatePrintContainer();
  container.innerHTML = `
<div class="tp-center">
  <div class="tp-title">ITASUPER</div>
  <div class="tp-store">${storeName}</div>
  <div class="tp-date">${date}</div>
</div>
<div class="tp-divider"></div>
<div class="tp-order-id">VENDA PDV #${orderId}</div>
${tableHtml}
<div class="tp-divider"></div>
${itemsHtml}
<div class="tp-divider"></div>
${discountHtml}
<div class="tp-total-row"><span>Subtotal:</span><span>${formatBRL(Number(order.subtotal))}</span></div>
<div class="tp-total-big"><span>TOTAL:</span><span>${formatBRL(Number(order.total_price))}</span></div>
<div class="tp-divider"></div>
<div class="tp-info"><b>Pagamento:</b> ${payLabel}</div>
${trocoHtml}
<div class="tp-divider"></div>
<div class="tp-footer"><p>Obrigado pela preferência!</p><p>ItaSuper</p></div>
<div class="tp-divider"></div>
<div style="text-align:center;font-size:9px;color:#666;line-height:1.4;padding:4px 0">
  <div>Serv. financeiros processados por</div>
  <div style="font-weight:bold">Asaas Gestão Financeira Inst. de Pagamento S.A.</div>
  <div>Autorizada pelo Banco Central do Brasil</div>
</div>
`;

  requestAnimationFrame(() => {
    window.print();
  });
}
