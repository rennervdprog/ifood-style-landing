import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { Wallet, CheckCircle2, Loader2, DollarSign, Banknote } from "lucide-react";

interface Props {
  storeId: string;
}

interface Earning {
  id: string;
  driver_user_id: string;
  order_id: string;
  fee_total: number;
  platform_cut: number;
  driver_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

const StoreDriverFinance = ({ storeId }: Props) => {
  const queryClient = useQueryClient();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [bulkDriverId, setBulkDriverId] = useState<string | null>(null);

  const { data: earnings, isLoading } = useQuery({
    queryKey: ["store-driver-finance", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_driver_earnings" as any)
        .select("id, driver_user_id, order_id, fee_total, platform_cut, driver_amount, status, paid_at, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as unknown as Earning[]) || [];
    },
  });

  // Fetch driver names
  const driverIds = Array.from(new Set((earnings || []).map((e) => e.driver_user_id)));
  const { data: profiles } = useQuery({
    queryKey: ["store-driver-finance-profiles", driverIds],
    queryFn: async () => {
      if (!driverIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, whatsapp_number, pix_key, pix_type")
        .in("user_id", driverIds);
      return data || [];
    },
    enabled: driverIds.length > 0,
  });

  const getProfile = (id: string) => profiles?.find((p) => p.user_id === id);

  const markPaid = async (earningId: string) => {
    setPayingId(earningId);
    try {
      const { error } = await supabase.rpc("mark_store_driver_earning_paid" as any, {
        _earning_id: earningId,
        _notes: null,
      });
      if (error) throw error;
      toast.success("Pagamento registrado!");
      queryClient.invalidateQueries({ queryKey: ["store-driver-finance", storeId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar pagamento.");
    } finally {
      setPayingId(null);
    }
  };

  const payAllForDriver = async (driverId: string, name: string) => {
    if (!confirm(`Marcar TODAS as entregas pendentes de ${name} como pagas?`)) return;
    setBulkDriverId(driverId);
    try {
      const { data, error } = await supabase.rpc("mark_all_store_driver_earnings_paid" as any, {
        _driver_user_id: driverId,
        _store_id: storeId,
      });
      if (error) throw error;
      toast.success(`${data || 0} entregas marcadas como pagas.`);
      queryClient.invalidateQueries({ queryKey: ["store-driver-finance", storeId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar pagamentos.");
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

  const list = earnings || [];
  const pending = list.filter((e) => e.status === "pendente");
  const paid = list.filter((e) => e.status === "pago");

  const pendingTotal = pending.reduce((s, e) => s + Number(e.driver_amount), 0);
  const paidTotal = paid.reduce((s, e) => s + Number(e.driver_amount), 0);

  // Group pending by driver
  const byDriver = pending.reduce<Record<string, Earning[]>>((acc, e) => {
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
          <h2 className="text-lg font-bold text-foreground">Finanças dos Motoboys</h2>
          <p className="text-xs text-muted-foreground">Controle os acertos com seus entregadores</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4">
        <p className="text-xs text-muted-foreground">
          💡 O valor que aparece para o motoboy é a <strong>taxa de entrega que você define</strong> menos a taxa
          fixa da plataforma (R$2,00 por entrega). O pagamento é feito manualmente por você ao motoboy.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
          <DollarSign className="h-4 w-4 text-amber-500 mb-1" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase">A Pagar</p>
          <p className="text-xl font-black text-foreground mt-1">{formatBRL(pendingTotal)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{pending.length} entregas pendentes</p>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 mb-1" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Já Pago</p>
          <p className="text-xl font-black text-foreground mt-1">{formatBRL(paidTotal)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{paid.length} entregas</p>
        </div>
      </div>

      {/* Pending grouped by driver */}
      {Object.keys(byDriver).length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground bg-card border border-border rounded-2xl">
          🎉 Nenhum pagamento pendente!
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
            Pagamentos Pendentes
          </p>
          {Object.entries(byDriver).map(([driverId, items]) => {
            const profile = getProfile(driverId);
            const total = items.reduce((s, e) => s + Number(e.driver_amount), 0);
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
                      {profile?.pix_key && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                          PIX ({profile.pix_type}): {profile.pix_key}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-foreground">{formatBRL(total)}</p>
                      <p className="text-[10px] text-muted-foreground">{items.length} entregas</p>
                    </div>
                  </div>
                  <button
                    onClick={() => payAllForDriver(driverId, name)}
                    disabled={bulkDriverId === driverId}
                    className="w-full bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    {bulkDriverId === driverId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Banknote className="h-4 w-4" />
                    )}
                    Quitar Tudo ({formatBRL(total)})
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
                          {" · Taxa "}
                          {formatBRL(Number(e.fee_total))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-foreground">
                          {formatBRL(Number(e.driver_amount))}
                        </span>
                        <button
                          onClick={() => markPaid(e.id)}
                          disabled={payingId === e.id}
                          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 flex items-center gap-1"
                        >
                          {payingId === e.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Pago
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History */}
      {paid.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
            Últimos Pagamentos
          </p>
          {paid.slice(0, 15).map((e) => {
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
                    Pago em{" "}
                    {e.paid_at
                      ? new Date(e.paid_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })
                      : "—"}
                  </p>
                </div>
                <span className="text-sm font-black text-emerald-500">
                  {formatBRL(Number(e.driver_amount))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoreDriverFinance;
