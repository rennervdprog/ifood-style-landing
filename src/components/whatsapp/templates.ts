/**
 * Templates padrão de mensagens WhatsApp por status do pedido.
 * Espelha as mensagens usadas pelo orderNotifications.ts.
 */
export type TemplateKey =
  | "preparando"
  | "pronto_para_entrega"
  | "saiu_entrega"
  | "entregue"
  | "cancelado";

export interface TemplateInfo {
  label: string;
  emoji: string;
  template: string;
  shortDesc: string;
}

export const DEFAULT_TEMPLATES: Record<TemplateKey, TemplateInfo> = {
  preparando: {
    label: "Pedido aceito",
    shortDesc: "Disparada quando o lojista aceita o pedido",
    emoji: "✅",
    template:
      "✅ *{storeName}* informa: Seu pedido foi aceito! 🍔\n\n{items}\n\n💰 Total: {total}\nPedido: #{orderId}\n🔑 *PIN de Segurança: {pin}*",
  },
  pronto_para_entrega: {
    label: "Pronto para entrega",
    shortDesc: "Pedido finalizado, aguardando motoboy",
    emoji: "📦",
    template:
      "📦 Olá {clientName}! Seu pedido da *{storeName}* está *PRONTO*! 🎉\n\nO motoboy logo irá sair para entrega. 🛵\n\n🔑 *CÓDIGO DE ENTREGA: {pin}*\nInforme ao motoboy somente na entrega.",
  },
  saiu_entrega: {
    label: "Saiu para entrega",
    shortDesc: "Motoboy a caminho do cliente",
    emoji: "🛵",
    template:
      "🛵 *{storeName}* informa: Seu pedido #{orderId} saiu para entrega! 🚀\nEndereço: {address}\n\n🔑 *PIN: {pin}*",
  },
  entregue: {
    label: "Entregue",
    shortDesc: "Confirmação ao cliente após entrega",
    emoji: "🍽️",
    template:
      "✅ *{storeName}* informa: Seu pedido #{orderId} foi entregue! Bom apetite! 🍽️",
  },
  cancelado: {
    label: "Cancelado",
    shortDesc: "Aviso quando o pedido é cancelado",
    emoji: "❌",
    template:
      "❌ *{storeName}* informa: Seu pedido #{orderId} foi cancelado.\n\nDesculpe o transtorno! 🙏",
  },
};

export const TEMPLATE_VARIABLES: { key: string; desc: string }[] = [
  { key: "{storeName}", desc: "Nome da loja" },
  { key: "{clientName}", desc: "Nome do cliente" },
  { key: "{orderId}", desc: "Número do pedido" },
  { key: "{total}", desc: "Valor total" },
  { key: "{pin}", desc: "PIN de entrega" },
  { key: "{address}", desc: "Endereço de entrega" },
  { key: "{items}", desc: "Lista de itens" },
];

export const SAMPLE_DATA: Record<string, string> = {
  storeName: "Cantinho da Silvia",
  clientName: "Ana",
  orderId: "235894",
  total: "R$ 45,90",
  pin: "0605",
  address: "Rua das Flores, 123 — Centro",
  items: "• 1x Pastel de Carne\n• 1x Caldo de Cana 500ml",
};

export const fillTemplate = (tpl: string, data: Record<string, string> = SAMPLE_DATA) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => data[k] ?? `{${k}}`);