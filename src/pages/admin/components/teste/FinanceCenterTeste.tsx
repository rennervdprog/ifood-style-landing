/**
 * TELA 4 — Financeiro reestruturado (/admin-teste).
 *
 * Substitui o FinanceCenter original SÓ no /admin-teste. Uma única
 * página, sem abas internas que escondem a conta:
 *  1. Conta do período — bruto − taxas − reembolsos = líquido, com a
 *     data do próximo repasse (FinanceSummaryTeste).
 *  2. Extrato — os MESMOS pedidos e a MESMA conta da seção 1
 *     (FinanceStatementTeste). Nunca mais resumo com valor e extrato
 *     zerado: os dois blocos recebem o mesmo resumo do hook único.
 *  3. Plano — card do plano com o texto corrigido (Pix direto, sem taxa).
 *  4. Repasse — o ÚNICO lugar do repasse no /admin-teste
 *     (RepasseSectionTeste). A aba "repasse" do shell aponta para cá.
 * O seletor de período é único e alimenta as seções 1 e 2 juntas, para
 * a conta nunca divergir entre os blocos. Relatórios detalhados
 * (StoreReportsPanel) continuam na aba própria "Relatórios" e o plano
 * completo continua em "Meu Plano" — fora desta tela, por decisão
 * deliberada (não duplicar superfícies aqui).
 */
import { useEffect, useState } from "react";
import { AdminTextTeste } from "./AdminBaseTeste";
import FinanceSummaryTeste from "./FinanceSummaryTeste";
import FinanceStatementTeste from "./FinanceStatementTeste";
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
  /** Quando "repasse", rola até o bloco de repasse ao abrir. */
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

      <FinanceSummaryTeste storeId={storeId} resumo={resumo} />
      <FinanceStatementTeste resumo={resumo} />
      <PlanSummaryCardTeste storeId={storeId} />
      <RepasseSectionTeste storeId={storeId} storeName={storeName} />
    </div>
  );
}
