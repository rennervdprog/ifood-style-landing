/**
 * TELA 4 — Indicadores do Financeiro (/admin-teste).
 *
 * Um só conjunto de números, reconciliado com a Conta: tudo sai da
 * MESMA lista do hook único (useFinanceiroTeste), nunca de outra
 * fonte. Faturamento = Σ total_price (valor cobrado); Receita
 * líquida = Líquido da Conta; Ticket médio = Σ subtotal ÷ nº de
 * pedidos (fórmula original); Crescimento = (Σ subtotal período −
 * Σ subtotal período anterior) ÷ Σ subtotal anterior. "Tudo" não
 * tem período anterior e mostra "—".
 */
import { formatBRL } from "@/lib/utils";
import {
  AdminCardTeste,
  AdminMoneyTeste,
} from "./AdminBaseTeste";
import type { FinanceiroResumoTeste } from "./useFinanceiroTeste";

function Card({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <AdminCardTeste className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <AdminMoneyTeste value={value} className="text-base" />
      {detail && (
        <p className="text-xs text-muted-foreground">{detail}</p>
      )}
    </AdminCardTeste>
  );
}

export default function FinanceIndicatorsTeste({
  resumo,
}: {
  resumo: FinanceiroResumoTeste;
}) {
  const crescimento =
    resumo.crescimentoPercent == null
      ? "—"
      : `${resumo.crescimentoPercent >= 0 ? "+" : ""}${resumo.crescimentoPercent.toFixed(1).replace(".", ",")}%`;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          label="Faturamento"
          value={formatBRL(resumo.faturamento)}
          detail={`${resumo.countPedidos} pedidos no período`}
        />
        <Card
          label="Receita líquida"
          value={formatBRL(resumo.liquido)}
          detail="Líquido da conta abaixo"
        />
        <Card
          label="Ticket médio"
          value={formatBRL(resumo.ticketMedio)}
          detail="Subtotal ÷ nº de pedidos"
        />
        <Card
          label="Crescimento"
          value={crescimento}
          detail={
            resumo.crescimentoPercent == null
              ? "Sem período anterior para comparar"
              : "Subtotal vs. período anterior"
          }
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Período: {resumo.intervaloLabel}
      </p>
    </div>
  );
}
