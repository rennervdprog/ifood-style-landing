import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { statusColors as globalStatusColors } from "@/lib/orderStatus";
import { CreditCard, Store, CheckCircle2, Receipt, ChevronUp, ChevronDown, Wallet, Copy } from "lucide-react";
import { AlertTriangle } from "lucide-react";

const PagamentosSplitTab = ({ stores }: { stores: any[] }) => {
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dead-letter: pedidos com erro no split (repasse falhou e ficou preso)
  const { data: failedSplits } = useQuery({
    queryKey: ["orders-failed-splits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, store_id, subtotal, store_payout_error, store_payout_id, created_at, status")
        .not("store_payout_error", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["financial-transactions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: payoutHistoryAll } = useQuery({
    queryKey: ["payout-history-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const storeGroups = useMemo(() => {
    if (!transactions) return [];
    const map = new Map<string, { storeName: string; storeId: string; records: any[]; totalPaid: number; totalPending: number }>();
    
    transactions.forEach((tx: any) => {
      const store = stores?.find(s => s.id === tx.store_id);
      const storeName = store?.name || "Loja Desconhecida";
      if (!map.has(tx.store_id)) {
        map.set(tx.store_id, { storeName, storeId: tx.store_id, records: [], totalPaid: 0, totalPending: 0 });
      }
      const group = map.get(tx.store_id)!;
      group.records.push(tx);
      if (tx.status === "paid" || tx.status === "approved") {
        group.totalPaid += Number(tx.amount);
      } else if (tx.status === "pending") {
        group.totalPending += Number(tx.amount);
      }
    });

    // Also add payout_history records
    payoutHistoryAll?.forEach((ph: any) => {
      if (ph.entity_type === "store") {
        const existing = map.get(ph.entity_id);
        if (existing) {
          existing.records.push({ ...ph, _source: "payout_history", transaction_kind: "store_payout", status: "paid", amount: ph.amount });
        }
      }
    });

    // Sort records inside each group
    map.forEach(group => {
      group.records.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });

    return Array.from(map.values()).sort((a, b) => b.records.length - a.records.length);
  }, [transactions, stores, payoutHistoryAll]);

  const copyReceipt = (record: any) => {
    const kindLabels: Record<string, string> = { store_payout: "Repasse", commission_charge: "Comissão", driver_payout: "Repasse Motoboy" };
    const statusLabels: Record<string, string> = { pending: "Pendente", approved: "Aprovado", paid: "Pago", failed: "Falhou", cancelled: "Cancelado" };
    
    let receipt = `📄 *Comprovante de Pagamento*\n\n`;
    receipt += `Tipo: ${kindLabels[record.transaction_kind] || record.transaction_kind}\n`;
    receipt += `Valor: ${formatBRL(Number(record.amount))}\n`;
    receipt += `Status: ${statusLabels[record.status] || record.status}\n`;
    receipt += `Referência: ${record.reference_code || record.transaction_code || "N/A"}\n`;
    receipt += `Data: ${new Date(record.created_at).toLocaleString("pt-BR")}\n`;
    
    if (record.mercado_pago_payment_id) receipt += `ID Mercado Pago: ${record.mercado_pago_payment_id}\n`;
    if (record.pix_copy_paste) receipt += `\nPIX Copia e Cola:\n${record.pix_copy_paste}\n`;
    
    const meta = record.metadata || {};
    if (meta.pix_key) receipt += `Chave PIX: ${meta.pix_key} (${meta.pix_type || ""})\n`;
    if (meta.store_name) receipt += `Loja: ${meta.store_name}\n`;
    if (record.notes) receipt += `Obs: ${record.notes}\n`;
    if (record.settled_at) receipt += `Liquidado em: ${new Date(record.settled_at).toLocaleString("pt-BR")}\n`;

    receipt += `\n---\nServiços financeiros processados pela ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTOS S.A., autorizada pelo Banco Central do Brasil.\nSuporte Asaas: 0800 009 0037 | contato@asaas.com.br\n`;

    navigator.clipboard.writeText(receipt);
    setCopiedId(record.id);
    toast.success("Comprovante copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const kindLabels: Record<string, string> = { store_payout: "Repasse", commission_charge: "Comissão", driver_payout: "Repasse Motoboy" };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-card rounded-2xl animate-pulse border border-border" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dead-letter: repasses com erro */}
      {failedSplits && failedSplits.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/40 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-bold text-destructive">
              Repasses com falha ({failedSplits.length})
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Pedidos cujo repasse automático falhou — revisar manualmente no Asaas antes de reprocessar.
          </p>
          <div className="space-y-2 max-h-64 overflow-auto">
            {failedSplits.map((o: any) => {
              const store = stores?.find((s) => s.id === o.store_id);
              return (
                <div key={o.id} className="bg-card rounded-lg p-3 text-xs border border-destructive/20">
                  <div className="flex justify-between gap-2 mb-1">
                    <span className="font-semibold truncate">{store?.name || "Loja"}</span>
                    <span className="text-muted-foreground shrink-0">
                      {new Date(o.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    Pedido #{String(o.id).slice(0, 8)} · {formatBRL(Number(o.subtotal || 0))} · status: {o.status}
                  </div>
                  <div className="mt-1 text-destructive/90 break-all">{o.store_payout_error}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Transações</span>
          </div>
          <p className="text-lg font-black text-foreground">{transactions?.length || 0}</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <Store className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Lojas</span>
          </div>
          <p className="text-lg font-black text-foreground">{storeGroups.length}</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground">Total Pago</span>
          </div>
          <p className="text-lg font-black text-emerald-500">
            {formatBRL(storeGroups.reduce((acc, g) => acc + g.totalPaid, 0))}
          </p>
        </div>
      </div>

      {/* Store list */}
      {storeGroups.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center border border-border">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma transação registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {storeGroups.map((group) => {
            const isExpanded = expandedStore === group.storeId;
            return (
              <div key={group.storeId} className="bg-card rounded-2xl border border-border overflow-hidden">
                {/* Store header */}
                <button
                  onClick={() => setExpandedStore(isExpanded ? null : group.storeId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">{group.storeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.records.length} registro{group.records.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {group.totalPaid > 0 && (
                        <p className="text-sm font-bold text-emerald-500">{formatBRL(group.totalPaid)}</p>
                      )}
                      {group.totalPending > 0 && (
                        <p className="text-xs text-amber-500 font-bold">{formatBRL(group.totalPending)} pend.</p>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded records */}
                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {group.records.map((record: any, idx: number) => (
                      <div key={record.id || idx} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${globalStatusColors[record.status]?.bg ?? "bg-muted"} ${globalStatusColors[record.status]?.text ?? "text-muted-foreground"}`}>
                                {globalStatusColors[record.status]?.label || record.status}
                              </span>
                            <span className="text-xs font-bold text-foreground">
                              {kindLabels[record.transaction_kind] || record.transaction_kind}
                            </span>
                          </div>
                          <span className="text-sm font-black text-foreground">{formatBRL(Number(record.amount))}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-muted-foreground">Referência</p>
                            <p className="font-bold text-foreground truncate">{record.reference_code || record.transaction_code || "—"}</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-muted-foreground">Data</p>
                            <p className="font-bold text-foreground">
                              {new Date(record.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>

                        {/* PIX info */}
                        {record.pix_copy_paste && (
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-[10px] text-muted-foreground mb-1">PIX Copia e Cola</p>
                            <p className="text-xs text-foreground break-all font-mono">{record.pix_copy_paste.substring(0, 80)}...</p>
                          </div>
                        )}

                        {/* Metadata PIX key */}
                        {record.metadata?.pix_key && (
                          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                            <Wallet className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                            <p className="text-xs text-foreground truncate">
                              {record.metadata.pix_type}: {record.metadata.pix_key}
                            </p>
                          </div>
                        )}

                        {/* MP payment ID */}
                        {record.mercado_pago_payment_id && (
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-[10px] text-muted-foreground">ID Pagamento</p>
                            <p className="text-xs font-bold text-foreground">{record.mercado_pago_payment_id}</p>
                          </div>
                        )}

                        {/* Notes from payout_history */}
                        {record.notes && (
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-[10px] text-muted-foreground">Observações</p>
                            <p className="text-xs text-foreground">{record.notes}</p>
                          </div>
                        )}

                        {/* Copy receipt button */}
                        <button
                          onClick={() => copyReceipt(record)}
                          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                            copiedId === record.id
                              ? "bg-emerald-500/20 text-emerald-600"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                        >
                          {copiedId === record.id ? (
                            <><CheckCircle2 className="h-3.5 w-3.5" /> Copiado!</>
                          ) : (
                            <><Copy className="h-3.5 w-3.5" /> Copiar Comprovante</>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PagamentosSplitTab;
