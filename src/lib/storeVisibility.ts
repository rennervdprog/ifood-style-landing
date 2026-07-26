import { supabase } from "@/integrations/supabase/client";

/**
 * Regras de visibilidade da vitrine /cliente:
 *  - Lojas `plan_type === 'pdv_only'` NUNCA aparecem (não recebem delivery).
 *  - Só aparecem lojas que tenham ao menos 1 entregador vinculado (`store_drivers`)
 *    cuja conta em `drivers` esteja com `is_online = true`.
 *
 * Recebe qualquer lista de lojas (precisa ter `id`; usa `plan_type` se existir).
 */
export async function filterStoresWithOnlineDrivers<T extends { id: string; plan_type?: string | null }>(
  stores: T[] | null | undefined,
): Promise<T[]> {
  const list = (stores || []).filter((s) => (s as any).plan_type !== "pdv_only");
  if (list.length === 0) return [];
  const ids = list.map((s) => s.id);

  const { data: links } = await supabase
    .from("store_drivers")
    .select("store_id, driver_user_id")
    .in("store_id", ids);
  const linkRows = (links || []) as { store_id: string; driver_user_id: string }[];
  if (linkRows.length === 0) return [];

  const driverIds = Array.from(new Set(linkRows.map((l) => l.driver_user_id)));
  const { data: drivers } = await supabase
    .from("drivers")
    .select("user_id, is_online")
    .in("user_id", driverIds)
    .eq("is_online", true);
  const onlineDrivers = new Set(((drivers || []) as { user_id: string }[]).map((d) => d.user_id));
  if (onlineDrivers.size === 0) return [];

  const storesWithOnline = new Set(
    linkRows.filter((l) => onlineDrivers.has(l.driver_user_id)).map((l) => l.store_id),
  );
  return list.filter((s) => storesWithOnline.has(s.id));
}