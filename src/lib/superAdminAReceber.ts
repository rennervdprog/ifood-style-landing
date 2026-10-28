// Helpers puros do A Receber redesenhado (Fase 5, super-admin-teste).
//
// O A Receber soma os 4 tipos de dívida no total (R$ 64,60 em 27/10/2026)
// — diferente do Consolidado, que soma só comissão + taxa de entrega e
// mostra o PDV separado. É o cálculo de hoje, mantido por decisão do
// Renner (protótipo aprovado "como está", 28/10 ~06:33).
//
// Duas correções de rótulo/contagem vivem aqui (só no Teste):
// - a taxa de entrega é R$ 0,99 — a tela original escreve "R$2/entrega"
//   no herói e na mensagem do WhatsApp (erro pré-existente; o original
//   mantém o rótulo errado até o Teste virar a tela oficial);
// - a contagem de entregas só existe quando o saldo é múltiplo exato
//   de R$ 0,99 (ver exactDeliveryCount em superAdminConsolidado.ts).

import { brl } from "@/components/finance/financeExport";
import { exactDeliveryCount } from "@/lib/superAdminConsolidado";

export type ReceivableKind = "mensalidade" | "comissao" | "entrega_fee" | "pdv_fee";

/** Rótulo correto da taxa de entrega (a original escreve "R$2/entrega"). */
export const DELIVERY_FEE_LABEL = "R$ 0,99/entrega";

export const KIND_LABEL: Record<ReceivableKind, string> = {
  mensalidade: "Mensalidade",
  comissao: "Comissão",
  entrega_fee: "Taxa de entrega",
  pdv_fee: "PDV",
};

/** Artigo para a frase de confirmação: "da taxa de entrega", "do PDV". */
const KIND_ARTICLE: Record<ReceivableKind, string> = {
  mensalidade: "da mensalidade",
  comissao: "da comissão",
  entrega_fee: "da taxa de entrega",
  pdv_fee: "do PDV",
};

export interface StoreReceivable {
  store_id: string;
  name: string;
  plan_type: string;
  phone?: string | null;
  mensalidade: number;
  mensalidade_overdue_days: number;
  comissao: number;
  entrega_fee: number;
  pdv_fee: number;
  total: number;
}

/**
 * Texto da confirmação antes da baixa manual ("Pago") — decisão do
 * Renner (28/10 ~06:33). Um toque sem confirmação zerava a dívida
 * inteira do tipo; agora o diálogo mostra loja, tipo e valor.
 */
export function buildMarkPaidConfirm(
  row: StoreReceivable,
  kind: ReceivableKind,
  amount: number
): { title: string; description: string } {
  return {
    title: "Dar baixa como pago?",
    description: `Dar baixa de ${brl(amount)} ${KIND_ARTICLE[kind]} da ${row.name}? O valor inteiro desse tipo será zerado e registrado no histórico de repasses.`,
  };
}

/**
 * Origem legível de um tipo de dívida, para a linha do cartão da loja.
 * Taxa de entrega: "30 entregas a R$ 0,99" quando o saldo é múltiplo
 * exato; "Saldo acumulado da taxa" quando é residual (a contagem não
 * pode ser derivada — ex.: Pastelão, R$ 6,00).
 */
export function receivableKindOrigin(row: StoreReceivable, kind: ReceivableKind): string {
  switch (kind) {
    case "entrega_fee": {
      const n = exactDeliveryCount(row.entrega_fee);
      return n !== null
        ? `${n} ${n === 1 ? "entrega" : "entregas"} a R$ 0,99`
        : "Saldo acumulado da taxa";
    }
    case "mensalidade":
      return row.mensalidade_overdue_days > 0
        ? `Vencida há ${row.mensalidade_overdue_days}d`
        : "Mensalidade do plano";
    case "comissao":
      return "% sobre vendas físicas (dinheiro/cartão)";
    case "pdv_fee":
      return "Acumulado das vendas de balcão";
  }
}

/**
 * Mensagem pronta da cobrança via WhatsApp — o MESMO texto de hoje,
 * com UMA correção: "Taxa R$ 0,99/entrega" (a original diz "R$2").
 */
export function buildWhatsAppMessage(row: StoreReceivable): string {
  const parts: string[] = [];
  if (row.mensalidade > 0)
    parts.push(
      `• Mensalidade: ${brl(row.mensalidade)}${row.mensalidade_overdue_days > 0 ? ` (${row.mensalidade_overdue_days}d atraso)` : ""}`
    );
  if (row.comissao > 0) parts.push(`• Comissão: ${brl(row.comissao)}`);
  if (row.entrega_fee > 0) parts.push(`• Taxa ${DELIVERY_FEE_LABEL}: ${brl(row.entrega_fee)}`);
  if (row.pdv_fee > 0) parts.push(`• PDV: ${brl(row.pdv_fee)}`);
  return `Olá ${row.name}! 👋\n\nValores pendentes na plataforma:\n${parts.join("\n")}\n\nTotal: *${brl(row.total)}*\n\nQualquer dúvida estamos à disposição!`;
}
