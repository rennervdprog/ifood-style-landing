import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Painel do Afiliado — Fase 2: leitura dos dados do PRÓPRIO afiliado.
// As 4 tabelas do programa têm RLS de leitura só do dono (Fase 1.1), então
// o cliente lê direto, sem RPC de leitura. Os tipos gerados do Supabase
// ainda não incluem as tabelas de afiliados — por isso o cast pontual,
// no mesmo padrão do painel do revendedor (reseller_get_dashboard).

export interface AffiliateRow {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  pix_key: string | null;
  payout_day: number;
  status: "pending" | "approved" | "suspended";
  referral_code: string;
  created_at: string;
}

export interface AffiliateCreditRow {
  id: string;
  store_id: string;
  store_name: string | null;
  plan_kind: "essencial" | "pdv";
  base_amount: number | string;
  rate_percent: number;
  credit_amount: number | string;
  status: "pending" | "available" | "paid" | "cancelled";
  earned_at: string;
  release_at: string;
  payout_id: string | null;
  created_at: string;
}

export interface AffiliateReferralRow {
  id: string;
  store_id: string;
  store_name: string | null;
  /** "Essencial" | "Somente PDV" | null quando não deu para resolver. */
  plan_label: string | null;
  source: "link" | "code" | "manual";
  created_at: string;
}

export interface AffiliatePayoutRow {
  id: string;
  amount: number | string;
  pix_key: string | null;
  status: "scheduled" | "paid" | "failed" | "cancelled";
  scheduled_for: string | null;
  paid_at: string | null;
  created_at: string;
}

/** Linha mínima de crédito para os TOTAIS (sem limite de exibição). */
export interface AffiliateCreditTotalsRow {
  credit_amount: number | string;
  status: "pending" | "available" | "paid" | "cancelled";
  release_at: string;
  payout_id: string | null;
}

/** Linha mínima de lote para os TOTAIS (sem limite de exibição). */
export interface AffiliatePayoutTotalsRow {
  amount: number | string;
  status: "scheduled" | "paid" | "failed" | "cancelled";
}

export interface AffiliatePanelData {
  affiliate: AffiliateRow | null;
  /** Lista de exibição do extrato (limitada). NÃO usar para somar saldos. */
  credits: AffiliateCreditRow[];
  referrals: AffiliateReferralRow[];
  /** Lista de exibição dos pagamentos (limitada). NÃO usar para somar. */
  payouts: AffiliatePayoutRow[];
  /** Todos os créditos (só colunas de cálculo) — base dos saldos. */
  creditTotals: AffiliateCreditTotalsRow[];
  /** Todos os lotes (só colunas de cálculo) — base do "já recebido". */
  payoutTotals: AffiliatePayoutTotalsRow[];
}

