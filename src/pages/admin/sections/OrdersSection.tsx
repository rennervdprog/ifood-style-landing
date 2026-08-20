import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Bell } from "lucide-react";
import { AdminOrderCard } from "../components/AdminOrderCard";
import type { OrderStatus, OrderTabKey } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import OrdersToolbar, { type PeriodKey, type SourceKey } from "../components/orders/OrdersToolbar";
import OrdersStatusPills from "../components/orders/OrdersStatusPills";
import PixDirectAlert from "../components/orders/PixDirectAlert";
import OrdersEmptyState from "../components/orders/OrdersEmptyState";
import OrderCardSkeleton from "../components/orders/OrderCardSkeleton";

interface Props {
  store: any;
  orders: any[] | undefined;
  isLoading: boolean;
  filteredOrders: any[];
  orderCounters: any;
  orderTabs: any[];
  activeTab: OrderTabKey;
  setActiveTab: (t: OrderTabKey) => void;
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
    store, orders, isLoading, filteredOrders, orderTabs, activeTab, setActiveTab,
    expandedAddresses, cancelConfirm, setCancelConfirm,
    cancelReason, setCancelReason, cancellingOrder,
    isOwnDelivery, hasLinkedDrivers, driversLoading, onlineDrivers, linkedStoreDrivers,
    pendingCount, settlementSearch, setSettlementSearch, toggleAddress,
    getClientName, getClientWhatsApp, getDriverName, getRequiredAddonHighlights, getMainAction,
    buildAcceptWhatsAppHref, buildReadyWhatsAppHref, updateOrderStatus, handleAcceptOrder,
    handleCancelOrder, handlePrint, invalidateOrders, evolutionConnected,
  } = props;

  const [period, setPeriod] = useState<PeriodKey>("today");
  const [sourceFilter, setSourceFilter] = useState<SourceKey>("all");

  const pixPending = useMemo(
    () => (orders || []).filter((o: any) => o.status === "comprovante_enviado" || o.status === "aguardando_comprovante"),
    [orders]
  );
  const [pixBusyId, setPixBusyId] = useState<string | null>(null);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [pixProofPreview, setPixProofPreview] = useState<{ url: string; order: any } | null>(null);

  const openProof = async (order: any) => {
    if (!order?.pix_proof_url) return;
    if (proofUrls[order.id]) { setPixProofPreview({ url: proofUrls[order.id], order }); return; }
    const { data, error } = await supabase.storage
      .from("pix-proofs")
      .createSignedUrl(order.pix_proof_url, 60 * 10);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o comprovante"); return; }
    setProofUrls((p) => ({ ...p, [order.id]: data.signedUrl }));
    setPixProofPreview({ url: data.signedUrl, order });
  };

  const confirmPix = async (order: any) => {
    setPixBusyId(order.id);
    try {
      const { error } = await (supabase as any).rpc("confirm_pix_proof", { p_order_id: order.id });
      if (error) throw error;
      toast.success("Pagamento confirmado! Pedido em preparo.");
      invalidateOrders();
      try { (window as any).__autoPrintDeliveryOrder?.(order.id, order.order_source); } catch {}
    } catch (e: any) {
      toast.error(e?.message || "Erro ao confirmar");
    } finally {
      setPixBusyId(null);
    }
  };

  const confirmPixExternal = async (order: any) => {
    setPixBusyId(order.id);
    try {
      const { error } = await (supabase as any).rpc("confirm_pix_external", { p_order_id: order.id });
      if (error) throw error;
      toast.success("Pagamento confirmado (WhatsApp)! Pedido em preparo.");
      invalidateOrders();
      try { (window as any).__autoPrintDeliveryOrder?.(order.id, order.order_source); } catch {}
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

  const attentionCount = pendingCount + pixPending.length;

  return (
    <>
      <OrdersToolbar
        period={period}
        setPeriod={setPeriod}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        search={settlementSearch}
        setSearch={setSettlementSearch}
        periodSummary={periodSummary}
        showSearch={(orders?.length || 0) > 1}
      />

      {attentionCount > 0 && (
        <section className="mx-auto mt-4 flex max-w-6xl flex-col gap-3 border border-primary/30 border-l-4 border-l-primary bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-black text-foreground">{attentionCount} pedido{attentionCount > 1 ? "s precisam" : " precisa"} da sua atenção</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Revise novos pedidos e confirmações de PIX antes de iniciar o preparo.</p>
            </div>
          </div>
          <button onClick={() => setActiveTab("pendente")} className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground hover:bg-primary/90 sm:self-auto">Ver pendentes <ArrowRight className="h-4 w-4" /></button>
        </section>
      )}

      <PixDirectAlert
        pixPending={pixPending}
        pixBusyId={pixBusyId}
        onOpenProof={openProof}
        onConfirm={confirmPix}
        onConfirmExternal={confirmPixExternal}
        onRefuse={refusePix}
        pixProofPreview={pixProofPreview}
        setPixProofPreview={setPixProofPreview}
      />

      <OrdersStatusPills
        orderTabs={orderTabs}
        orders={orders}
        activeTab={activeTab}
        isOwnDelivery={isOwnDelivery}
        onSelect={setActiveTab}
      />

      <div className="mx-auto grid max-w-6xl gap-4 space-y-0 p-4 md:grid-cols-2 xl:grid-cols-3 lg:px-6">
        {isLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => <OrderCardSkeleton key={i} />)}
          </>
        ) : finalOrders.length > 0 ? (
          finalOrders.map((order: any, index: number) => (
            <AdminOrderCard
              key={order.id}
              order={order}
              index={index}
              isAddressExpanded={expandedAddresses.has(order.id)}
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
          <OrdersEmptyState activeTab={activeTab} />
        )}
      </div>

      {pendingCount > 0 && activeTab !== "pendente" && (
        <button
          onClick={() => setActiveTab("pendente")}
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
          className="fixed right-6 z-30 flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-xl ring-4 ring-primary/30 lg:!bottom-6"
        >
          <Bell className="h-4 w-4" /> {pendingCount} novo{pendingCount > 1 ? "s" : ""}!
        </button>
      )}
    </>
  );
}