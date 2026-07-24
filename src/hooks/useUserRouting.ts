/**
 * useUserRouting — single source of truth for role + plan + home-route decisions.
 *
 * Consolidates the queries that were previously duplicated across `RoleGuard`,
 * `resolvePartnerDashboard`, `ClientAuthScreen.redirectByRole`, `ClientGuard`,
 * `useIsReseller` and `useStorePlan` (routing bits only). One react-query
 * cache entry per user, consumed by every guard/screen — no more cascading
 * spinners, no more divergent branches.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type UserRole =
  | "admin"
  | "lojista"
  | "lojista_matriz"
  | "lojista_unidade"
  | "motoboy"
  | "cliente"
  | null;

export type HomeRoute =
  | "/super-admin"
  | "/admin/pdv"
  | "/admin"
  | "/matriz"
  | "/entregador"
  | "/revendedor"
  | "/cliente"
  | "/portal-parceiro";

export interface UserRoutingSnapshot {
  role: UserRole;
  isAdmin: boolean;
  isLojista: boolean;
  isMatriz: boolean;
  isMotoboy: boolean;
  isReseller: boolean;
  isPdvOnly: boolean;
  isApproved: boolean;
  storeId: string | null;
  storeSlug: string | null;
  homeRoute: HomeRoute;
}

export const USER_ROUTING_QUERY_KEY = "user-routing" as const;

/**
 * Pure resolver — receives raw query results and produces the routing snapshot.
 * Exported for unit testing (see `src/hooks/__tests__/useUserRouting.test.ts`).
 */
export function resolveUserRouting(input: {
  adminRow?: { role: string } | null;
  profile?: { role?: string | null; is_approved?: boolean | null; network_id?: string | null; unit_store_id?: string | null } | null;
  ownedStore?: { id: string; slug: string | null } | null;
  matrizNetwork?: { id: string; is_approved?: boolean | null } | null;
  driver?: { user_id: string; is_active?: boolean | null } | null;
  storeDriver?: { id: string } | null;
  storePlanType?: string | null;
  reseller?: { id: string } | null;
}): UserRoutingSnapshot {
  const isAdmin = !!input.adminRow;
  const isReseller = !!input.reseller;

  let role: UserRole = null;
  let isApproved = false;
  let storeId: string | null = null;
  let storeSlug: string | null = null;

  // Explicit profile.role has priority.
  const profileRole = input.profile?.role || null;
  if (profileRole === "admin") {
    role = "admin";
    isApproved = true;
  } else if (
    profileRole === "lojista" ||
    profileRole === "lojista_matriz" ||
    profileRole === "lojista_unidade" ||
    profileRole === "motoboy" ||
    profileRole === "cliente"
  ) {
    role = profileRole as UserRole;
    isApproved = !!input.profile?.is_approved;
  }

  // Fallback chain (mirrors legacy RoleGuard / resolvePartnerDashboard order).
  if (!role && input.matrizNetwork) {
    role = "lojista_matriz";
    isApproved = !!input.matrizNetwork.is_approved;
  }
  if (!role && input.profile?.unit_store_id) {
    role = "lojista_unidade";
    isApproved = true;
  }
  if (!role && input.ownedStore) {
    role = "lojista";
    isApproved = true;
  }
  if (!role && input.driver) {
    role = "motoboy";
    isApproved = !!input.driver.is_active;
  }
  if (!role && input.storeDriver) {
    role = "motoboy";
    isApproved = true;
  }

  if (input.ownedStore) {
    storeId = input.ownedStore.id;
    storeSlug = input.ownedStore.slug ?? null;
  }

  const isPdvOnly = input.storePlanType === "pdv_only";
  const isLojista = role === "lojista" || role === "lojista_matriz" || role === "lojista_unidade";
  const isMatriz = role === "lojista_matriz";
  const isMotoboy = role === "motoboy";

  let homeRoute: HomeRoute;
  if (isAdmin) homeRoute = "/super-admin";
  else if (isMatriz) homeRoute = "/matriz";
  else if (isLojista) homeRoute = isPdvOnly ? "/admin/pdv" : "/admin";
  else if (isMotoboy) homeRoute = "/entregador";
  else if (isReseller) homeRoute = "/revendedor";
  else if (role === "cliente") homeRoute = "/cliente";
  else homeRoute = "/cliente"; // safe default for logged-in users without an explicit partner role

  return {
    role: isAdmin ? "admin" : role,
    isAdmin,
    isLojista,
    isMatriz,
    isMotoboy,
    isReseller,
    isPdvOnly,
    isApproved,
    storeId,
    storeSlug,
    homeRoute,
  };
}

