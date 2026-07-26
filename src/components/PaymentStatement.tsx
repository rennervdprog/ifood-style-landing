import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, ChevronDown, ChevronUp, CheckCircle2, Clock, XCircle,
  Copy, Filter, Download, Receipt, TrendingDown, TrendingUp, Wallet, Eye, X
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

 interface Props {
   storeId: string;
   storeName?: string;
   initialOpen?: boolean;
 }

const statusMeta: Record<string, { label: string; icon: any; cls: string }> = {
  paid: { label: "Pago", icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  settled: { label: "Liquidado", icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  pending: { label: "Pendente", icon: Clock, cls: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  failed: { label: "Falhou", icon: XCircle, cls: "text-red-600 bg-red-500/10 border-red-500/20" },
  cancelled: { label: "Cancelada", icon: XCircle, cls: "text-muted-foreground bg-muted border-border" },
};

const kindMeta: Record<string, { label: string; emoji: string; color: string }> = {
  commission_charge:  { label: "Repasse físico (dinheiro/cartão/PIX maq.)", emoji: "💳", color: "text-amber-600" },
  monthly_fee:        { label: "Mensalidade", emoji: "📅", color: "text-primary" },
  store_payout:       { label: "Repasse de venda PIX Online", emoji: "💸", color: "text-emerald-600" },
  withdrawal:         { label: "Saque", emoji: "🏦", color: "text-blue-600" },
  refund:             { label: "Reembolso ao cliente", emoji: "↩️", color: "text-amber-600" },
  platform_fee:       { label: "Taxa da plataforma", emoji: "🏷️", color: "text-purple-600" },
  delivery_fee:       { label: "Taxa de entrega", emoji: "🛵", color: "text-orange-600" },
  physical_fee:       { label: "Repasse físico (dinheiro/cartão/PIX maq.)", emoji: "💳", color: "text-amber-600" },
};

type FilterType = "all" | "paid" | "pending" | "failed";

 const PaymentStatement = ({ storeId, storeName, initialOpen = false }: Props) => {
   const [open, setOpen] = useState(initialOpen);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [kindFilter, setKindFilter] = useState<string>("all");

  const { data: txs, isLoading } = useQuery({
    queryKey: ["payment-statement", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select(`
          id, reference_code, amount, status, transaction_kind, created_at, settled_at, 
          pix_copy_paste, pix_qr_code_base64, provider, metadata
        `)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!storeId,
    refetchInterval: open ? 30000 : false,
  });

  const kinds = useMemo(() => {
    const set = new Set<string>();
    (txs || []).forEach((t: any) => set.add(t.transaction_kind));
    return Array.from(set);
  }, [txs]);

  // Resumo de pagamentos confirmados (status paid/settled)
  const paidSummary = useMemo(() => {
    const paid = (txs || []).filter((t: any) => ['paid', 'settled'].includes(t.status));
    const totalPaid = paid.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const physicalRepasses = paid.filter((t: any) => ['commission_charge', 'physical_fee'].includes(t.transaction_kind));
    const pixRepassess = paid.filter((t: any) => t.transaction_kind === 'store_payout');
    return {
      total: totalPaid,
      count: paid.length,
      physicalCount: physicalRepasses.length,
      pixCount: pixRepassess.length,
    };
  }, [txs]);

  const filtered = useMemo(() => {
    return (txs || []).filter((t: any) => {
      if (filter === "paid" && !["paid", "settled"].includes(t.status)) return false;
      if (filter === "pending" && t.status !== "pending") return false;
      if (filter === "failed" && !["failed", "cancelled"].includes(t.status)) return false;
      if (kindFilter !== "all" && t.transaction_kind !== kindFilter) return false;
      return true;
    });
  }, [txs, filter, kindFilter]);

  const totals = useMemo(() => {
    const list = filtered;
    const paidTotal = list
      .filter((t: any) => ["paid", "settled"].includes(t.status))
      .reduce((s: number, t: any) => s + Number(t.amount), 0);
    const pendingTotal = list
      .filter((t: any) => t.status === "pending")
      .reduce((s: number, t: any) => s + Number(t.amount), 0);
    return { paidTotal, pendingTotal, count: list.length };
  }, [filtered]);

  const exportCSV = () => {
    if (!filtered.length) {
      toast.error("Nenhuma transação para exportar");
      return;
    }
    const header = "Data,Tipo,Referência,Valor,Status,Liquidado em\n";
    const rows = filtered
      .map((t: any) => {
        const km = kindMeta[t.transaction_kind] || { label: t.transaction_kind };
        const sm = statusMeta[t.status] || { label: t.status };
        const date = format(new Date(t.created_at), "dd/MM/yyyy HH:mm");
        const settled = t.settled_at ? format(new Date(t.settled_at), "dd/MM/yyyy HH:mm") : "";
        return `"${date}","${km.label}","${t.reference_code}","${Number(t.amount).toFixed(2)}","${sm.label}","${settled}"`;
      })
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-${storeName || "loja"}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Extrato exportado");
  };

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-foreground">Extrato Financeiro Completo</p>
            <p className="text-[11px] text-muted-foreground">
              Todas as cobranças, mensalidades e movimentações
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-muted/20">
            <div className="bg-background rounded-xl p-2.5 border border-border">
              <p className="text-[10px] text-muted-foreground">Pago</p>
              <p className="text-sm font-black text-emerald-600">{formatBRL(totals.paidTotal)}</p>
            </div>
            <div className="bg-background rounded-xl p-2.5 border border-border">
              <p className="text-[10px] text-muted-foreground">Pendente</p>
              <p className="text-sm font-black text-amber-600">{formatBRL(totals.pendingTotal)}</p>
            </div>
            <div className="bg-background rounded-xl p-2.5 border border-border">
              <p className="text-[10px] text-muted-foreground">Itens</p>
              <p className="text-sm font-black text-foreground">{totals.count}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="p-3 border-t border-border space-y-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {(["all", "paid", "pending", "failed"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {f === "all" ? "Todos" : f === "paid" ? "Pagos" : f === "pending" ? "Pendentes" : "Falhou"}
                </button>
              ))}
              <div className="flex-1" />
              <button
                onClick={exportCSV}
                className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
              >
                <Download className="h-3 w-3" /> CSV
              </button>
            </div>

            {kinds.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setKindFilter("all")}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                    kindFilter === "all"
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  Todos os tipos
                </button>
                {kinds.map((k) => {
                  const km = kindMeta[k] || { label: k, emoji: "•" };
                  return (
                    <button
                      key={k}
                      onClick={() => setKindFilter(k)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                        kindFilter === k
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {km.emoji} {km.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* List */}
          <div className="border-t border-border max-h-96 overflow-y-auto">
            {isLoading && (
              <p className="text-xs text-muted-foreground text-center py-8">Carregando extrato…</p>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-8 px-4">
                <Receipt className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-xs text-muted-foreground">
                  Nenhuma transação encontrada com esses filtros.
                </p>
              </div>
            )}
            {!isLoading &&
              filtered.map((t: any) => {
                const sm = statusMeta[t.status] || statusMeta.pending;
                const km = kindMeta[t.transaction_kind] || { label: t.transaction_kind, emoji: "•", color: "text-foreground" };
                const Icon = sm.icon;
                return (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 p-3 border-b border-border/50 last:border-0 hover:bg-muted/30"
                  >
                    <div className={`p-2 rounded-xl border ${sm.cls} shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-xs font-bold ${km.color} truncate`}>
                            {km.emoji} {km.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            {t.reference_code}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-sm font-black text-foreground whitespace-nowrap">
                            {formatBRL(Number(t.amount))}
                          </p>
                          {(t.metadata?.order_id || t.transaction_kind === "store_payout") && (
                            <button 
                              onClick={() => setSelectedTx(t)}
                              className="text-[10px] font-bold text-primary flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-full hover:bg-primary/10 transition-colors"
                            >
                              <Eye className="h-2.5 w-2.5" /> Detalhes
                            </button>
                          )}
                        </div>
                      </div>
          {/* Transaction Detail Modal */}
          {selectedTx && (
            <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedTx(null)}>
              <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-sm">Comprovante de Operação</h3>
                  </div>
                  <button onClick={() => setSelectedTx(null)} className="p-1 rounded-full hover:bg-muted transition-colors">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                
                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Header info */}
                  <div className="text-center space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Valor da Transação</p>
                    <p className="text-3xl font-black text-foreground">{formatBRL(Number(selectedTx.amount))}</p>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" /> Operação {statusMeta[selectedTx.status]?.label || selectedTx.status}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between text-xs border-b border-border/50 pb-2">
                      <span className="text-muted-foreground">Data/Hora</span>
                      <span className="font-medium">{format(new Date(selectedTx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    </div>
                    <div className="flex justify-between text-xs border-b border-border/50 pb-2">
                      <span className="text-muted-foreground">Referência</span>
                      <span className="font-mono text-[10px]">{selectedTx.reference_code}</span>
                    </div>
                    <div className="flex justify-between text-xs border-b border-border/50 pb-2">
                      <span className="text-muted-foreground">Tipo</span>
                      <span className="font-medium">{kindMeta[selectedTx.transaction_kind]?.label || selectedTx.transaction_kind}</span>
                    </div>
                    
                    {/* Order Specific Details if available in metadata/join */}
                    {selectedTx.metadata?.order_id && (
                      <div className="bg-muted/30 rounded-xl p-3 space-y-2 mt-2">
                        <p className="text-[10px] font-bold text-primary uppercase">Dados do Pedido</p>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Pedido</span>
                          <span className="font-bold">#{selectedTx.metadata.order_id.slice(0, 8).toUpperCase()}</span>
                        </div>
                        {selectedTx.metadata?.client_name && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">Cliente</span>
                            <span className="font-bold">{selectedTx.metadata.client_name}</span>
                          </div>
                        )}
                        {selectedTx.metadata?.payment_method && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">Meio Original</span>
                            <span className="font-bold uppercase">{selectedTx.metadata.payment_method}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-muted/30 border-t border-border">
                  <button 
                    onClick={() => setSelectedTx(null)}
                    className="w-full bg-foreground text-background font-bold py-2.5 rounded-xl text-xs hover:opacity-90 transition-all"
                  >
                    Fechar Detalhes
                  </button>
                </div>
              </div>
            </div>
          )}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(t.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {" · "}
                          <span className="font-semibold">{sm.label}</span>
                          {t.provider && t.provider !== "mercado_pago" && (
                            <> · {t.provider}</>
                          )}
                        </p>
                        {t.pix_copy_paste && t.status === "pending" && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(t.pix_copy_paste);
                              toast.success("PIX copiado");
                            }}
                            className="text-[10px] text-primary hover:underline flex items-center gap-1 shrink-0"
                          >
                            <Copy className="h-3 w-3" /> PIX
                          </button>
                        )}
                      </div>
                      {t.settled_at && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">
                          ✓ Liquidado em {format(new Date(t.settled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentStatement;
