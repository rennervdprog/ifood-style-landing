import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { USER_ROUTING_QUERY_KEY, type UserRoutingSnapshot } from "@/hooks/useUserRouting";

export type PartnerDashboardPath =
  | "/super-admin"
  | "/admin"
  | "/admin/pdv"
  | "/matriz"
  | "/entregador"
  | "/revendedor"
  | "/portal-parceiro";

/**
 * Fonte da verdade: se o hook `useUserRouting` já resolveu, reaproveita o
 * cache do react-query (0 round-trips). Caso contrário, cai no fallback
 * legado — mesma lógica de sempre, mantida para retrocompatibilidade.
 */
export async function resolvePartnerDashboard(userId: string): Promise<PartnerDashboardPath> {
  const cached = queryClient.getQueryData<UserRoutingSnapshot>([USER_ROUTING_QUERY_KEY, userId]);
  if (cached) {
    return cached.homeRoute as PartnerDashboardPath;
  }
  return legacyResolve(userId);
}

async function legacyResolve(userId: string): Promise<PartnerDashboardPath> {
  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

   if (adminRole) {
     console.log("[Dashboard] User has admin role, redirecting to /super-admin");
     return "/super-admin";
   }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

   const role = (profile as any)?.role as string | undefined;
   console.log("[Dashboard] Profile role:", role);
   
   if (role === "lojista") {
     console.log("[Dashboard] Redirecting to /admin (lojista)");
     return "/admin";
   }
   if (role === "motoboy" || role === "entregador") {
     console.log("[Dashboard] Redirecting to /entregador");
     return "/entregador";
   }

  const { data: ownedStore } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
   if (ownedStore) {
     console.log("[Dashboard] User owns a store, redirecting to /admin");
     return "/admin";
   }

  const { data: driver } = await supabase
    .from("drivers")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
   if (driver) {
     console.log("[Dashboard] User found in drivers table, redirecting to /entregador");
     return "/entregador";
   }

  const { data: storeDriver } = await supabase
    .from("store_drivers")
    .select("id")
    .eq("driver_user_id", userId)
    .limit(1)
    .maybeSingle();
   if (storeDriver) {
     console.log("[Dashboard] User found in store_drivers table, redirecting to /entregador");
     return "/entregador";
   }
 
   console.log("[Dashboard] No dashboard found, falling back to /portal-parceiro");

  return "/portal-parceiro";
}