import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Resumo de conferência de um turno ───────────────────────────────────────

export interface PdvTurnoResumo {
  opening: number;
  closing: number;
  totalVendido: number;
  salesCount: number;
  totalSangrias: number;
  totalSuprimentos: number;
  /** Vendas em dinheiro (compõem o saldo esperado do caixa). */
  dinheiro: number;
  saldoEsperado: number;
  /** null quando o turno está aberto ou sem valor contado. */
  diff: number | null;
  isOk: boolean;
  byPayment: Record<string, number>;
}

/**
 * Cálculos de conferência de caixa de um turno.
 * Mesma lógica do detalhe inline do histórico (PdvSessionDetail) —
 * fonte única para não duplicar regra de negócio.
 */
export function calcPdvTurnoResumo(session: any, movements: any[]): PdvTurnoResumo {
  const opening = Number(session?.opening_amount || 0);
  const closing = Number(session?.closing_amount || 0);
  const sales = movements.filter((m: any) => m.type === "sale");
  const totalVendido = sales.reduce((s: number, m: any) => s + Number(m.amount), 0);
  const totalSangrias = movements
    .filter((m: any) => m.type === "sangria")
    .reduce((s: number, m: any) => s + Number(m.amount), 0);
  const totalSuprimentos = movements
    .filter((m: any) => m.type === "suprimento")
    .reduce((s: number, m: any) => s + Number(m.amount), 0);
  const dinheiro = sales
    .filter((m: any) => m.payment_method === "dinheiro")
    .reduce((s: number, m: any) => s + Number(m.amount), 0);
  const saldoEsperado = opening + dinheiro + totalSuprimentos - totalSangrias;
  const diff = closing > 0 ? closing - saldoEsperado : null;
  const isOk = diff !== null && Math.abs(diff) < 0.05;
  const byPayment: Record<string, number> = {};
  sales.forEach((m: any) => {
    const k = m.payment_method || "outros";
    byPayment[k] = (byPayment[k] || 0) + Number(m.amount);
  });
  return {
    opening,
    closing,
    totalVendido,
    salesCount: sales.length,
    totalSangrias,
    totalSuprimentos,
    dinheiro,
    saldoEsperado,
    diff,
    isOk,
    byPayment,
  };
}

/** Linha de sessão de caixa pelo id. */
export function usePdvSession(sessionId?: string | null) {
  return useQuery({
    queryKey: ["pdv-session", sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_sessions" as any)
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      return (data ?? null) as any | null;
    },
    enabled: !!sessionId,
  });
}

/**
 * Todas as movimentações de um turno (vendas, sangrias, suprimentos...).
 * Mesma queryKey do detalhe inline do histórico — compartilha o cache.
 */
export function usePdvSessionMovements(sessionId?: string | null) {
  return useQuery({
    queryKey: ["pdv-session-mov", sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_movements" as any)
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!sessionId,
  });
}

/** "08/10 12:37" — formato curto para cabeçalhos de turno. */
export const formatPdvDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
