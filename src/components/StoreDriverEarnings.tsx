import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Wallet, Clock, CheckCircle2, Bike, Loader2, BadgeCheck } from "lucide-react";

/**
 * Acertos do motoboy com as lojas.
 *
 * O ItaSuper é o software que conecta motoboy e lojista: não define, não
 * intermedeia e não tem ciência do valor combinado entre os dois. A tela conta
 * entregas e registra a confirmação do acerto, mas nunca exibe valor a receber
 * — o combinado é feito diretamente com a loja. Ver "Não vinculação" nos
 * Termos de Uso.
 *
 * `store_driver_earnings.driver_amount` / `platform_cut` são legado do modelo
 * antigo (plataforma retinha R$ 2,00 por entrega) e não devem voltar à UI.
 */

interface Props {
  storeIds: string[];
}

const StoreDriverEarnings = ({ storeIds }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["store-driver-earnings", user?.id, storeIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_driver_earnings" as any)
        .select("id, store_id, order_id, status, paid_at, created_at, store_marked_paid_at")
        .eq("driver_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const confirmReceived = async (earningId: string) => {
    setConfirmingId(earningId);
    try {
      const { error } = await supabase.rpc("driver_confirm_earning_received" as any, {
        _earning_id: earningId,
      });
      if (error) throw error;
      toast.success("Acerto confirmado!");
      queryClient.invalidateQueries({ queryKey: ["store-driver-earnings"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao confirmar.");
    } finally {
      setConfirmingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const list = data || [];
  const pending = list.filter((e) => e.status === "pendente");
  const awaiting = list.filter((e) => e.status === "aguardando_confirmacao");
  const settled = list.filter((e) => e.status === "pago");

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-warning/5 border border-warning/25 rounded-2xl p-3">
          <Clock className="h-4 w-4 text-warning mb-1" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase">A Acertar</p>
          <p className="text-base font-black text-foreground mt-0.5">{pending.length}</p>
        </div>
        <div className="bg-success/5 border border-success/25 rounded-2xl p-3">
          <CheckCircle2 className="h-4 w-4 text-success mb-1" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Acertadas</p>
          <p className="text-base font-black text-foreground mt-0.5">{settled.length}</p>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3">
          <Bike className="h-4 w-4 text-primary mb-1" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Entregas</p>
          <p className="text-base font-black text-foreground mt-0.5">{list.length}</p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="bg-warning/5 border border-warning/25 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-warning" />
            <p className="text-sm font-bold text-foreground">Acerto pendente com a loja</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Você tem <strong className="text-foreground">{pending.length}</strong> entregas ainda não acertadas.
            O valor é o que você combinou com a loja e o pagamento é feito diretamente por ela — o ItaSuper
            não participa dessa negociação.
          </p>
        </div>
      )}

      {/* Awaiting confirmation - driver action required */}
      {awaiting.length > 0 && (
        <div className="bg-primary/10 border-2 border-primary/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
            <p className="text-sm font-bold text-foreground">A loja registrou o acerto — confirme!</p>
          </div>
          <p className="text-xs text-muted-foreground">
            O lojista registrou <strong className="text-foreground">{awaiting.length}</strong> entregas como
            acertadas. Confirme se você realmente recebeu o combinado para fechar.
          </p>
          <div className="space-y-2">
            {awaiting.map((e) => (
              <div key={e.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">
                    Pedido #{String(e.order_id).slice(0, 6).toUpperCase()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Marcado em{" "}
                    {e.store_marked_paid_at
                      ? new Date(e.store_marked_paid_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                      : "—"}
                  </p>
                </div>
                <button
                  onClick={() => confirmReceived(e.id)}
                  disabled={confirmingId === e.id}
                  className="bg-success text-success-foreground px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 flex items-center gap-1 active:scale-95"
                >
                  {confirmingId === e.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  Recebi
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent deliveries */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
          Últimas Entregas
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
              </p>
            </div>
            <span
              className={`text-[9px] font-bold uppercase ${
                e.status === "pago" ? "text-success" : "text-warning"
              }`}
            >
              {e.status === "pago" ? "✓ Acertada" : "⏳ A acertar"}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground text-center px-3 leading-relaxed">
        O valor de cada entrega é combinado diretamente entre você e a loja. O ItaSuper não define,
        não intermedeia e não tem acesso a esses valores.
      </p>
    </div>
  );
};

export default StoreDriverEarnings;
