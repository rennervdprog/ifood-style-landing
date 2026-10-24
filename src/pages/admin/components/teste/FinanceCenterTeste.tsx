/**
 * TELA 4 — Financeiro reestruturado (/admin-teste).
 *
 * Substitui o FinanceCenter original SÓ no /admin-teste. Duas visões,
 * escolhidas por `focusSection` (o shell já passa "repasse" só na aba
 * Repasse — nada muda no shell):
 *  - Visão Resumo (padrão): seletor de período único + Indicadores,
 *    Conta, Tendência, Extrato, Plano, Repasse e Histórico. O período
 *    vale para a conta e para o extrato juntos, para a conta nunca
 *    divergir entre os blocos.
 *  - Visão Repasse (`focusSection === "repasse"`): SÓ o cabeçalho +
 *    Repasse + Histórico. A rolagem por âncora numa página longa não
 *    sinaliza troca de aba: quem abre a aba "Repasse" espera ver o
 *    repasse, não rolar uma página de resumo até o fim — por isso a
 *    visão própria, em vez de só rolar até o bloco.
 * Relatórios detalhados (StoreReportsPanel) continuam na aba própria
 * "Relatórios" e o plano completo continua em "Meu Plano" — fora
 * desta tela, por decisão deliberada (não duplicar superfícies aqui).
 */
import { useEffect, useState } from "react";
import { AdminTextTeste } from "./AdminBaseTeste";
import FinanceSummaryTeste from "./FinanceSummaryTeste";
import FinanceStatementTeste from "./FinanceStatementTeste";
import FinanceIndicatorsTeste from "./FinanceIndicatorsTeste";
import FinanceTrendTeste from "./FinanceTrendTeste";
import FinanceHistoryTeste from "./FinanceHistoryTeste";
import PlanSummaryCardTeste from "./PlanSummaryCardTeste";
import RepasseSectionTeste from "./RepasseSectionTeste";
import {
  FINANCEIRO_PERIODOS_TESTE,
  useFinanceiroTeste,
  type FinanceiroPeriodoTeste,
} from "./useFinanceiroTeste";
import { cn } from "@/lib/utils";

interface Props {
  storeId: string;
  storeName: string;
  hasCommission: boolean;
  isPlatformAdmin?: boolean;
  /** Quando "repasse", mostra só a visão de repasse. */
  focusSection?: "resumo" | "repasse";
}

export default function FinanceCenterTeste({
  storeId,
  storeName,
  focusSection,
}: Props) {
  const [periodo, setPeriodo] = useState<FinanceiroPeriodoTeste>("mes_atual");
  const resumo = useFinanceiroTeste(storeId, periodo);

  useEffect(() => {
    if (focusSection === "repasse") {
      document
        .getElementById("financeiro-repasse")
        ?.scrollIntoView({ behavior: "smooth" });
    }
  }, [focusSection]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 pb-6 pt-5 lg:px-6">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-bold text-muted-foreground">Gestão / Financeiro</p>
        <AdminTextTeste role="pageTitle" as="h2" className="mt-1">
          Financeiro
        </AdminTextTeste>
        <p className="mt-1 text-sm text-muted-foreground">
          Quanto sua loja vendeu, quanto fica de taxa e quanto sobra — e o
          que falta repassar à plataforma.
        </p>
      </header>

      {focusSection === "repasse" ? (
        <>
          <RepasseSectionTeste
            storeId={storeId}
            storeName={storeName}
            resumo={resumo}
          />
          <FinanceHistoryTeste storeId={storeId} />
        </>
      ) : (
        <>
          <div
            role="group"
            aria-label="Período do financeiro"
            className="flex flex-wrap gap-2"
          >
            {FINANCEIRO_PERIODOS_TESTE.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodo(p.key)}
                aria-pressed={periodo === p.key}
                className={cn(
                  "rounded-full border px-3 py-2 text-sm font-bold",
                  periodo === p.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            O período vale para a conta e para o extrato juntos.
          </p>

          <FinanceIndicatorsTeste resumo={resumo} />
          <FinanceSummaryTeste storeId={storeId} resumo={resumo} />
          <FinanceTrendTeste resumo={resumo} />
          <FinanceStatementTeste resumo={resumo} />
          <PlanSummaryCardTeste storeId={storeId} />
          <RepasseSectionTeste
            storeId={storeId}
            storeName={storeName}
            resumo={resumo}
          />
          <FinanceHistoryTeste storeId={storeId} />
        </>
      )}
    </div>
  );
}