const EMPTY: UserRoutingSnapshot = {
  role: null,
  isAdmin: false,
  isLojista: false,
  isMatriz: false,
  isMotoboy: false,
  isReseller: false,
  isPdvOnly: false,
  isApproved: false,
  storeId: null,
  storeSlug: null,
  homeRoute: "/portal-parceiro",
};

async function fetchUserRouting(userId: string): Promise<UserRoutingSnapshot> {
  // Fast path: single RPC that aggregates the 7+ queries we used to fire in parallel.
  // Falls back to the legacy multi-query path if the RPC isn't available yet.
  try {
    const { data, error } = await (supabase as any).rpc("get_user_routing_context", { _user_id: userId });
    if (!error && data && typeof data === "object") {
      return resolveUserRouting({
        adminRow: data.adminRow ?? null,
        profile: data.profile ?? null,
        ownedStore: data.ownedStore ?? null,
        matrizNetwork: data.matrizNetwork ?? null,
        driver: data.driver ?? null,
        storeDriver: data.storeDriver ?? null,
        storePlanType: data.storePlanType ?? null,
        reseller: data.reseller ?? null,
      });
    }
  } catch {
    // fall through to legacy path
  }

  const [
    adminRes,
    profileRes,
    ownedStoreRes,
    matrizRes,
    driverRes,
    storeDriverRes,
    resellerRes,
  ] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    supabase.from("profiles").select("role, is_approved, network_id, unit_store_id").eq("user_id", userId).maybeSingle(),
    supabase.from("stores").select("id, slug").eq("owner_id", userId).maybeSingle(),
    (supabase as any).from("store_networks" as any).select("id, is_approved").eq("owner_id", userId).maybeSingle(),
    supabase.from("drivers").select("user_id, is_active").eq("user_id", userId).maybeSingle(),
    supabase.from("store_drivers").select("id").eq("driver_user_id", userId).limit(1).maybeSingle(),
    (supabase as any).from("resellers").select("id").eq("user_id", userId).maybeSingle(),
  ]);

  let storePlanType: string | null = null;
  const ownedStore = (ownedStoreRes as any).data as { id: string; slug: string | null } | null;
  if (ownedStore?.id) {
    const { data: planRow } = await (supabase as any)
      .from("store_plans" as any)
      .select("plan_type")
      .eq("store_id", ownedStore.id)
      .eq("is_active", true)
      .maybeSingle();
    storePlanType = (planRow as any)?.plan_type ?? null;
  }

  return resolveUserRouting({
    adminRow: (adminRes as any).data,
    profile: (profileRes as any).data,
    ownedStore,
    matrizNetwork: (matrizRes as any).data,
    driver: (driverRes as any).data,
    storeDriver: (storeDriverRes as any).data,
    storePlanType,
    reseller: (resellerRes as any).data,
  });
}

export function useUserRouting() {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: [USER_ROUTING_QUERY_KEY, user?.id],
    queryFn: () => fetchUserRouting(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  return useMemo(() => {
    if (!user) return { ...EMPTY, loading: authLoading };
    if (query.isLoading || !query.data) return { ...EMPTY, loading: true };
    return { ...query.data, loading: false };
  }, [user, authLoading, query.isLoading, query.data]);
}