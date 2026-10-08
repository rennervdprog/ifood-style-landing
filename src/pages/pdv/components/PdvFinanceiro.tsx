import ValorAPagarCard from "@/components/finance/ValorAPagarCard";
import PlanSummaryCard from "@/components/finance/PlanSummaryCard";
import FinancialStatement from "@/components/FinancialStatement";
import PdvRecebidoMesCard from "@/pages/pdv/components/PdvRecebidoMesCard";
import PdvFluxoCaixaCard from "@/pages/pdv/components/PdvFluxoCaixaCard";
import PdvTicketMedioPdvCard from "@/pages/pdv/components/PdvTicketMedioPdvCard";

interface Props {
  storeId: string;
  storeName?: string;
  /** Para onde ir ao clicar em "Ver cobranças PIX" (ex.: aba "Meu Plano"). */
  onPayClick?: () => void;
}

/**
 * Aba "Financeiro" do PDV — controle financeiro visível para o lojista
 * direto no caixa, inclusive no plano Somente PDV (que não acessa o
 * painel /admin).
 *
 * O PDV é independente do delivery: os cards de resultado (recebido,
 * fluxo de caixa, ticket médio) são nativos do balcão — somem apenas
 * vendas com order_source='pdv' e movimentações de caixa. Os cards de
 * cobrança da plataforma (valor a pagar, plano, extrato) são mantidos
 * porque independem do canal de venda.
 */
export default function PdvFinanceiro({ storeId, storeName, onPayClick }: Props) {
  return (
    <div className="p-3 sm:p-4 space-y-3 max-w-3xl mx-auto w-full">
      <div className="grid gap-3 sm:grid-cols-2">
        <ValorAPagarCard storeId={storeId} onPayClick={onPayClick} />
        <PdvRecebidoMesCard storeId={storeId} />
        <PdvFluxoCaixaCard storeId={storeId} />
        <PdvTicketMedioPdvCard storeId={storeId} />
      </div>
      <PlanSummaryCard storeId={storeId} />
      <FinancialStatement storeId={storeId} storeName={storeName} />
    </div>
  );
}
