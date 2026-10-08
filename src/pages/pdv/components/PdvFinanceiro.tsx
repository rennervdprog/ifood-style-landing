import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ValorAPagarCard from "@/components/finance/ValorAPagarCard";
import PlanSummaryCard from "@/components/finance/PlanSummaryCard";
import FinancialStatement from "@/components/FinancialStatement";
import PdvRecebidoMesCard from "@/pages/pdv/components/PdvRecebidoMesCard";
import PdvFluxoCaixaCard from "@/pages/pdv/components/PdvFluxoCaixaCard";
import PdvTicketMedioPdvCard from "@/pages/pdv/components/PdvTicketMedioPdvCard";
import PdvExtratoCaixaCard from "@/pages/pdv/components/PdvExtratoCaixaCard";

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
 * fluxo de caixa, ticket médio, extrato do caixa) são nativos do balcão —
 * somem apenas vendas com order_source='pdv' e movimentações de caixa.
 * Os cards de cobrança da plataforma (valor a pagar, plano) são mantidos
 * porque independem do canal de venda. O extrato da plataforma só aparece
 * quando há transações — para não exibir uma seção toda zerada que
 * confunde o lojista Somente PDV.
 */
export default function PdvFinanceiro({ storeId, storeName, onPayClick }: Props) {
  // O extrato da plataforma lê financial_transactions (cobrança). Se a loja
  // não tem nenhuma transação, a seção ficaria toda zerada — melhor ocultar.
  const { data: platformTxCount } = useQuery({
    queryKey: ["pdv-financeiro-platform-tx-exists", storeId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("financial_transactions")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!storeId,
  });

  return (
    <div className="p-3 sm:p-4 space-y-3 max-w-3xl mx-auto w-full">
      <div className="grid gap-3 sm:grid-cols-2">
        <ValorAPagarCard storeId={storeId} onPayClick={onPayClick} />
        <PdvRecebidoMesCard storeId={storeId} />
        <PdvFluxoCaixaCard storeId={storeId} />
        <PdvTicketMedioPdvCard storeId={storeId} />
      </div>
      <PdvExtratoCaixaCard storeId={storeId} />
      <PlanSummaryCard storeId={storeId} />
      {(platformTxCount ?? 0) > 0 && (
        <FinancialStatement storeId={storeId} storeName={storeName} />
      )}
    </div>
  );
}
