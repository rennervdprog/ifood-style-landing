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
    itemsHtml += `<div class="item-row"><span><b>${item.quantity}x</b> ${item.products?.name || "Item"}</span><span>R$ ${lineTotal}</span></div>`;
    if (item.addons && Array.isArray(item.addons) && item.addons.length > 0) {
      item.addons.forEach((a: any) => {
        itemsHtml += `<div class="addon">- ${a.name}${Number(a.price) > 0 ? ` (+R$ ${Number(a.price).toFixed(2)})` : ""}</div>`;
      });
    }
    if (item.observations) {
      itemsHtml += `<div class="obs">⚠ OBS: ${item.observations}</div>`;
    }
  });

  let changeHtml = "";
  if (order.payment_method === "dinheiro" && order.needs_change && Number(order.change_for) > 0) {
    changeHtml = `<div class="change"><b>TROCO PARA: R$ ${Number(order.change_for).toFixed(2)}</b></div>`;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Comanda</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    color: #000;
    background: #fff;
    width: 80mm;
    max-width: 80mm;
    padding: 3mm;
  }
  .center { text-align: center; }
  .title { font-size: 14px; font-weight: 900; }
  .store { font-size: 13px; font-weight: 700; margin: 2px 0; }
  .date { font-size: 10px; }
  .divider { border-top: 1px dashed #000; margin: 5px 0; }
  .order-id { font-size: 20px; font-weight: 900; text-align: center; margin: 4px 0; letter-spacing: 2px; }
  .item-row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 12px; }
  .addon { padding-left: 14px; font-size: 11px; margin: 1px 0; }
  .obs { padding-left: 14px; font-size: 11px; font-style: italic; font-weight: 700; margin: 2px 0; }
  .total-row { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
  .total-big { display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; margin-top: 4px; }
  .info { font-size: 11px; margin: 2px 0; }
  .change { font-size: 12px; margin: 3px 0; }
  .footer { text-align: center; font-size: 10px; margin-top: 6px; }
</style></head><body>
<div class="center"><div class="title">GIRO DE ITATINGA</div><div class="store">${storeName}</div><div class="date">${date}</div></div>
<div class="divider"></div>
<div class="order-id">PEDIDO #${orderId}</div>
<div class="divider"></div>
${itemsHtml}
<div class="divider"></div>
<div class="total-row"><span>Subtotal:</span><span>R$ ${Number(order.subtotal).toFixed(2)}</span></div>
<div class="total-row"><span>Entrega:</span><span>R$ ${Number(order.delivery_fee).toFixed(2)}</span></div>
<div class="total-big"><span>TOTAL:</span><span>R$ ${Number(order.total_price).toFixed(2)}</span></div>
<div class="divider"></div>
<div class="info"><b>Pagamento:</b> ${paymentLabels[order.payment_method] || order.payment_method}</div>
${changeHtml}
<div class="info"><b>Cliente:</b> ${clientName}</div>
<div class="info"><b>Bairro:</b> ${order.neighborhood}</div>
<div class="info"><b>Endereço:</b> ${order.address_details}</div>
<div class="divider"></div>
<div class="footer"><p>Obrigado pela preferência!</p><p>Giro de Itatinga</p></div>
<div style="height:12px"></div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:0;height:0;border:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Cleanup after print
  setTimeout(() => {
    try { document.body.removeChild(iframe); } catch {}
  }, 5000);
}
