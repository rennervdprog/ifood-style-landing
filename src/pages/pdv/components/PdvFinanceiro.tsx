import RecebidoNoMesCard from "@/components/finance/RecebidoNoMesCard";
import ValorAPagarCard from "@/components/finance/ValorAPagarCard";
import PlanSummaryCard from "@/components/finance/PlanSummaryCard";
import FinancialStatement from "@/components/FinancialStatement";

interface Props {
  storeId: string;
  storeName?: string;
  /** Para onde ir ao clicar em "Ver cobranças PIX" (ex.: aba "Meu Plano"). */
  onPayClick?: () => void;
}

/**
 * Aba "Financeiro" do PDV — controle financeiro visível para o lojista
 * direto no caixa, inclusive no plano Somente PDV (que não acessa o
 * painel /admin). Reaproveita os cards do FinanceCenter, omitindo o que
 * é de delivery (repasses), irrelevante para frente de caixa.
 */
export default function PdvFinanceiro({ storeId, storeName, onPayClick }: Props) {
  return (
    <div className="p-3 sm:p-4 space-y-3 max-w-3xl mx-auto w-full">
      <div className="grid gap-3 sm:grid-cols-2">
        <ValorAPagarCard storeId={storeId} onPayClick={onPayClick} />
        <RecebidoNoMesCard storeId={storeId} />
      </div>
      <PlanSummaryCard storeId={storeId} />
      <FinancialStatement storeId={storeId} storeName={storeName} />
    </div>
  );
}
