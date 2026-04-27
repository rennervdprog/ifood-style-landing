import { supabase } from "@/integrations/supabase/client";

export type PartnerDashboardPath = "/super-admin" | "/admin" | "/entregador" | "/portal-parceiro";

export async function resolvePartnerDashboard(userId: string): Promise<PartnerDashboardPath> {
  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (adminRole) return "/super-admin";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const role = (profile as any)?.role as string | undefined;
  if (role === "lojista") return "/admin";
  if (role === "motoboy") return "/entregador";

  const { data: ownedStore } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (ownedStore) return "/admin";

  const { data: driver } = await supabase
    .from("drivers")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (driver) return "/entregador";

  const { data: storeDriver } = await supabase
    .from("store_drivers")
    .select("id")
    .eq("driver_user_id", userId)
    .limit(1)
    .maybeSingle();
  if (storeDriver) return "/entregador";

  return "/portal-parceiro";
}