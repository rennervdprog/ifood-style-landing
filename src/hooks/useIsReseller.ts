import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Detecta se o usuário logado é um revendedor cadastrado.
 * Usado para trocar a UI de /cliente, /pedidos e /perfil para a visão do revendedor.
 */
export function useIsReseller() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["is-reseller", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase as any)
        .from("resellers")
        .select("id, code, status")
        .eq("user_id", user.id)
        .maybeSingle();
      return data || null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
  return {
    isReseller: !!data,
    reseller: data as { id: string; code: string; status: string } | null,
    loading: isLoading,
  };
}