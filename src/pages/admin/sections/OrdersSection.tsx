import { useMemo, useState } from "react";
import { Search, XCircle, Truck, Loader2, Clock, ChefHat, Package, CheckCircle2, Bell, Calendar, Store as StoreIcon, QrCode } from "lucide-react";
import { AdminOrderCard } from "../components/AdminOrderCard";
import type { OrderStatus, OrderTabKey } from "../types";
import { formatBRL } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  store: any;
  orders: any[] | undefined;
  isLoading: boolean;
  filteredOrders: any[];
  orderCounters: any;
  orderTabs: any[];
  activeTab: OrderTabKey;
  setActiveTab: (t: OrderTabKey) => void;
  batchSelected: Set<string>;
  setBatchSelected: (s: Set<string>) => void;
  expandedAddresses: Set<string>;
  cancelConfirm: any;
  cancelReason: string;
  setCancelReason: (r: string) => void;
  cancellingOrder?: boolean;
  setCancelConfirm: (v: any) => void;
  isOwnDelivery: boolean;
  hasLinkedDrivers: boolean;
  driversLoading: boolean;
  onlineDrivers: any[];
  linkedStoreDrivers: any[];
  pendingCount: number;
  settlementSearch: string;
  setSettlementSearch: (s: string) => void;
  batchDispatch: () => void;
  batchDispatching: boolean;
  selectAllReady: () => void;
  toggleBatchOrder: (id: string) => void;
  toggleAddress: (id: string) => void;
  storeName: string | undefined;
  getClientName: (id: string) => string;
  getClientWhatsApp: (id: string) => string;
  getDriverName: (id: string) => string;
  getRequiredAddonHighlights: (o: any) => any;
  getMainAction: (status: any, o: any) => any;
  buildAcceptWhatsAppHref: (o: any) => string;
  buildReadyWhatsAppHref: (o: any) => string;
  evolutionConnected?: boolean;
  updateOrderStatus: (id: string, status: any) => void;
  handleAcceptOrder: (o: any) => void;
  handleCancelOrder: (o: any) => void;
  handlePrint: (o: any) => void;
  invalidateOrders: () => void;
}

