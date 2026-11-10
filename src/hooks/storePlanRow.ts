import { supabase } from "@/integrations/supabase/client";

/**
 * Linha crua de `store_plans` (plano ativo da loja) — fonte ÚNICA compartilhada
 * por `useStorePlan` e `usePendingRepasse`.
 *
 * Antes, cada hook buscava a mesma linha com chaves diferentes
 * (["store-plan", …] embutida no bundle e ["repasse-plan-balance", …]),
 * pagando 2 buscas de rede pela mesma tabela no mount do painel.
 * O select é o SUPERSET dos campos que os dois lados usam.
 */
export const storePlanRowQueryKey = (storeId?: string | null) =>
  ["store-plan-row", storeId] as const;

export async function fetchStorePlanRow(storeId: string) {
  const { data, error } = await (supabase as any)
    .from("store_plans")
    .select(
      "plan_type, monthly_fee, commission_rate, trial_ends_at, next_billing_date, last_billed_at, started_at, pix_operational_fee_override, platform_delivery_split_override, pdv_enabled, pdv_commission_rate, pdv_commission_pending, essencial_lifetime_free",
    )
    .eq("store_id", storeId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}
