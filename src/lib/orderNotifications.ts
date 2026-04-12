import { formatBRL } from "@/lib/utils";
/**
 * Dual notification system: WhatsApp + Push + Z-API for order status changes.
 * Used by AdminDashboard (lojista) when updating order statuses.
 */
import { openWhatsApp } from "@/lib/whatsapp";
import { sendPushNotification } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";

interface OrderNotifyParams {
  orderId: string;
  storeName: string;
  storeId: string;
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
      `💰 Total: ${formatBRL(p.totalPrice)}\n` +
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
        ? `❌ *${p.storeName}* informa: Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} foi cancelado.\n\n💰 O reembolso de ${formatBRL(p.totalPrice)} via PIX será processado em breve.\n\nDesculpe o transtorno! 🙏`
        : `❌ *${p.storeName}* informa: Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} foi cancelado.\n\nDesculpe o transtorno! 🙏`,
  },
};

/** Statuses that should open WhatsApp (manual send by lojista) */
const WHATSAPP_STATUSES = new Set(["preparando", "saiu_entrega"]);

/** Statuses that trigger Z-API automatic messages */
const ZAPI_STATUSES = new Set(["preparando", "pronto_para_entrega", "saiu_entrega", "em_transito", "entregue", "finalizado", "cancelado"]);

/**
 * Send Z-API WhatsApp message via edge function
 */
const sendZapiMessage = async (storeId: string, phone: string, message: string) => {
  try {
    const { data, error } = await supabase.functions.invoke("zapi-send-message", {
      body: { store_id: storeId, phone, message },
    });
    if (error) {
      console.error("Z-API send error:", error);
    }
    return data;
  } catch (e) {
    console.error("Z-API invoke error:", e);
  }
};

/**
 * Send Push notification for ALL status changes.
 * Send Z-API message if configured.
 * Open WhatsApp ONLY for "preparando" and "saiu_entrega" (if Z-API not active).
 */
export const notifyOrderStatusChange = (
  newStatus: string,
  params: OrderNotifyParams,
  options?: { skipWhatsApp?: boolean; delayWhatsApp?: number; zapiEnabled?: boolean }
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

  // Z-API automatic WhatsApp (if enabled and phone available)
  if (options?.zapiEnabled && params.clientPhone && ZAPI_STATUSES.has(newStatus)) {
    const msg = config.whatsApp(params);
    sendZapiMessage(params.storeId, params.clientPhone, msg);
  }

  // Manual WhatsApp only if Z-API is NOT enabled
  if (
    !options?.zapiEnabled &&
    params.clientPhone &&
    !options?.skipWhatsApp &&
    WHATSAPP_STATUSES.has(newStatus)
  ) {
    const msg = config.whatsApp(params);
    const delay = options?.delayWhatsApp ?? 600;
    setTimeout(() => openWhatsApp(params.clientPhone, msg), delay);
  }
};
