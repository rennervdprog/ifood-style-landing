/**
 * Dual notification system: WhatsApp + Push for order status changes.
 * Used by AdminDashboard (lojista) when updating order statuses.
 */
import { openWhatsApp } from "@/lib/whatsapp";
import { sendPushNotification } from "@/lib/firebase";

interface OrderNotifyParams {
  orderId: string;
  storeName: string;
  clientId: string;
  clientPhone: string;
  clientName: string;
  totalPrice: number;
  addressDetails?: string;
  items?: string;
  paymentMethod?: string;
}

const STATUS_MESSAGES: Record<string, {
  pushTitle: string;
  pushBody: (p: OrderNotifyParams) => string;
  whatsApp: (p: OrderNotifyParams) => string;
}> = {
  preparando: {
    pushTitle: "👨‍🍳 Pedido aceito!",
    pushBody: (p) => `Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} no ${p.storeName} está sendo preparado!`,
    whatsApp: (p) =>
      `✅ *${p.storeName}* informa: Seu pedido foi aceito! 🍔\n\n` +
      `${p.items ? p.items + "\n\n" : ""}` +
      `💰 Total: R$ ${p.totalPrice.toFixed(2)}\n` +
      `Pedido: #${p.orderId.slice(0, 8).toUpperCase()}`,
  },
  pronto_para_entrega: {
    pushTitle: "📦 Pedido pronto!",
    pushBody: (p) => `Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} está pronto e aguardando entregador.`,
    whatsApp: (p) =>
      `📦 *${p.storeName}* informa: Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} está pronto! 🎉\n\n` +
      `Aguardando entregador retirar na loja.`,
  },
  saiu_entrega: {
    pushTitle: "🛵 Saiu para entrega!",
    pushBody: (p) => `Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} saiu para entrega!`,
    whatsApp: (p) =>
      `🛵 *${p.storeName}* informa: Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} saiu para entrega! 🚀\n` +
      `${p.addressDetails ? `Endereço: ${p.addressDetails}` : ""}`,
  },
  em_transito: {
    pushTitle: "🛵 Entregador a caminho!",
    pushBody: (p) => `Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} está a caminho!`,
    whatsApp: (p) =>
      `🛵 *${p.storeName}* informa: O entregador está a caminho com seu pedido #${p.orderId.slice(0, 8).toUpperCase()}! 🚀`,
  },
  entregue: {
    pushTitle: "✅ Pedido entregue!",
    pushBody: (p) => `Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} foi entregue. Bom apetite!`,
    whatsApp: (p) =>
      `✅ *${p.storeName}* informa: Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} foi entregue! Bom apetite! 🍽️`,
  },
  finalizado: {
    pushTitle: "✅ Pedido finalizado!",
    pushBody: (p) => `Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} foi entregue. Bom apetite!`,
    whatsApp: (p) =>
      `✅ *${p.storeName}* informa: Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} foi finalizado! Obrigado pela preferência! 🍽️`,
  },
  cancelado: {
    pushTitle: "❌ Pedido cancelado",
    pushBody: (p) => `Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} foi cancelado.${p.paymentMethod === "pix" ? " O reembolso será processado." : ""}`,
    whatsApp: (p) =>
      p.paymentMethod === "pix"
        ? `❌ *${p.storeName}* informa: Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} foi cancelado.\n\n💰 O reembolso de R$ ${p.totalPrice.toFixed(2)} via PIX será processado em breve.\n\nDesculpe o transtorno! 🙏`
        : `❌ *${p.storeName}* informa: Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} foi cancelado.\n\nDesculpe o transtorno! 🙏`,
  },
};

/**
 * Send both Push notification AND open WhatsApp for an order status change.
 * WhatsApp only opens if clientPhone is available.
 * Push is always sent.
 */
export const notifyOrderStatusChange = (
  newStatus: string,
  params: OrderNotifyParams,
  options?: { skipWhatsApp?: boolean; delayWhatsApp?: number }
) => {
  const config = STATUS_MESSAGES[newStatus];
  if (!config) return;

  // Push notification (always)
  sendPushNotification(
    [params.clientId],
    config.pushTitle,
    config.pushBody(params),
    { link: "/pedidos", order_id: params.orderId }
  ).catch(console.error);

  // WhatsApp (if phone available and not skipped)
  if (params.clientPhone && !options?.skipWhatsApp) {
    const msg = config.whatsApp(params);
    const delay = options?.delayWhatsApp ?? 600;
    setTimeout(() => openWhatsApp(params.clientPhone, msg), delay);
  }
};
