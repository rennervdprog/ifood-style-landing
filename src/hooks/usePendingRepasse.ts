import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchStorePlanRow, storePlanRowQueryKey } from "@/hooks/storePlanRow";

export interface PendingRepasseBreakdown {
  /** Comissão do plano sobre vendas (dinheiro/cartão/PIX manual). */
  comissao: number;
  /** Taxa operacional / split por entrega (delivery). */
  splitEntrega: number;
  /** Taxa fixa por venda no PDV. */
  pdv: number;
}

export interface PendingRepasseResult {
  total: number;
  breakdown: PendingRepasseBreakdown;
  hasPendingCharge: boolean;
  isLoading: boolean;
}

/**
 * Fonte única do valor pendente de repasse do lojista.
 * Substitui as queries duplicadas em CommissionAlert / PlatformSplitAlert /
 * ValorAPagarCard / useRepassePending — todas devem consumir este hook.
 */
export function usePendingRepasse(storeId?: string): PendingRepasseResult {
  const enabled = !!storeId;

  const { data: balance, isLoading: loadingBalance } = useQuery({
    queryKey: ["repasse-balance", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_balances")
        .select("repasse_pendente, comissao_pendente")
        .eq("store_id", storeId!)
        .maybeSingle();
      return data;
    },
    enabled,
    refetchInterval: 30_000,
  });

  // Plano: mesma busca de rede de `useStorePlan` (linha crua compartilhada,
  // chave ["store-plan-row", …]); aqui só projetamos os 2 campos usados.
  const { data: plan, isLoading: loadingPlan } = useQuery({
    queryKey: storePlanRowQueryKey(storeId),
    queryFn: () => fetchStorePlanRow(storeId!),
    select: (row: any) =>
      row
        ? { plan_type: row.plan_type, pdv_commission_pending: row.pdv_commission_pending }
        : row,
    enabled,
    refetchInterval: 30_000,
  });

  // Cobrança pendente: MESMA chave/busca da Visão Geral
  // (["dashboard-pending-charge", …], superset id/amount/created_at) —
  // uma busca só pros dois consumidores; aqui basta saber se existe.
  const { data: charge, isLoading: loadingCharge } = useQuery({
    queryKey: ["dashboard-pending-charge", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("financial_transactions")
        .select("id, amount, created_at")
        .eq("store_id", storeId!)
        .eq("transaction_kind", "commission_charge")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled,
    refetchInterval: 30_000,
  });

  const storedSplitEntrega = Number(balance?.repasse_pendente || 0);
  const storedComissao = Number(balance?.comissao_pendente || 0);
  const pdvPend = Number(plan?.pdv_commission_pending || 0);
  const planType = String(plan?.plan_type || "commission_only");

  // Espelha o contrato do backend de cobrança e dos webhooks de baixa.
  const splitEntrega = planType === "fixed" || planType === "supporter" || planType === "hybrid"
    ? storedSplitEntrega
    : 0;
  const comissao = planType === "commission_only" || planType === "hybrid"
    ? storedComissao
    : 0;
  const total = Number((splitEntrega + comissao + pdvPend).toFixed(2));

  return {
    total,
    breakdown: { comissao, splitEntrega, pdv: pdvPend },
    hasPendingCharge: !!charge,
    isLoading: loadingBalance || loadingPlan || loadingCharge,
  };
}