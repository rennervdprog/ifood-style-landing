import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import type { PdvScreen, PdvSession } from "../types";

/**
 * Estado da sessão de caixa do PDV.
 *
 * Centraliza:
 *  - tela atual (`loading` → `abertura` | `venda` | `fechamento`)
 *  - sessão aberta (`currentSession`)
 *  - abertura de caixa
 *  - fechamento de caixa (commit no banco + reset)
 *
 * Não cuida de carrinho nem de venda — só do ciclo de vida do turno.
 */
export function usePdvSession(params: {
  storeId: string | undefined;
  userId: string | undefined;
}) {
  const { storeId, userId } = params;

  const [screen, setScreen] = useState<PdvScreen>("loading");
  const [currentSession, setCurrentSession] = useState<PdvSession | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Carrega sessão aberta da loja ──
  const checkSession = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from("pdv_sessions" as any)
      .select("*")
      .eq("store_id", storeId)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setCurrentSession(data as any as PdvSession);
      setScreen("venda");
    } else {
      setScreen("abertura");
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId) checkSession();
  }, [storeId, checkSession]);

  // ── Abre caixa ──
  const openSession = useCallback(
    async (openingAmount: number) => {
      if (!storeId || !userId) return false;
      setLoading(true);
      try {
        // Bug P1 corrigido: antes do INSERT, checa se já não existe uma
        // sessão aberta (evita dois caixas abertos em tabs distintas).
        const { data: existing } = await supabase
          .from("pdv_sessions" as any)
          .select("id")
          .eq("store_id", storeId)
          .eq("status", "open")
          .maybeSingle();
        if (existing) {
          const s = existing as any;
          toast.error("Já existe um caixa aberto para esta loja.");
          setCurrentSession(s as any as PdvSession);
          setScreen("venda");
          return false;
        }
        const { data, error } = await supabase
          .from("pdv_sessions" as any)
          .insert({
            store_id: storeId,
            opened_by: userId,
            opening_amount: openingAmount,
            status: "open",
          })
          .select()
          .single();
        if (error) throw error;
        setCurrentSession(data as any as PdvSession);
        setScreen("venda");
        toast.success(`Caixa aberto! Troco inicial: ${formatBRL(openingAmount)}`);
        return true;
      } catch (e: any) {
        toast.error(e.message || "Erro ao abrir caixa.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [storeId, userId],
  );

  // ── Fecha caixa ──
  const closeSession = useCallback(
    async (args: {
      countedAmount: number;
      expectedAmount: number;
      blindClose: boolean;
      denominationCounts: Record<string, number>;
    }) => {
      if (!currentSession) return false;
      const { countedAmount, expectedAmount, blindClose, denominationCounts } = args;
      setLoading(true);
      try {
        const diff = countedAmount - expectedAmount;
        // Auditoria: registra qual operador fechou o caixa.
        const { data: authData } = await supabase.auth.getUser();
        const closedBy = authData?.user?.id ?? null;
        const { error } = await supabase
          .from("pdv_sessions" as any)
          .update({
            status: "closed",
            closed_at: new Date().toISOString(),
            closed_by: closedBy,
            closing_amount: countedAmount,
            closing_difference: diff,
            closing_method: blindClose ? "blind" : "open",
            denomination_count:
              Object.keys(denominationCounts).length > 0 ? denominationCounts : null,
          })
          .eq("id", currentSession.id);
        if (error) throw error;
        toast.success("Caixa fechado.");
        setCurrentSession(null);
        setScreen("abertura");
        return true;
      } catch (e: any) {
        toast.error(e.message || "Erro ao fechar caixa.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [currentSession],
  );

  return {
    screen,
    setScreen,
    currentSession,
    setCurrentSession,
    loading,
    checkSession,
    openSession,
    closeSession,
  };
}