const db = supabase as unknown as {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

async function fetchStoreNames(
  storeIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (storeIds.length === 0) return names;
  // `stores` é leitura pública (vitrine) — nome resolve sem afrouxar nada.
  const { data, error } = await db
    .from("stores")
    .select("id, name")
    .in("id", storeIds);
  if (!error && Array.isArray(data)) {
    for (const row of data as Array<{ id: string; name: string }>) {
      names.set(row.id, row.name);
    }
  }
  return names;
}

/**
 * Plano de cada loja indicada. Tenta, nesta ordem:
 *  1. `store_plans.plan_type` (a RLS pode não liberar a linha de outra
 *     loja para o afiliado — nesse caso vem vazio e seguimos);
 *  2. o plan_kind do crédito mais recente daquela loja;
 *  3. null (a tela mostra só a data do vínculo).
 */
async function fetchPlanLabels(
  storeIds: string[],
  credits: AffiliateCreditRow[],
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (storeIds.length === 0) return labels;

  const { data, error } = await db
    .from("store_plans")
    .select("store_id, plan_type")
    .in("store_id", storeIds);
  if (!error && Array.isArray(data)) {
    for (const row of data as Array<{ store_id: string; plan_type: string }>) {
      labels.set(
        row.store_id,
        row.plan_type === "pdv_only" ? "Somente PDV" : "Essencial",
      );
    }
  }

  for (const credit of credits) {
    if (!labels.has(credit.store_id)) {
      labels.set(
        credit.store_id,
        credit.plan_kind === "pdv" ? "Somente PDV" : "Essencial",
      );
    }
  }
  return labels;
}

export function useAffiliatePanel() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["affiliate-panel", user?.id],
    enabled: !!user?.id,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<AffiliatePanelData> => {
      const { data: affiliateData, error: affiliateError } = await db
        .from("affiliates")
        .select(
          "id, user_id, name, email, pix_key, payout_day, status, referral_code, created_at",
        )
        .eq("user_id", user!.id)
        .maybeSingle();
      if (affiliateError) throw affiliateError;

      const affiliate = (affiliateData ?? null) as AffiliateRow | null;
      if (!affiliate) {
        return {
          affiliate: null,
          credits: [],
          referrals: [],
          payouts: [],
          creditTotals: [],
          payoutTotals: [],
        };
      }

      const [
        creditsRes,
        referralsRes,
        payoutsRes,
        creditTotalsRes,
        payoutTotalsRes,
      ] = await Promise.all([
        db
          .from("affiliate_credits")
          .select(
            "id, store_id, plan_kind, base_amount, rate_percent, credit_amount, status, earned_at, release_at, payout_id, created_at",
          )
          .eq("affiliate_id", affiliate.id)
          .order("created_at", { ascending: false })
          .limit(50),
        db
          .from("affiliate_referrals")
          .select("id, store_id, source, created_at")
          .eq("affiliate_id", affiliate.id)
          .order("created_at", { ascending: false }),
        db
          .from("affiliate_payouts")
          .select(
            "id, amount, pix_key, status, scheduled_for, paid_at, created_at",
          )
          .eq("affiliate_id", affiliate.id)
          .order("created_at", { ascending: false })
          .limit(24),
        // Totais: SEM limit — os saldos não podem somar listas truncadas.
        // Só as colunas de cálculo (crédito: credit_amount; lote: amount).
        db
          .from("affiliate_credits")
          .select("credit_amount, status, release_at, payout_id")
          .eq("affiliate_id", affiliate.id),
        db
          .from("affiliate_payouts")
          .select("amount, status")
          .eq("affiliate_id", affiliate.id),
      ]);
      if (creditsRes.error) throw creditsRes.error;
      if (referralsRes.error) throw referralsRes.error;
      if (payoutsRes.error) throw payoutsRes.error;
      if (creditTotalsRes.error) throw creditTotalsRes.error;
      if (payoutTotalsRes.error) throw payoutTotalsRes.error;

      const rawCredits = (creditsRes.data ?? []) as Array<
        Omit<AffiliateCreditRow, "store_name">
      >;
      const rawReferrals = (referralsRes.data ?? []) as Array<{
        id: string;
        store_id: string;
        source: AffiliateReferralRow["source"];
        created_at: string;
      }>;
      const payouts = (payoutsRes.data ?? []) as AffiliatePayoutRow[];
      const creditTotals = (creditTotalsRes.data ??
        []) as AffiliateCreditTotalsRow[];
      const payoutTotals = (payoutTotalsRes.data ??
        []) as AffiliatePayoutTotalsRow[];

      const storeIds = Array.from(
        new Set([
          ...rawCredits.map((c) => c.store_id),
          ...rawReferrals.map((r) => r.store_id),
        ]),
      );
      const credits: AffiliateCreditRow[] = rawCredits.map((c) => ({
        ...c,
        store_name: null,
      }));
      const [names, planLabels] = await Promise.all([
        fetchStoreNames(storeIds),
        fetchPlanLabels(storeIds, credits),
      ]);
      for (const credit of credits) {
        credit.store_name = names.get(credit.store_id) ?? null;
      }
      const referrals: AffiliateReferralRow[] = rawReferrals.map((r) => ({
        id: r.id,
        store_id: r.store_id,
        store_name: names.get(r.store_id) ?? null,
        plan_label: planLabels.get(r.store_id) ?? null,
        source: r.source,
        created_at: r.created_at,
      }));

      return { affiliate, credits, referrals, payouts, creditTotals, payoutTotals };
    },
  });
}

export function useUpdateAffiliatePayoutSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pixKey: string; payoutDay: number }) => {
      const { data, error } = await db.rpc(
        "update_affiliate_payout_settings",
        { p_pix_key: input.pixKey, p_payout_day: input.payoutDay },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["affiliate-panel", user?.id],
      });
    },
  });
}
