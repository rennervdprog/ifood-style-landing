import { supabase } from "@/integrations/supabase/client";

/**
 * Regras de visibilidade da vitrine /cliente:
 *  - Lojas `plan_type === 'pdv_only'` NUNCA aparecem (não recebem delivery).
 *  - Só aparecem lojas que tenham ao menos 1 entregador vinculado (`store_drivers`)
 *    cuja conta em `drivers` esteja com `is_online = true`.
 *
 * Recebe qualquer lista de lojas (precisa ter `id`; usa `plan_type` se existir).
 * Usa a RPC `stores_with_online_drivers` (SECURITY DEFINER) para funcionar
 * também para visitantes anônimos — as tabelas `drivers`/`store_drivers` bloqueiam
 * `SELECT` para o role `anon`, o que antes escondia 100% das lojas em `/cliente`
 * quando o usuário não estava logado.
 */
export async function filterStoresWithOnlineDrivers<T extends { id: string; plan_type?: string | null }>(
  stores: T[] | null | undefined,
): Promise<T[]> {
  const list = (stores || []).filter((s) => (s as any).plan_type !== "pdv_only");
  if (list.length === 0) return [];

  const { data, error } = await supabase.rpc("stores_with_online_drivers" as any);
  if (error || !Array.isArray(data)) {
    // Fail-open: se a RPC falhar (rede/rollout), preserva o comportamento
    // anterior à filtragem em vez de deixar a vitrine vazia.
    return list;
  }
  const allowed = new Set<string>((data as string[]).filter(Boolean));
  if (allowed.size === 0) return [];
  return list.filter((s) => allowed.has(s.id));
}