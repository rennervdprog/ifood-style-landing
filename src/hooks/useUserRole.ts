/**
 * useUserRole — hook que carrega o role + dados de matriz/unidade do usuário
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type PartnerRole = "cliente" | "lojista" | "lojista_matriz" | "lojista_unidade" | "motoboy" | "suporte";

export interface UserRoleInfo {
  role: PartnerRole | null;
  networkId: string | null;
  unitStoreId: string | null;
  isMatriz: boolean;
  isUnit: boolean;
  isLojista: boolean;
  loading: boolean;
}

export function useUserRole(): UserRoleInfo {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("role, network_id, unit_store_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const role = (data?.role as PartnerRole) || null;

  return {
    role,
    networkId: data?.network_id || null,
    unitStoreId: data?.unit_store_id || null,
    isMatriz: role === "lojista_matriz",
    isUnit: role === "lojista_unidade",
    isLojista: role === "lojista" || role === "lojista_matriz" || role === "lojista_unidade",
    loading: isLoading,
  };
}
