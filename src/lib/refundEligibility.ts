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

/** A interface somente exibe o caso de devolução para PIX Direto. O banco é a autoridade final. */
export const isPixDiretoPayment = (paymentMethod?: string | null) => paymentMethod === "pix_direto";

export const canOpenPixDiretoRefundCase = (paymentMethod?: string | null, status?: string | null) =>
  isPixDiretoPayment(paymentMethod) && ["entregue", "finalizado"].includes((status || "").toLowerCase());

export const physicalPaymentExplanation =
  "Cartão, dinheiro e pagamentos em maquininha são presenciais e não possuem reembolso financeiro processado pela plataforma.";
