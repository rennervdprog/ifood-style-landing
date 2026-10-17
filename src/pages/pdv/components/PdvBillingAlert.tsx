import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { usePendingRepasse } from "@/hooks/usePendingRepasse";

interface Props {
  storeId: string;
  onOpenFinanceiro: () => void;
}

/**
 * Faixa de alerta "cobrança em aberto" no topo do PDV.
 * Operacional via hook canônico `usePendingRepasse` (filtra por tipo de plano);
 * mensalidade via query própria. Não renderiza nada quando não há pendência.
 */
export default function PdvBillingAlert({ storeId, onOpenFinanceiro }: Props) {
  const { total: operationalTotal } = usePendingRepasse(storeId);
  const { data: mensalidadeData } = useQuery({
    queryKey: ["valor-a-pagar-mensalidade", storeId],
    queryFn: async () => {
      const { data: monthlyCharges } = await (supabase as any).from("financial_transactions").select("amount").eq("store_id", storeId).eq("transaction_kind", "commission_charge").or("reference_code.like.#MENS-*,reference_code.like.#ASSIN-*").eq("status", "pending").limit(50);
      return (monthlyCharges || []).reduce((sum: number, charge: any) => sum + Number(charge.amount || 0), 0);
    },
    refetchInterval: 60_000,
  });

  const total = operationalTotal + (mensalidadeData ?? 0);
  if (total <= 0) return null;

  return (
    <button
      onClick={onOpenFinanceiro}
      className="shrink-0 w-full flex items-center gap-2.5 px-3 sm:px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-left hover:bg-amber-500/15 transition-colors"
      aria-label={`Cobrança em aberto de ${formatBRL(total)}. Ver financeiro.`}
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="flex-1 min-w-0 text-xs font-semibold text-amber-800 dark:text-amber-200 truncate">
        Cobrança em aberto: <span className="font-black">{formatBRL(total)}</span>
      </span>
      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
        Ver financeiro <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}
