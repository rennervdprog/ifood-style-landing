import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import {
  Receipt, Banknote, CreditCard, Smartphone, Loader2,
  Clock, ArrowDownCircle, ArrowUpCircle, Tag,
} from "lucide-react";

interface Props {
  storeId?: string;
  sessionId?: string;
  limit?: number;
}

const PAYMENT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  dinheiro:           { label: "Dinheiro",  icon: Banknote,   color: "text-emerald-500" },
  maquininha_credito: { label: "Crédito",   icon: CreditCard, color: "text-blue-500" },
  maquininha_debito:  { label: "Débito",    icon: CreditCard, color: "text-indigo-500" },
  maquininha_pix:     { label: "PIX",       icon: Smartphone, color: "text-orange-500" },
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Histórico do PDV — exibe vendas e movimentações (sangria/suprimento)
 * do turno atual ou de um turno específico.
 */
export const PdvHistorico = ({ storeId, sessionId, limit = 50 }: Props) => {

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["pdv-historico", storeId, sessionId, limit],
    queryFn: async () => {
      let query = supabase
        .from("pdv_movements" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (sessionId) query = query.eq("session_id", sessionId);
      else if (storeId) query = query.eq("store_id", storeId);

      const { data } = await query;
      return (data || []) as any[];
    },
    enabled: !!(storeId || sessionId),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">Nenhuma movimentação registrada</p>
        <p className="text-xs mt-1">Vendas, sangrias e suprimentos vão aparecer aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {movements.map((m) => {
        if (m.type === "sale") {
          const pm = PAYMENT_LABELS[m.payment_method] || { label: m.payment_method || "—", icon: Receipt, color: "text-muted-foreground" };
          const Icon = pm.icon;
          return (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:bg-muted/20 transition-colors">
              <div className={`w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0`}>
                <Receipt className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-foreground">Venda</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    <Icon className={`h-2.5 w-2.5 ${pm.color}`} />
                    {pm.label}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {formatTime(m.created_at)}
                  {m.description && (
                    <>
                      <span>·</span>
                      <span className="truncate">{m.description}</span>
                    </>
                  )}
                </p>
              </div>
              <p className="text-sm font-black text-emerald-500 shrink-0">
                {formatBRL(Number(m.amount))}
              </p>
            </div>
          );
        }

        if (m.type === "sangria") {
          return (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-red-500/20">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <ArrowDownCircle className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">Sangria</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {formatTime(m.created_at)}
                  {m.description && (
                    <>
                      <span>·</span>
                      <span className="truncate">{m.description}</span>
                    </>
                  )}
                </p>
              </div>
              <p className="text-sm font-black text-red-500 shrink-0">
                −{formatBRL(Number(m.amount))}
              </p>
            </div>
          );
        }

        // Suprimento
        return (
          <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-blue-500/20">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <ArrowUpCircle className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Suprimento</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                {formatTime(m.created_at)}
                {m.description && (
                  <>
                    <span>·</span>
                    <span className="truncate">{m.description}</span>
                  </>
                )}
              </p>
            </div>
            <p className="text-sm font-black text-blue-500 shrink-0">
              +{formatBRL(Number(m.amount))}
            </p>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Lista de turnos passados da loja (para consulta)
 */
export const PdvSessionsList = ({ storeId, limit = 20 }: { storeId: string; limit?: number }) => {

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["pdv-sessions-list", storeId, limit],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_sessions" as any)
        .select("*")
        .eq("store_id", storeId)
        .eq("status", "closed")
        .order("opened_at", { ascending: false })
        .limit(limit);
      return (data || []) as any[];
    },
    enabled: !!storeId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">Nenhum turno fechado ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const opening = Number(s.opening_amount || 0);
        const closing = Number(s.closing_amount || 0);
        const diff = closing - opening;
        const opened = formatDateTime(s.opened_at);
        const closed = s.closed_at ? formatDateTime(s.closed_at) : "—";

        return (
          <div key={s.id} className="p-3 rounded-xl bg-card border border-border/50 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                {opened}
              </p>
              <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                Fechado
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Abertura</p>
                <p className="text-xs font-bold text-foreground">{formatBRL(opening)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Fechamento</p>
                <p className="text-xs font-bold text-foreground">{formatBRL(closing)}</p>
              </div>
              <div className={`rounded-lg p-2 ${Math.abs(diff) < 0.05 ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                <p className="text-[10px] text-muted-foreground">Diferença</p>
                <p className={`text-xs font-bold ${Math.abs(diff) < 0.05 ? "text-emerald-500" : "text-amber-500"}`}>
                  {Math.abs(diff) < 0.05 ? "OK" : formatBRL(diff)}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-right">Fechado às {closed}</p>
          </div>
        );
      })}
    </div>
  );
};
