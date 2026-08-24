export const PHYSICAL_PAYMENT_METHODS = new Set([
  "dinheiro",
  "cartao",
  "cartao_credito",
  "cartao_debito",
  "pix_machine",
  "maquininha_credito",
  "maquininha_debito",
  "maquininha_pix",
  "cash",
]);

export const REFUND_WINDOW_EXPIRED_MESSAGE =
  "O prazo de 24 horas após a conclusão do pedido para solicitar reembolso expirou.";

/** A interface somente exibe o caso de devolução para PIX Direto. O banco é a autoridade final. */
export const isPixDiretoPayment = (paymentMethod?: string | null) => paymentMethod === "pix_direto";

export const isRefundWindowOpen = (refundRequestExpiresAt?: string | null, nowMs = Date.now()) => {
  if (!refundRequestExpiresAt) return false;
  const expiresAtMs = Date.parse(refundRequestExpiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
};

export const canOpenPixDiretoRefundCase = (
  paymentMethod?: string | null,
  status?: string | null,
  refundRequestExpiresAt?: string | null,
  nowMs = Date.now(),
) =>
  isPixDiretoPayment(paymentMethod) &&
  ["entregue", "finalizado"].includes((status || "").toLowerCase()) &&
  isRefundWindowOpen(refundRequestExpiresAt, nowMs);

export const physicalPaymentExplanation =
  "Cartão, dinheiro e pagamentos em maquininha são presenciais e não possuem reembolso financeiro processado pela plataforma.";
