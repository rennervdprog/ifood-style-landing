import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils";
import { Wallet, Clock, CheckCircle2, TrendingUp, Loader2 } from "lucide-react";

interface Props {
  storeIds: string[];
}

const StoreDriverEarnings = ({ storeIds }: Props) => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["store-driver-earnings", user?.id, storeIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_driver_earnings" as any)
        .select("id, store_id, order_id, fee_total, platform_cut, driver_amount, status, paid_at, created_at")
        .eq("driver_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const list = data || [];
  const pending = list.filter((e) => e.status === "pendente");
  const paid = list.filter((e) => e.status === "pago");
  const pendingTotal = pending.reduce((s, e) => s + Number(e.driver_amount || 0), 0);
  const paidTotal = paid.reduce((s, e) => s + Number(e.driver_amount || 0), 0);
  const totalEarned = pendingTotal + paidTotal;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3">
          <Clock className="h-4 w-4 text-amber-500 mb-1" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase">A Receber</p>
          <p className="text-base font-black text-foreground mt-0.5">{formatBRL(pendingTotal)}</p>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 mb-1" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Recebido</p>
          <p className="text-base font-black text-foreground mt-0.5">{formatBRL(paidTotal)}</p>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3">
          <TrendingUp className="h-4 w-4 text-primary mb-1" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Total</p>
          <p className="text-base font-black text-foreground mt-0.5">{formatBRL(totalEarned)}</p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-bold text-foreground">Acerto pendente com a loja</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Você tem <strong className="text-foreground">{formatBRL(pendingTotal)}</strong> a receber em{" "}
            <strong className="text-foreground">{pending.length}</strong> entregas. O pagamento é feito diretamente pelo lojista.
          </p>
        </div>
      )}

      {/* Recent earnings */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
          Últimas Entregas Pagas
        </p>
        {list.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Você ainda não tem entregas registradas.
          </div>
        )}
        {list.slice(0, 20).map((e) => (
          <div
            key={e.id}
            className="bg-card border border-border rounded-xl p-3 flex items-center justify-between"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">
                Pedido #{String(e.order_id).slice(0, 6).toUpperCase()}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(e.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                {" • "}
                Taxa: {formatBRL(Number(e.fee_total))} · Plataforma: {formatBRL(Number(e.platform_cut))}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-foreground">{formatBRL(Number(e.driver_amount))}</p>
              <span
                className={`text-[9px] font-bold uppercase ${
                  e.status === "pago" ? "text-emerald-500" : "text-amber-500"
                }`}
              >
                {e.status === "pago" ? "✓ Recebido" : "⏳ Pendente"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StoreDriverEarnings;
