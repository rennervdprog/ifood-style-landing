/**
 * Rótulos pt-BR únicos para valores crus guardados no banco
 * (orders.payment_method e orders.order_source).
 * Levantamento dos valores reais em produção (2026-10-29):
 * payment_method: card, cartao, cartao_credito, cash, dinheiro,
 *                 maquininha_credito, maquininha_debito, maquininha_pix,
 *                 pix, pix_direto, pix_machine
 * order_source:   delivery, manual, pdv, whatsapp_bot
 */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  pix_direto: "PIX Direto",
  pix_online: "PIX Online",
  pix_machine: "PIX na maquininha",
  maquininha_pix: "PIX na maquininha",
  dinheiro: "Dinheiro",
  cash: "Dinheiro",
  cartao: "Cartão",
  card: "Cartão",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
  cartao_maquineta: "Cartão na maquininha",
  maquininha_credito: "Crédito na maquininha",
  maquininha_debito: "Débito na maquininha",
  online: "Online",
  outros: "Outros",
};

export const ORDER_SOURCE_LABELS: Record<string, string> = {
  delivery: "Delivery",
  pdv: "PDV",
  manual: "Manual",
  balcao: "Balcão",
  whatsapp_bot: "WhatsApp",
};

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  return PAYMENT_METHOD_LABELS[method] || method;
}

export function orderSourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  return ORDER_SOURCE_LABELS[source] || source;
}
