import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, ArrowDownLeft, ArrowUpRight, Wallet, Banknote } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import QueryErrorState from "@/components/QueryErrorState";
import {
  usePdvSession,
  usePdvSessionMovements,
  calcPdvTurnoResumo,
  formatPdvDateTime,
} from "./usePdvTurnoResumo";

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  maquininha_credito: "Crédito",
  maquininha_debito: "Débito",
  maquininha_pix: "PIX maquininha",
};

/**
 * Conferência de caixa de um turno (drill-down do relatório).
 * Cabeçalho do turno + abertura, vendas por pagamento, suprimentos,
 * sangrias, saldo esperado, valor contado e diferença.
 */
export default function PdvTurnoConferenciaCard({
  sessionId,
  operatorName,
}: {
  sessionId: string;
  operatorName?: string | null;
}) {
  const queryClient = useQueryClient();
  const { data: session, isLoading: sessL, isError: sessE, refetch: refetchSess } =
    usePdvSession(sessionId);
  const { data: movements = [], isLoading: movL, isError: movE, refetch: refetchMov } =
    usePdvSessionMovements(sessionId);

  const isLoading = sessL || movL;
  const isError = sessE || movE;
  const refetch = () => {
    refetchSess();
    refetchMov();
  };

  const resumo = !isLoading && !isError && session ? calcPdvTurnoResumo(session, movements) : null;
  const isOpen = session?.status === "open";
  const payEntries = resumo ? Object.entries(resumo.byPayment).sort((a, b) => b[1] - a[1]) : [];

  return (
    <Card className="rounded-none border-0 border-l-4 border-l-amber-500 bg-card shadow-none">
      <CardContent className="space-y-2 px-4 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Conferência do turno
          </div>
          <Scale className="h-4 w-4 text-amber-500" />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-3.5 w-56" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        ) : isError || !resumo || !session ? (
          <QueryErrorState
            title="Não foi possível carregar a conferência do turno"
            onRetry={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ["pdv-session", sessionId] });
              queryClient.invalidateQueries({ queryKey: ["pdv-session-mov", sessionId] });
            }}
          />
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">
              {operatorName || "Operador"} · {formatPdvDateTime(session.opened_at)}
              {" → "}
              {isOpen ? "agora" : formatPdvDateTime(session.closed_at)}{" "}
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ml-1 ${
                  isOpen ? "bg-emerald-500/10 text-emerald-600" : "bg-muted/60 text-muted-foreground"
                }`}
              >
                {isOpen ? "● Aberto" : "Fechado"}
              </span>
            </p>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[11px] text-muted-foreground">
                {resumo.diff !== null ? "Diferença" : "Saldo esperado"}
              </span>
              {resumo.diff !== null ? (
                <span
                  className={`text-3xl font-black tabular-nums ${
                    resumo.isOk
                      ? "text-emerald-600 dark:text-emerald-400"
                      : resumo.diff > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-500"
                  }`}
                >
                  {resumo.isOk
                    ? "✅ Conferido"
                    : resumo.diff > 0
                      ? `Sobra ${formatBRL(resumo.diff)}`
                      : `Falta ${formatBRL(Math.abs(resumo.diff))}`}
                </span>
              ) : (
                <span className="text-3xl font-black tabular-nums text-amber-600 dark:text-amber-400">
                  {formatBRL(resumo.saldoEsperado)}
                </span>
              )}
            </div>

            <div className="pt-1 space-y-1.5 border-t border-border/50">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="h-3 w-3 text-muted-foreground" />
                  Abertura
                </span>
                <span className="font-bold tabular-nums">{formatBRL(resumo.opening)}</span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                  Vendas
                  <span className="text-muted-foreground/70">
                    ({resumo.salesCount} venda{resumo.salesCount !== 1 ? "s" : ""})
                  </span>
                </span>
                <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{formatBRL(resumo.totalVendido)}
                </span>
              </div>
              {payEntries.map(([method, value]) => (
                <div key={method} className="flex items-center justify-between text-[10px] pl-5">
                  <span className="text-muted-foreground">{PAYMENT_LABELS[method] || method}</span>
                  <span className="tabular-nums text-muted-foreground">{formatBRL(value)}</span>
                </div>
              ))}

              {resumo.totalSuprimentos > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowDownLeft className="h-3 w-3 text-blue-500" />
                    Suprimentos
                  </span>
                  <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">
                    +{formatBRL(resumo.totalSuprimentos)}
                  </span>
                </div>
              )}

              {resumo.totalSangrias > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowUpRight className="h-3 w-3 text-red-500" />
                    Sangrias
                  </span>
                  <span className="font-bold tabular-nums text-red-500">
                    −{formatBRL(resumo.totalSangrias)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Banknote className="h-3 w-3 text-amber-500" />
                  Saldo esperado
                  <span className="text-muted-foreground/70">(abertura + dinheiro + suprimentos − sangrias)</span>
                </span>
                <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {formatBRL(resumo.saldoEsperado)}
                </span>
              </div>

              {!isOpen && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Valor contado no fechamento</span>
                  <span className="font-bold tabular-nums">{formatBRL(resumo.closing)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
