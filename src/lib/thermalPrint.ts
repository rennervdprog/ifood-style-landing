interface PrintOrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  observations?: string | null;
  addons?: { name: string; price: number }[] | null;
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

export function printThermalReceipt(
  order: PrintOrder,
  storeName: string,
  clientName: string
) {
  const date = new Date(order.created_at).toLocaleString("pt-BR");
  const orderId = order.id.slice(0, 8).toUpperCase();

  let itemsHtml = "";
  order.order_items?.forEach((item) => {
    const lineTotal = (item.unit_price * item.quantity).toFixed(2);
    itemsHtml += `<div class="tp-item-row"><span><b>${item.quantity}x</b> ${item.products?.name || "Item"}</span><span>R$ ${lineTotal}</span></div>`;
    if (item.addons && Array.isArray(item.addons) && item.addons.length > 0) {
      item.addons.forEach((a: any) => {
        itemsHtml += `<div class="tp-addon">- ${a.name}${Number(a.price) > 0 ? ` (+R$ ${Number(a.price).toFixed(2)})` : ""}</div>`;
      });
    }
    if (item.observations) {
      itemsHtml += `<div class="tp-obs">⚠ OBS: ${item.observations}</div>`;
    }
  });

  let changeHtml = "";
  if (order.payment_method === "dinheiro" && order.needs_change && Number(order.change_for) > 0) {
    changeHtml = `<div class="tp-change"><b>TROCO PARA: R$ ${Number(order.change_for).toFixed(2)}</b></div>`;
  }

  const container = getOrCreatePrintContainer();
  container.innerHTML = `
<div class="tp-center"><div class="tp-title">ITAFOOD</div><div class="tp-store">${storeName}</div><div class="tp-date">${date}</div></div>
<div class="tp-divider"></div>
<div class="tp-order-id">PEDIDO #${orderId}</div>
<div class="tp-divider"></div>
${itemsHtml}
<div class="tp-divider"></div>
<div class="tp-total-row"><span>Subtotal:</span><span>R$ ${Number(order.subtotal).toFixed(2)}</span></div>
<div class="tp-total-row"><span>Entrega:</span><span>R$ ${Number(order.delivery_fee).toFixed(2)}</span></div>
<div class="tp-total-big"><span>TOTAL:</span><span>R$ ${Number(order.total_price).toFixed(2)}</span></div>
<div class="tp-divider"></div>
<div class="tp-info"><b>Pagamento:</b> ${paymentLabels[order.payment_method] || order.payment_method}</div>
${changeHtml}
<div class="tp-info"><b>Cliente:</b> ${clientName}</div>
<div class="tp-info"><b>Bairro:</b> ${order.neighborhood}</div>
<div class="tp-info"><b>Endereço:</b> ${order.address_details}</div>
<div class="tp-divider"></div>
<div class="tp-footer"><p>Obrigado pela preferência!</p><p>ItaFood</p></div>
`;

  // Give DOM time to render, then print
  setTimeout(() => {
    window.print();
  }, 500);
}
