/**
 * TELA 4 — Conta do mês (/admin-teste).
 *
 * A conta decomposta, num só lugar: bruto + frete − descontos − taxas
 * − reembolsos = líquido. Recebe o resumo do hook único
 * (useFinanceiroTeste) — NÃO consulta outra fonte, para o número aqui
 * ser sempre o mesmo do extrato.
 * Todos os valores usam AdminMoneyTeste (fonte tabular, Tela 1).
 */
import { format, nextMonday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { REPASSE_RULES } from "@/lib/repasseRules";
import { usePendingRepasse } from "@/hooks/usePendingRepasse";
import {
  AdminButtonTeste,
  AdminCardTeste,
  AdminCardDescriptionTeste,
  AdminCardTitleTeste,
  AdminMoneyTeste,
  AdminTextTeste,
} from "./AdminBaseTeste";
import type { FinanceiroResumoTeste } from "./useFinanceiroTeste";

function Linha({
  label,
  detail,
  value,
  strong,
  negative,
  positive,
}: {
  label: string;
  detail?: string;
  value: number;
  strong?: boolean;
  negative?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">
        {label}
        {detail && <span className="block text-xs">{detail}</span>}
      </span>
      <AdminMoneyTeste
        value={`${negative ? "− " : positive ? "+ " : ""}${formatBRL(value)}`}
        className={strong ? "text-base" : undefined}
      />
    </div>
  );
}

export default function FinanceSummaryTeste({
  storeId,
  resumo,
}: {
  storeId: string;
  resumo: FinanceiroResumoTeste;
}) {
  // Mesmo hook do bloco de repasse: o "a pagar" aqui é só um apontador
  // para o bloco único de repasse abaixo, nunca uma segunda conta.
  const { total: aPagar } = usePendingRepasse(storeId);
  const proximaSegunda = nextMonday(new Date());
  const minimo = REPASSE_RULES.MIN_AUTO_CHARGE_BRL;
  // O "a pagar" é um SALDO ACUMULADO desde o último acerto, não a taxa
  // do período: o que passar da taxa + comissão deste período vem de
  // movimentos anteriores ainda não quitados.
  const destePeriodo = resumo.taxaPlataforma + resumo.comissao;
  const anteriores = Math.max(0, aPagar - destePeriodo);

  return (
    <AdminCardTeste id="financeiro-conta" className="scroll-mt-24 space-y-4">
      <div>
        <AdminCardTitleTeste>Conta do período</AdminCardTitleTeste>
        <AdminCardDescriptionTeste>
          {resumo.countPedidos} pedidos entregues · mesma conta do extrato
          abaixo — se há pedido aqui, há pedido lá.
        </AdminCardDescriptionTeste>
      </div>

      {resumo.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : resumo.isError ? (
        <AdminTextTeste role="body">
          Não foi possível carregar a conta do período. Tente novamente — não
          assumimos que está tudo em dia.
        </AdminTextTeste>
      ) : (
        <div className="space-y-2">
          <Linha label="Bruto (vendas)" value={resumo.bruto} />
          <Linha
            label="Frete cobrado do cliente"
            detail="O que o cliente pagou pela entrega"
            value={resumo.freteTotal}
            positive
          />
          {resumo.descontosTotal > 0 && (
            <Linha
              label="Descontos"
              detail="Diferença entre o subtotal e o valor cobrado do cliente"
              value={resumo.descontosTotal}
              negative
            />
          )}
          <Linha
            label="Taxa de plataforma"
            detail={`${resumo.countEntregas} ${resumo.countEntregas === 1 ? "entrega" : "entregas"} × ${formatBRL(resumo.taxaPlataformaPorEntrega)}`}
            value={resumo.taxaPlataforma}
            negative
          />
          {resumo.commissionRate > 0 && (
            <Linha
              label="Comissão do plano"
              detail={`${(resumo.commissionRate * 100).toFixed(0).replace(".", ",")}% sobre as vendas`}
              value={resumo.comissao}
              negative
            />
          )}
          <Linha
            label="Pix direto"
            detail="Vai direto para a conta da sua loja, sem taxa do ItaSuper"
            value={0}
          />
          <Linha
            label="Reembolsos"
            detail={
              resumo.reembolsos.length > 0
                ? `${resumo.reembolsos.length} reembolso(s) no período`
                : "Nenhum reembolso no período"
            }
            value={resumo.reembolsosTotal}
            negative
          />
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
            <span className="text-sm font-bold text-foreground">Líquido</span>
            <AdminMoneyTeste value={formatBRL(resumo.liquido)} className="text-base" />
          </div>
          <p className="text-xs text-muted-foreground">
            Frete = o que o cliente pagou pela entrega (não é lucro da loja:
            a taxa de plataforma é descontada abaixo). Taxa de plataforma ={" "}
            {formatBRL(resumo.taxaPlataformaPorEntrega)} por entrega.
          </p>
          <p className="text-xs text-muted-foreground">
            Descontos = diferença entre o subtotal e o valor cobrado do
            cliente. O painel original usava o valor cobrado; esta conta
            mostra os dois, para fechar.
          </p>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
        <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Próximo repasse
          </p>
          <p className="text-sm font-bold capitalize text-foreground">
            {format(proximaSegunda, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
          <p className="text-xs text-muted-foreground">
            Cobrança semanal toda segunda-feira, a partir de{" "}
            {formatBRL(minimo)} acumulados.
          </p>
          {aPagar > 0 && aPagar < minimo && (
            <p className="mt-1 text-xs font-bold text-foreground">
              Faltam {formatBRL(minimo - aPagar)} para a cobrança automática
            </p>
          )}
          {aPagar >= minimo && (
            <p className="mt-1 text-xs font-bold text-foreground">
              Acima do mínimo — cobrança na próxima segunda
            </p>
          )}
          {anteriores > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Saldo acumulado: {formatBRL(destePeriodo)} deste período +{" "}
              {formatBRL(anteriores)} de movimentos anteriores ainda não
              quitados — o repasse só zera quando a cobrança é paga
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            A pagar
          </p>
          <AdminMoneyTeste value={formatBRL(aPagar)} />
          <div className="mt-2">
            <AdminButtonTeste
              variant="primary"
              className="h-9 px-3 text-xs"
              onClick={() => {
                document
                  .getElementById("financeiro-repasse")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Ver repasse
            </AdminButtonTeste>
          </div>
        </div>
      </div>
    </AdminCardTeste>
  );
}
