import { formatBRL } from "@/lib/utils";
/**
 * Dual notification system: WhatsApp + Push + Z-API for order status changes.
 * Used by AdminDashboard (lojista) when updating order statuses.
 *
 * CORREÇÃO: Removida a chamada direta a openWhatsApp() desta função.
 * O WhatsApp para "preparando" agora é aberto via link <a> no JSX do
 * AdminDashboard, garantindo que o token de gesto do usuário seja preservado
 * e o popup blocker do navegador não interfira.
 */
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
  deliveryPin?: string;
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
      `Pedido: #${p.orderId.slice(0, 8).toUpperCase()}` +
      `${p.deliveryPin ? `\n🔑 *PIN de Segurança: ${p.deliveryPin}*` : ""}`,
  },
   pronto_para_entrega: {
     pushTitle: "📦 Pedido pronto!",
     pushBody: (p) => `Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} está pronto e já está em rota de entrega!`,
     whatsApp: (p) =>
       `📦 Olá ${p.clientName}! Seu pedido da *${p.storeName}* está *PRONTO*! 🎉\n\n` +
       `E Já esta em Rota De Entrega!!!` +
       (p.deliveryPin
         ? `\n\n🔑 *CÓDIGO DE ENTREGA: ${p.deliveryPin}*\nGuarde este código! Informe ao motoboy *somente* quando ele chegar com seu pedido.\n\n⚠️ Não compartilhe antes da entrega.`
         : ""),
   },
  saiu_entrega: {
    pushTitle: "🛵 Saiu para entrega!",
    pushBody: (p) => `Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} saiu para entrega!`,
    whatsApp: (p) =>
      `🛵 *${p.storeName}* informa: Seu pedido #${p.orderId.slice(0, 8).toUpperCase()} saiu para entrega! 🚀\n` +
      `${p.addressDetails ? `Endereço: ${p.addressDetails}` : ""}` +
      `${p.deliveryPin ? `\n\n🔑 *PIN de Segurança: ${p.deliveryPin}*` : ""}`,
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

/**
 * Retorna a mensagem WhatsApp formatada para um determinado status.
 * Usada pelo AdminDashboard para montar o href do link <a> antes de aceitar o pedido.
 */
export const buildWhatsAppMessage = (status: string, params: OrderNotifyParams): string => {
  return STATUS_MESSAGES[status]?.whatsApp(params) ?? "";
};

/**
 * Substitui placeholders em templates customizados do lojista.
 * Placeholders suportados: {storeName}, {clientName}, {orderId}, {total}, {pin}, {address}, {items}
 */
const applyTemplate = (tpl: string, p: OrderNotifyParams): string => {
  return tpl
    .replace(/\{storeName\}/g, p.storeName || "")
    .replace(/\{clientName\}/g, p.clientName || "")
    .replace(/\{orderId\}/g, p.orderId.slice(0, 8).toUpperCase())
    .replace(/\{total\}/g, formatBRL(p.totalPrice))
    .replace(/\{pin\}/g, p.deliveryPin || "")
    .replace(/\{address\}/g, p.addressDetails || "")
    .replace(/\{items\}/g, p.items || "");
};

/**
 * Busca templates customizados do lojista (se houver) e devolve a mensagem final.
 */
const fetchCustomTemplate = async (storeId: string, status: string): Promise<string | null> => {
  try {
    const { data } = await (supabase as any)
      .from("store_whatsapp_config")
      .select("message_templates")
      .eq("store_id", storeId)
      .maybeSingle();
    const tpl = data?.message_templates?.[status];
    return typeof tpl === "string" && tpl.trim().length > 0 ? tpl : null;
  } catch {
    return null;
  }
};

/**
 * Envia mensagem WhatsApp via Evolution API (substitui o Z-API)
 */
const sendEvolutionMessage = async (storeId: string, phone: string, message: string) => {
  try {
    const { data, error } = await supabase.functions.invoke("evolution-send-message", {
      body: { store_id: storeId, phone, message, kind: "order_status" },
    });
    if (error) console.error("[Evolution] send error:", error);
    return data;
  } catch (e) {
    console.error("[Evolution] invoke error:", e);
  }
};

/**
 * Envia Push + Evolution API WhatsApp para mudanças de status de pedido.
 */
export const notifyOrderStatusChange = (
  newStatus: string,
  params: OrderNotifyParams,
  options?: { skipWhatsApp?: boolean; evolutionEnabled?: boolean; zapiEnabled?: boolean }
) => {
  const config = STATUS_MESSAGES[newStatus];
  if (!config) return;

  // Push notification (sempre)
  sendPushNotification(
    [params.clientId],
    config.pushTitle,
    config.pushBody(params),
    { link: "/pedidos", order_id: params.orderId }
  ).catch(console.error);

  // Evolution API WhatsApp.
  // Sempre tentamos enviar pelo backend; o edge function (evolution-send-message)
  // já valida se a loja tem Evolution conectado e retorna erro silencioso caso
  // contrário. Isso evita o bug em que o flag `evolutionConnected` do cliente
  // estava desatualizado (ex.: keepalive marcou "disconnected" por 1 ping) e
  // bloqueava o envio mesmo com o WhatsApp ativo.
  const whatsappEnabled = !options?.skipWhatsApp;
  if (whatsappEnabled && params.clientPhone && params.storeId) {
    // tenta usar template customizado do lojista; se não houver, usa o padrão
    (async () => {
      const customTpl = params.storeId
        ? await fetchCustomTemplate(params.storeId, newStatus)
        : null;
      const msg = customTpl ? applyTemplate(customTpl, params) : config.whatsApp(params);
      sendEvolutionMessage(params.storeId, params.clientPhone, msg);
    })();
  }
};
