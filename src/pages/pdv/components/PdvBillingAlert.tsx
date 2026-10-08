import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface Props {
  storeId: string;
  onOpenFinanceiro: () => void;
}

/**
 * Faixa de alerta "cobrança em aberto" no topo do PDV.
 * Usa a MESMA query do ValorAPagarCard (queryKey idêntica) — o React Query
 * compartilha o cache entre os dois, sem requisição duplicada.
 * Não renderiza nada quando não há pendência.
 */
export default function PdvBillingAlert({ storeId, onOpenFinanceiro }: Props) {
  const { data } = useQuery({
    queryKey: ["valor-a-pagar", storeId],
    queryFn: async () => {
      const [{ data: bal }, { data: plan }, { data: monthlyCharges }] = await Promise.all([
        (supabase as any).from("store_balances").select("repasse_pendente, comissao_pendente").eq("store_id", storeId).maybeSingle(),
        (supabase as any).from("store_plans").select("pdv_commission_pending").eq("store_id", storeId).eq("is_active", true).maybeSingle(),
        (supabase as any).from("financial_transactions").select("amount").eq("store_id", storeId).eq("transaction_kind", "monthly_fee").eq("status", "pending").limit(50),
      ]);

      const repasse = Number(bal?.repasse_pendente || 0);
      const comissao = Number(bal?.comissao_pendente || 0);
      const pdv = Number(plan?.pdv_commission_pending || 0);
      const mensalidade = (monthlyCharges || []).reduce((sum: number, charge: any) => sum + Number(charge.amount || 0), 0);
      const operationalTotal = repasse + comissao + pdv;
      const total = operationalTotal + mensalidade;
      return { repasse, comissao, pdv, mensalidade, operationalTotal, total };
    },
    refetchInterval: 60_000,
  });

  const total = data?.total ?? 0;
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
