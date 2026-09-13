import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, CheckCircle2, Loader2, Bike } from "lucide-react";

/**
 * Controle de acerto entre lojista e motoboy.
 *
 * O ItaSuper é o software que conecta os dois: não define, não intermedeia e
 * não tem ciência do valor combinado entre lojista e motoboy. Por isso esta
 * tela conta entregas e registra o acerto, mas nunca calcula nem exibe valor
 * a pagar — quem combina o preço da corrida são as duas partes, fora da
 * plataforma. Ver "Não vinculação" nos Termos de Uso.
 *
 * `store_driver_earnings.driver_amount` / `platform_cut` são legado do modelo
 * antigo (plataforma retinha R$ 2,00 por entrega) e não devem voltar à UI.
 */

interface Props {
  storeId: string;
}

interface Delivery {
  id: string;
  driver_user_id: string;
  order_id: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

const StoreDriverFinance = ({ storeId }: Props) => {
  const queryClient = useQueryClient();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [bulkDriverId, setBulkDriverId] = useState<string | null>(null);

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ["store-driver-finance", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_driver_earnings" as any)
        .select("id, driver_user_id, order_id, status, paid_at, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as unknown as Delivery[]) || [];
    },
  });

  // Fetch driver names
  const driverIds = Array.from(new Set((deliveries || []).map((e) => e.driver_user_id)));
  const { data: profiles } = useQuery({
    queryKey: ["store-driver-finance-profiles", driverIds],
    queryFn: async () => {
      if (!driverIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, whatsapp_number")
        .in("user_id", driverIds);
      return data || [];
    },
    enabled: driverIds.length > 0,
  });

  const getProfile = (id: string) => profiles?.find((p) => p.user_id === id);

  const markSettled = async (earningId: string) => {
    setPayingId(earningId);
    try {
      const { error } = await supabase.rpc("store_mark_driver_earning_paid" as any, {
        _earning_id: earningId,
        _notes: null,
      });
      if (error) throw error;
      toast.success("Acerto registrado! Aguardando confirmação do motoboy.");
      queryClient.invalidateQueries({ queryKey: ["store-driver-finance", storeId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar o acerto.");
    } finally {
      setPayingId(null);
    }
  };

  const settleAllForDriver = async (driverId: string, name: string) => {
    if (!confirm(`Registrar TODAS as entregas pendentes de ${name} como acertadas? O motoboy precisará confirmar.`)) return;
    setBulkDriverId(driverId);
    try {
      const { data, error } = await supabase.rpc("store_mark_all_driver_earnings_paid" as any, {
        _driver_user_id: driverId,
        _store_id: storeId,
      });
      if (error) throw error;
      toast.success(`${data || 0} entregas enviadas para confirmação.`);
      queryClient.invalidateQueries({ queryKey: ["store-driver-finance", storeId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar os acertos.");
    } finally {
      setBulkDriverId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const list = deliveries || [];
  const pending = list.filter((e) => e.status === "pendente");
  const awaiting = list.filter((e) => e.status === "aguardando_confirmacao");
  const settled = list.filter((e) => e.status === "pago");

  // Group pending by driver
  const byDriver = pending.reduce<Record<string, Delivery[]>>((acc, e) => {
    (acc[e.driver_user_id] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Wallet className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Acertos com Motoboys</h2>
          <p className="text-xs text-muted-foreground">Controle das entregas já acertadas</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4">
        <p className="text-xs text-muted-foreground">
          💡 O valor de cada entrega é combinado <strong>diretamente entre você e o motoboy</strong> — o
          ItaSuper não define, não intermedeia e não tem acesso a esses valores. Esta tela serve apenas
          para vocês dois controlarem quais entregas já foram acertadas.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3">
          <Bike className="h-4 w-4 text-amber-500 mb-1" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase">A Acertar</p>
          <p className="text-base font-black text-foreground mt-1">{pending.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">entregas</p>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3">
          <Loader2 className="h-4 w-4 text-blue-500 mb-1" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Aguardando</p>
          <p className="text-base font-black text-foreground mt-1">{awaiting.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">a confirmar</p>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 mb-1" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Acertadas</p>
          <p className="text-base font-black text-foreground mt-1">{settled.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">entregas</p>
        </div>
      </div>

      {/* Awaiting confirmation list */}
      {awaiting.length > 0 && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5" /> Aguardando confirmação do motoboy ({awaiting.length})
          </p>
          <p className="text-[11px] text-muted-foreground">
            Você registrou estas entregas como acertadas. O motoboy precisa confirmar no app dele.
          </p>
          <div className="space-y-1.5 mt-2">
            {awaiting.slice(0, 8).map((e) => {
              const profile = getProfile(e.driver_user_id);
              return (
                <div key={e.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground font-medium">
                    {profile?.full_name || "Motoboy"} · #{e.order_id.slice(0, 6).toUpperCase()}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending grouped by driver */}
      {Object.keys(byDriver).length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground bg-card border border-border rounded-2xl">
          🎉 Nenhuma entrega pendente de acerto!
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
            Entregas Pendentes de Acerto
          </p>
          {Object.entries(byDriver).map(([driverId, items]) => {
            const profile = getProfile(driverId);
            const name = profile?.full_name || "Motoboy";
            return (
              <div key={driverId} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-foreground">{name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {profile?.phone || profile?.whatsapp_number || "Sem telefone"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-foreground">{items.length}</p>
                      <p className="text-[10px] text-muted-foreground">entregas</p>
                    </div>
                  </div>
                  <button
                    onClick={() => settleAllForDriver(driverId, name)}
                    disabled={bulkDriverId === driverId}
                    className="w-full bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    {bulkDriverId === driverId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Marcar todas como acertadas ({items.length})
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {items.map((e) => (
                    <div key={e.id} className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">
                          #{e.order_id.slice(0, 6).toUpperCase()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(e.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => markSettled(e.id)}
                        disabled={payingId === e.id}
                        className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 flex items-center gap-1"
                      >
                        {payingId === e.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        Acertado
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History */}
      {settled.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
            Últimos Acertos
          </p>
          {settled.slice(0, 15).map((e) => {
            const profile = getProfile(e.driver_user_id);
            return (
              <div
                key={e.id}
                className="bg-card border border-border rounded-xl p-3 flex items-center justify-between opacity-80"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">
                    {profile?.full_name || "Motoboy"} · #{e.order_id.slice(0, 6).toUpperCase()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Acertado em{" "}
                    {e.paid_at
                      ? new Date(e.paid_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })
                      : "—"}
                  </p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoreDriverFinance;
