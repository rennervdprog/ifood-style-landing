/**
 * Rótulos de forma de pagamento do Financeiro (/admin-teste).
 *
 * Tradução fechada — qualquer outro valor passa cru, nunca se inventa
 * tradução. Compartilhado pelo Extrato e pela Tendência para os dois
 * blocos mostrarem sempre o mesmo rótulo.
 */
export function paymentLabelTeste(method: string): string {
  if (method === "pix") return "Pix";
  if (method === "cartao") return "Cartão";
  if (method === "dinheiro" || method === "cash") return "Dinheiro";
  if (method === "maquininha_pix") return "PIX na maquininha";
  if (method === "maquininha_credito") return "Cartão na maquininha";
  if (method === "maquininha_debito") return "Cartão na maquininha";
  return method || "—";
}