export default function OrdersSection(props: Props) {
  const {
    store, orders, isLoading, filteredOrders, orderCounters, orderTabs, activeTab, setActiveTab,
    batchSelected, setBatchSelected, expandedAddresses, cancelConfirm, setCancelConfirm,
    cancelReason, setCancelReason, cancellingOrder,
    isOwnDelivery, hasLinkedDrivers, driversLoading, onlineDrivers, linkedStoreDrivers,
    pendingCount, settlementSearch, setSettlementSearch, batchDispatch, batchDispatching,
    selectAllReady, toggleBatchOrder, toggleAddress, storeName,
    getClientName, getClientWhatsApp, getDriverName, getRequiredAddonHighlights, getMainAction,
    buildAcceptWhatsAppHref, buildReadyWhatsAppHref, updateOrderStatus, handleAcceptOrder,
    handleCancelOrder, handlePrint, invalidateOrders, evolutionConnected,
  } = props;

  // Filtros locais: período + origem (Delivery / PDV / Manual)
  const [period, setPeriod] = useState<"today" | "yesterday" | "7d" | "all">("today");
  const [sourceFilter, setSourceFilter] = useState<"all" | "delivery" | "pdv" | "manual">("all");

  // Pedidos aguardando confirmação Pix Direto (comprovante enviado)
  const pixPending = useMemo(
    () => (orders || []).filter((o: any) => o.status === "comprovante_enviado" || o.status === "aguardando_comprovante"),
    [orders]
  );
  const [pixBusyId, setPixBusyId] = useState<string | null>(null);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [pixConfirmOrder, setPixConfirmOrder] = useState<any | null>(null);

  const openProof = async (order: any) => {
    if (!order?.pix_proof_url) return;
    if (proofUrls[order.id]) { window.open(proofUrls[order.id], "_blank"); return; }
    const { data, error } = await supabase.storage
      .from("pix-proofs")
      .createSignedUrl(order.pix_proof_url, 60 * 10);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o comprovante"); return; }
    setProofUrls((p) => ({ ...p, [order.id]: data.signedUrl }));
    window.open(data.signedUrl, "_blank");
  };

  const confirmPix = async (order: any) => {
    setPixBusyId(order.id);
    try {
      const { error } = await (supabase as any).rpc("confirm_pix_proof", { p_order_id: order.id });
      if (error) throw error;
      toast.success("Pagamento confirmado! Pedido em preparo.");
      invalidateOrders();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao confirmar");
    } finally {
      setPixBusyId(null);
    }
  };

  const refusePix = async (order: any) => {
    const reason = prompt("Motivo da recusa (será visível ao cliente):");
    if (!reason || !reason.trim()) return;
    setPixBusyId(order.id);
    try {
      const { error } = await (supabase as any).rpc("refuse_pix_proof", { p_order_id: order.id, p_reason: reason.trim() });
      if (error) throw error;
      toast.success("Comprovante recusado.");
      invalidateOrders();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao recusar");
    } finally {
      setPixBusyId(null);
    }
  };

  const periodRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    if (period === "today") return { from: start.getTime(), to: Infinity };
    if (period === "yesterday") {
      const y = new Date(start); y.setDate(y.getDate() - 1);
      return { from: y.getTime(), to: start.getTime() };
    }
    if (period === "7d") {
      const s = new Date(start); s.setDate(s.getDate() - 6);
      return { from: s.getTime(), to: Infinity };
    }
    return { from: -Infinity, to: Infinity };
  }, [period]);

  const finalOrders = useMemo(() => {
    return filteredOrders.filter((o: any) => {
      const t = new Date(o.created_at).getTime();
      if (t < periodRange.from || t >= periodRange.to) return false;
      if (sourceFilter !== "all") {
        const src = o.order_source || "delivery";
        if (src !== sourceFilter) return false;
      }
      return true;
    });
  }, [filteredOrders, periodRange, sourceFilter]);

  // Resumo do período visível (todas as origens, dentro do período escolhido)
  const periodSummary = useMemo(() => {
    const base = (orders || []).filter((o: any) => {
      const t = new Date(o.created_at).getTime();
      if (t < periodRange.from || t >= periodRange.to) return false;
      return o.status !== "cancelado";
    });
    let total = 0, pdvCount = 0, pdvTotal = 0, deliveryCount = 0, deliveryTotal = 0, manualCount = 0, manualTotal = 0;
    for (const o of base) {
      const price = Number(o.total_price || 0);
      total += price;
      const src = o.order_source || "delivery";
      if (src === "pdv") { pdvCount++; pdvTotal += price; }
      else if (src === "manual") { manualCount++; manualTotal += price; }
      else { deliveryCount++; deliveryTotal += price; }
    }
    return { count: base.length, total, pdvCount, pdvTotal, deliveryCount, deliveryTotal, manualCount, manualTotal };
  }, [orders, periodRange]);

  return (
<>
  <AlertDialog open={!!pixConfirmOrder} onOpenChange={(v) => !v && setPixConfirmOrder(null)}>
    <AlertDialogContent className="rounded-2xl">
      <AlertDialogHeader>
        <AlertDialogTitle>Confirmar recebimento do Pix?</AlertDialogTitle>
        <AlertDialogDescription>
          Confirme apenas se o valor de <strong>{pixConfirmOrder ? formatBRL(Number(pixConfirmOrder.total_price || 0)) : ""}</strong> já caiu na sua conta. Essa ação libera o pedido para preparo e não pode ser desfeita.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
        <AlertDialogAction
          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={async () => {
            const o = pixConfirmOrder;
            setPixConfirmOrder(null);
            if (o) await confirmPix(o);
          }}
        >
          Sim, recebi
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  {/* 🚨 Prioridade: Pix Direto aguardando confirmação */}
  {pixPending.length > 0 && (
    <div className="px-4 pt-3">
      <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" />
          <p className="text-xs font-black text-primary uppercase tracking-wide">Pix Direto — aguardando você</p>
          <span className="ml-auto text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">{pixPending.length}</span>
        </div>
        <div className="space-y-2">
          {pixPending.map((o: any) => {
            const proofSent = o.status === "comprovante_enviado";
            return (
              <div key={o.id} className="rounded-xl bg-card border border-border p-2.5 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    #{String(o.id).slice(0, 6)} · {formatBRL(Number(o.total_price || 0))}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {proofSent ? "Comprovante enviado — revise e confirme" : "Aguardando cliente enviar comprovante"}
                  </p>
                </div>
                {proofSent && o.pix_proof_url && (
                  <button
                    onClick={() => openProof(o)}
                    className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-muted text-foreground"
                  >
                    Ver
                  </button>
                )}
                {proofSent && (
                  <>
                     <button
                       onClick={() => setPixConfirmOrder(o)}
                       disabled={pixBusyId === o.id}
                       className="text-[11px] font-black px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
                     >
                       {pixBusyId === o.id ? "..." : "Confirmar"}
                     </button>
                    <button
                      onClick={() => refusePix(o)}
                      disabled={pixBusyId === o.id}
                      className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-destructive text-destructive-foreground disabled:opacity-50"
                    >
                      Recusar
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )}

  {/* Quick summary counters */}
  {orderCounters.total > 0 && (
      <div className="px-4 pt-3 pb-1">
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => { setActiveTab("pendente"); setBatchSelected(new Set()); }}
            className={`relative flex flex-col items-center p-2.5 rounded-xl border transition-all ${
              orderCounters.pendente > 0 ? "bg-primary/10 border-primary/30 shadow-sm" : "bg-card border-border"
            }`}>
            {orderCounters.pendente > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-ping" />}
            <span className={`text-xl font-black ${orderCounters.pendente > 0 ? "text-primary" : "text-muted-foreground"}`}>{orderCounters.pendente}</span>
            <span className="text-[9px] font-bold text-muted-foreground mt-0.5">Novos</span>
          </button>
          <button onClick={() => { setActiveTab("preparando"); setBatchSelected(new Set()); }}
            className={`flex flex-col items-center p-2.5 rounded-xl border transition-all ${
              orderCounters.preparando > 0 ? "bg-muted border-border shadow-sm" : "bg-card border-border"
            }`}>
            <span className={`text-xl font-black ${orderCounters.preparando > 0 ? "text-foreground" : "text-muted-foreground"}`}>{orderCounters.preparando}</span>
            <span className="text-[9px] font-bold text-muted-foreground mt-0.5">Preparo</span>
          </button>
          <button onClick={() => { setActiveTab("pronto_para_entrega"); setBatchSelected(new Set()); }}
            className={`flex flex-col items-center p-2.5 rounded-xl border transition-all ${
              orderCounters.pronto > 0 ? "bg-muted border-border shadow-sm" : "bg-card border-border"
            }`}>
            <span className={`text-xl font-black ${orderCounters.pronto > 0 ? "text-foreground" : "text-muted-foreground"}`}>{orderCounters.pronto}</span>
            <span className="text-[9px] font-bold text-muted-foreground mt-0.5">Prontos</span>
          </button>
          <button onClick={() => { setActiveTab("delivery"); setBatchSelected(new Set()); }}
            className={`flex flex-col items-center p-2.5 rounded-xl border transition-all ${
              orderCounters.delivery > 0 ? "bg-muted border-border shadow-sm" : "bg-card border-border"
            }`}>
            <span className={`text-xl font-black ${orderCounters.delivery > 0 ? "text-foreground" : "text-muted-foreground"}`}>{orderCounters.delivery}</span>
            <span className="text-[9px] font-bold text-muted-foreground mt-0.5">Entrega</span>
          </button>
        </div>
      </div>
  )}

  {/* Order status tabs */}
  <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
    <div className="flex overflow-x-auto gap-1 px-3 py-2 no-scrollbar">
      {orderTabs.filter((tab) => {
        if (tab.status === "entregue" && isOwnDelivery) return false;
        return true;
      }).map((tab) => {
        const count = tab.mergedStatuses 
          ? orders?.filter(o => tab.mergedStatuses!.includes(o.status as OrderStatus)).length || 0
          : orders?.filter(o => o.status === tab.status).length || 0;
        const Icon = tab.icon;
        const isActive = activeTab === tab.status;
        return (
          <button key={tab.status} onClick={() => { setActiveTab(tab.status as OrderTabKey); setBatchSelected(new Set()); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              isActive
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}>
            <Icon className={`h-3.5 w-3.5 ${isActive && tab.status === "pendente" ? "animate-pulse" : ""}`} />
            {tab.label}
            {count > 0 && (
              <span className={`ml-0.5 min-w-[20px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                tab.status === "pendente" && !isActive ? "bg-primary text-primary-foreground animate-pulse" : isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
              }`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  </div>

  {/* Busca universal (id, cliente, telefone, motoboy) — Fase 2 */}
  {(orders?.length || 0) > 1 && (
    <div className="px-4 pt-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" value={settlementSearch} onChange={e => setSettlementSearch(e.target.value)}
          placeholder="Buscar por ID, cliente, telefone ou entregador..."
          className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        {settlementSearch && (
          <button onClick={() => setSettlementSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )}

  {/* Filtros: Período + Origem (Delivery / PDV / Manual) */}
  <div className="px-4 pt-3 space-y-2">
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {([
        { id: "today", label: "Hoje" },
        { id: "yesterday", label: "Ontem" },
        { id: "7d", label: "7 dias" },
        { id: "all", label: "Tudo" },
      ] as const).map((p) => (
        <button key={p.id} onClick={() => setPeriod(p.id)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
            period === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
          }`}>
          {p.label}
        </button>
      ))}
      <div className="w-px h-4 bg-border mx-1 shrink-0" />
      <StoreIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {([
        { id: "all", label: "Todas" },
        { id: "delivery", label: "Delivery" },
        { id: "pdv", label: "PDV" },
        { id: "manual", label: "Manual" },
      ] as const).map((s) => (
        <button key={s.id} onClick={() => setSourceFilter(s.id)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
            sourceFilter === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
          }`}>
          {s.label}
        </button>
      ))}
    </div>

    {/* Resumo do período (não conta cancelados) */}
    <div className="rounded-xl border border-border bg-card/60 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
      <div className="flex flex-col">
        <span className="text-muted-foreground">
          {period === "today" ? "Hoje" : period === "yesterday" ? "Ontem" : period === "7d" ? "Últimos 7 dias" : "Total"} · {periodSummary.count} pedido{periodSummary.count === 1 ? "" : "s"}
        </span>
        <span className="font-black text-foreground text-sm">{formatBRL(periodSummary.total)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground">
          Delivery <span className="font-bold text-foreground">{periodSummary.deliveryCount}</span> · {formatBRL(periodSummary.deliveryTotal)}
        </span>
        <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground">
          PDV <span className="font-bold text-foreground">{periodSummary.pdvCount}</span> · {formatBRL(periodSummary.pdvTotal)}
        </span>
        {periodSummary.manualCount > 0 && (
          <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground">
            Manual <span className="font-bold text-foreground">{periodSummary.manualCount}</span> · {formatBRL(periodSummary.manualTotal)}
          </span>
        )}
      </div>
    </div>
  </div>

  {/* Batch dispatch bar (own delivery WITHOUT linked drivers + pronto_para_entrega) */}
  {isOwnDelivery && !hasLinkedDrivers && !driversLoading && activeTab === "pronto_para_entrega" && (filteredOrders.length > 0) && (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-2 bg-muted border border-border rounded-xl p-3">
        <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground">
            Agrupar pedidos para entrega
          </p>
          <p className="text-[10px] text-muted-foreground">
            Selecione os pedidos prontos e envie todos de uma vez
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={selectAllReady}
            className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors">
            Todos
          </button>
          {batchSelected.size > 0 && (
            <button onClick={batchDispatch} disabled={batchDispatching}
              className="flex items-center gap-1 text-xs font-black text-primary-foreground bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {batchDispatching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
              Enviar {batchSelected.size}
            </button>
          )}
        </div>
      </div>
    </div>
  )}

  {/* Order cards */}
  <div className="p-4 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 max-w-6xl mx-auto">
    {isLoading ? (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border animate-pulse">
            <div className="h-8 bg-muted/60" />
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="h-5 bg-muted rounded-lg w-32" />
                  <div className="h-3 bg-muted rounded w-24" />
                </div>
                <div className="space-y-2 items-end flex flex-col">
                  <div className="h-6 bg-muted rounded-lg w-20" />
                  <div className="h-3 bg-muted rounded w-12" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 bg-muted rounded-lg w-20" />
                <div className="h-8 bg-muted rounded-lg w-16" />
                <div className="h-8 bg-muted rounded-lg w-24" />
              </div>
              <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
              <div className="flex gap-2">
                <div className="h-10 bg-muted rounded-xl w-10" />
                <div className="h-10 bg-muted rounded-xl flex-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : finalOrders.length > 0 ? (
      finalOrders.map((order: any, index: number) => (
        <AdminOrderCard
          key={order.id}
          order={order}
          index={index}
          isAddressExpanded={expandedAddresses.has(order.id)}
          isBatchSelected={batchSelected.has(order.id)}
          isOwnDelivery={isOwnDelivery}
          hasLinkedDrivers={hasLinkedDrivers}
          driversLoading={driversLoading}
          cancelConfirm={cancelConfirm}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          cancellingOrder={cancellingOrder}
          storeName={store?.name}
          storeId={store?.id}
          evolutionConnected={evolutionConnected}
          onlineDriversCount={onlineDrivers?.length || 0}
          linkedStoreDrivers={linkedStoreDrivers}
          highlights={getRequiredAddonHighlights(order)}
          clientName={getClientName(order.client_id)}
          clientWhatsApp={getClientWhatsApp(order.client_id)}
          driverName={getDriverName}
          mainAction={getMainAction(order.status, order)}
          acceptHref={buildAcceptWhatsAppHref(order)}
          readyHref={buildReadyWhatsAppHref(order)}
          toggleAddress={toggleAddress}
          toggleBatchOrder={toggleBatchOrder}
          setActiveTab={setActiveTab}
          setCancelConfirm={setCancelConfirm}
          updateOrderStatus={updateOrderStatus}
          handleAcceptOrder={handleAcceptOrder}
          handleCancelOrder={handleCancelOrder}
          handlePrint={handlePrint}
          invalidateOrders={invalidateOrders}
        />
      ))
    ) : (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-5 ${
          "bg-muted"
        }`}>
          {activeTab === "pendente" && <Clock className="h-10 w-10 text-muted-foreground" />}
          {activeTab === "preparando" && <ChefHat className="h-10 w-10 text-muted-foreground" />}
          {activeTab === "pronto_para_entrega" && <Package className="h-10 w-10 text-muted-foreground" />}
          {activeTab === "delivery" && <Truck className="h-10 w-10 text-muted-foreground" />}
          {(activeTab === "entregue" || activeTab === "finalizado") && <CheckCircle2 className="h-10 w-10 text-muted-foreground" />}
        </div>
        <p className="text-base font-black text-foreground mb-1.5">
          {activeTab === "pendente" && "Tudo em ordem! 🎉"}
          {activeTab === "preparando" && "Nenhum pedido em preparo"}
          {activeTab === "pronto_para_entrega" && "Nenhum pedido pronto"}
          {activeTab === "delivery" && "Nenhuma entrega em andamento"}
          {(activeTab === "entregue" || activeTab === "finalizado") && "Nenhum pedido aqui"}
        </p>
        <p className="text-sm text-muted-foreground max-w-[240px]">
          {activeTab === "pendente" && "Novos pedidos aparecerão automaticamente. Relaxe! 😎"}
          {activeTab === "preparando" && "Aceite pedidos pendentes para começar a produzir."}
          {activeTab === "pronto_para_entrega" && "Marque pedidos como prontos quando finalizarem."}
          {activeTab === "delivery" && "Entregas em andamento aparecerão aqui."}
          {(activeTab === "entregue" || activeTab === "finalizado") && "Pedidos concluídos aparecerão aqui."}
        </p>
      </div>
    )}
  </div>

  {/* Floating pending badge */}
  {pendingCount > 0 && activeTab !== "pendente" && (
    <button onClick={() => setActiveTab("pendente")}
      className="fixed bottom-24 lg:bottom-6 right-6 bg-primary text-primary-foreground font-black px-5 py-3 rounded-2xl shadow-xl animate-bounce flex items-center gap-2 text-sm z-30 ring-4 ring-primary/30">
      <Bell className="h-4 w-4" /> {pendingCount} novo{pendingCount > 1 ? "s" : ""}!
    </button>
  )}
</>
  );
}
