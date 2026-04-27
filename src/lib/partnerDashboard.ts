import { supabase } from "@/integrations/supabase/client";

export type PartnerDashboardPath = "/super-admin" | "/admin" | "/entregador" | "/portal-parceiro";

export async function resolvePartnerDashboard(userId: string): Promise<PartnerDashboardPath> {
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