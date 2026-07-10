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
      "{clientName}, o pedido Nº *{orderId}* está em produção.\n\nPedido *nº {orderId}*\n\n*Itens:*\n{items}\n\n📱 *{payment}*\n\n🛵 *{deliveryType}* (taxa de: *{deliveryFee}*)\n🏠 {address}, {neighborhood}\n(Previsão de Entrega: {eta})\n\nTotal: *{total}*\n\nObrigado pela preferência, se precisar de algo é só chamar! 😉\n\n🔑 *PIN de Segurança: {pin}*",
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
  { key: "{payment}", desc: "Forma de pagamento (PIX, Cartão, Dinheiro)" },
  { key: "{deliveryType}", desc: "Delivery ou Retirada" },
  { key: "{deliveryFee}", desc: "Taxa de entrega" },
  { key: "{neighborhood}", desc: "Bairro" },
  { key: "{eta}", desc: "Previsão de entrega (janela HH:MM)" },
];

export const SAMPLE_DATA: Record<string, string> = {
  storeName: "Cantinho da Silvia",
  clientName: "Ana",
  orderId: "2475",
  total: "R$ 45,90",
  pin: "0605",
  address: "Prefeito Benedito Antunes de Toledo, Nº 801 - Casa",
  neighborhood: "Vila União, Itatinga",
  items:
    "➡ ```1x Suco de Laranja Natural 300ml```\n➡ ```1x O Favorito```\n➡ ```1x Trufas Gourmet Sabores Especiais```\n      _Selecione_\n          ```1x Trufa de Nutella com Ninho e Mor```",
  payment: "PIX",
  deliveryType: "Delivery",
  deliveryFee: "R$ 4,00",
  eta: "entre 18:40 e 18:55",
};

export const fillTemplate = (tpl: string, data: Record<string, string> = SAMPLE_DATA) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => data[k] ?? `{${k}}`);