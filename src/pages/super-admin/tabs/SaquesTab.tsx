import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { Bell, Wallet, Clock, DollarSign, Trash2, CheckCircle2 } from "lucide-react";

const SaquesTab = ({
  withdrawalRequests,
  pendingWithdrawals,
  drivers,
  queryClient,
}: {
  withdrawalRequests: any[] | undefined;
  pendingWithdrawals: any[];
  drivers: any[] | undefined;
  queryClient: any;
}) => {
  const [saquesSubTab, setSaquesSubTab] = useState<"pendentes" | "historico">("pendentes");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pendingList = pendingWithdrawals;
  const historyList = (withdrawalRequests || []).filter((w: any) => w.status !== "solicitado");

  const handleDelete = async (req: any) => {
    if (deletingId !== req.id) {
      setDeletingId(req.id);
      setTimeout(() => setDeletingId((cur) => (cur === req.id ? null : cur)), 4000);
      return;
    }
    const { error } = await supabase.from("withdrawal_requests" as any).delete().eq("id", req.id);
    if (error) { toast.error("Erro ao excluir."); return; }
    toast.success("Solicitação excluída.");
    setDeletingId(null);
    queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
  };

  const handleConfirmPayment = async (req: any, driverName: string) => {
    const { error: updateError } = await supabase
      .from("withdrawal_requests" as any)
      .update({ status: "pago", processed_at: new Date().toISOString() } as any)
      .eq("id", req.id);
    if (updateError) { toast.error("Erro ao confirmar."); return; }
    const { data: currentBalance } = await supabase
      .from("driver_balances" as any)
      .select("paid_amount")
      .eq("driver_user_id", req.driver_user_id)
      .single();
    const previousPaid = Number((currentBalance as any)?.paid_amount || 0);
    const { error: balanceError } = await supabase
      .from("driver_balances" as any)
      .update({
        pending_amount: 0,
        paid_amount: previousPaid + Number(req.amount),
        updated_at: new Date().toISOString()
      } as any)
      .eq("driver_user_id", req.driver_user_id);
    if (balanceError) console.error("Balance update error:", balanceError);
    await supabase.from("driver_earnings" as any).update({ status: "pago" } as any)
      .eq("driver_user_id", req.driver_user_id).eq("status", "pendente");
    toast.success(`✅ ${formatBRL(Number(req.amount))} para ${driverName} confirmada!`);
    queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
  };

  const renderCard = (req: any) => {
    const isPending = req.status === "solicitado";
    const isPaid = req.status === "pago";
    const driverName = drivers?.find((d: any) => d.user_id === req.driver_user_id)?.name || "Entregador";

    return (
      <div key={req.id} className={`bg-card rounded-2xl p-4 border ${isPending ? "border-amber-500/30" : "border-border"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPending ? "bg-amber-500/20" : isPaid ? "bg-green-500/20" : "bg-destructive/20"}`}>
              <DollarSign className={`h-4 w-4 ${isPending ? "text-amber-500" : isPaid ? "text-green-500" : "text-destructive"}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{driverName}</p>
              <p className="text-xs text-muted-foreground font-bold">
                {req.transaction_code && <span className="text-primary mr-1">{req.transaction_code}</span>}
                {formatBRL(Number(req.amount))}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(req.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isPending ? "bg-amber-500/20 text-amber-500" : isPaid ? "bg-green-500/20 text-green-500" : "bg-destructive/20 text-destructive"}`}>
              {isPending ? "Pendente" : isPaid ? "✅ Pago" : "Cancelado"}
            </span>
            <button onClick={() => handleDelete(req)}
              className={`p-2 rounded-lg transition-colors ${deletingId === req.id ? "bg-destructive text-destructive-foreground" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}
              title={deletingId === req.id ? "Clique para confirmar" : "Excluir"}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {deletingId === req.id && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-3 text-center">
            <p className="text-xs text-destructive font-medium">Deseja excluir? Clique na 🗑️ novamente.</p>
          </div>
        )}
        <div className="bg-muted rounded-xl p-3 space-y-1 mb-3">
          <p className="text-xs text-muted-foreground">Entregador: <span className="text-foreground font-medium">{driverName}</span></p>
          <p className="text-xs text-muted-foreground">Valor: <span className="text-foreground font-bold">{formatBRL(Number(req.amount))}</span></p>
          <p className="text-xs text-muted-foreground">PIX: <span className="text-foreground font-medium">{req.pix_key}</span></p>
          <p className="text-xs text-muted-foreground">Tipo: <span className="text-foreground font-medium">{req.pix_type?.toUpperCase()}</span></p>
          {req.processed_at && (
            <p className="text-xs text-muted-foreground">Processado: <span className="text-foreground font-medium">
              {new Date(req.processed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span></p>
          )}
        </div>
        {isPending && (
          <button onClick={() => handleConfirmPayment(req, driverName)}
            className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform">
            <CheckCircle2 className="h-4 w-4" /> Confirmar Pagamento
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Bell className="h-4 w-4" /> Solicitações de Saque
          </h2>
          <button onClick={async () => {
            const { data, error } = await supabase.rpc("admin_cleanup_duplicate_withdrawals");
            if (error) { toast.error("Erro ao limpar."); return; }
            toast.success(`${Number(data || 0)} duplicata(s) removida(s).`);
            queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
          }} className="px-3 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold">
            Limpar Duplicatas
          </button>
        </div>
        <div className="flex gap-2">
          {[
            { key: "pendentes" as const, label: `⏳ Pendentes (${pendingList.length})` },
            { key: "historico" as const, label: `📋 Histórico (${historyList.length})` },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setSaquesSubTab(tab.key)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold transition-colors ${
                saquesSubTab === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {saquesSubTab === "pendentes" ? (
        pendingList.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center border border-border">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
          </div>
        ) : <div className="space-y-3">{pendingList.map(renderCard)}</div>
      ) : historyList.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center border border-border">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum saque no histórico.</p>
        </div>
      ) : <div className="space-y-3">{historyList.map(renderCard)}</div>}
    </div>
  );
};

export default SaquesTab;
