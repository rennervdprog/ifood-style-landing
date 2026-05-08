import { useState, useCallback, useMemo } from "react";
import { Search, XCircle, Truck, Loader2, CheckCircle2, Timer, Bike, AlertTriangle } from "lucide-react";
import { statusColors, orderTabs, paymentIcons } from "../constants";
import type { OrderStatus, OrderTabKey } from "../types";
import { formatBRL } from "@/lib/utils";
import { RequiredAddonHighlights } from "../components/RequiredAddonHighlights";
import WhatsAppButton from "@/components/WhatsAppButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getOrderItemDisplayName } from "@/lib/orderItemName";
import { notifyOrderStatusChange } from "@/lib/orderNotifications";

interface OrdersTabProps {
  orders: any[];
  isLoading: boolean;
  store: any;
  isOwnDelivery: boolean;
  hasLinkedDrivers: boolean;
  driversLoading: boolean;
  getClientName: (id: string) => string;
  getDriverName: (id: string) => string;
  getClientWhatsApp: (id: string) => string;
  getRequiredAddonHighlights: (order: any) => any[];
  buildReadyWhatsAppHref: (order: any) => string;
  buildAcceptWhatsAppHref: (order: any) => string;
  handleAcceptOrder: (order: any) => void;
}

const OrdersTab = ({
  orders,
  isLoading,
  store,
  isOwnDelivery,
  hasLinkedDrivers,
  driversLoading,
  getClientName,
  getDriverName,
  getClientWhatsApp,
  getRequiredAddonHighlights,
  buildReadyWhatsAppHref,
  buildAcceptWhatsAppHref,
  handleAcceptOrder,
}: OrdersTabProps) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<OrderTabKey>("pendente");
  const [settlementSearch, setSettlementSearch] = useState("");
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [batchDispatching, setBatchDispatching] = useState(false);
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

  const toggleAddress = (orderId: string) => {
    setExpandedAddresses(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const filteredOrders = useMemo(() => {
    const list = (orders?.filter(o => {
      if (activeTab === "delivery") return o.status === "saiu_entrega" || o.status === "em_transito";
      return o.status === activeTab;
    }) || []);

    if (activeTab === "entregue" && settlementSearch.trim()) {
      const search = settlementSearch.toLowerCase().trim();
      return list.filter(o => 
        o.id.slice(0, 8).toLowerCase().includes(search) || 
        (o.driver_id ? getDriverName(o.driver_id).toLowerCase().includes(search) : false) || 
        getClientName(o.client_id).toLowerCase().includes(search)
      );
    }
    return list;
  }, [orders, activeTab, settlementSearch, getDriverName, getClientName]);

  const toggleBatchOrder = (orderId: string) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const selectAllReady = () => {
    const readyIds = (orders || []).filter(o => o.status === "pronto_para_entrega").map(o => o.id);
    setBatchSelected(new Set(readyIds));
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
      if (error) { toast.error(`Erro: ${error.message}`); return; }
      await queryClient.invalidateQueries({ queryKey: ["store-orders", store?.id] });
      toast.success("Pedido atualizado!");
    } catch (e: any) { toast.error(`Erro: ${e?.message}`); }
  };

  const handleCancelOrder = async (order: any) => {
    try {
      const { error } = await supabase.from("orders").update({ status: "cancelado" as any }).eq("id", order.id);
      if (error) { toast.error("Erro ao cancelar."); return; }
      queryClient.invalidateQueries({ queryKey: ["store-orders", store?.id] });
      setCancelConfirm(null);
      toast.success("Pedido cancelado.");
    } catch (e: any) { toast.error(`Erro: ${e?.message}`); }
  };

  const batchDispatch = async () => {
    if (batchSelected.size === 0) return;
    setBatchDispatching(true);
    try {
      const ids = Array.from(batchSelected);
      const { error } = await supabase.from("orders").update({ status: "saiu_entrega" as any }).in("id", ids);
      if (error) { toast.error("Erro ao despachar"); return; }
      queryClient.invalidateQueries({ queryKey: ["store-orders", store?.id] });
      toast.success(`${ids.length} pedido(s) enviados!`);
      setBatchSelected(new Set());
    } catch (e: any) { toast.error(`Erro: ${e?.message}`); } finally { setBatchDispatching(false); }
  };

  const getMainAction = (status: OrderStatus, order?: any): { label: string; next: OrderStatus; emoji: string } | null => {
    const isPickupOrder = order?.neighborhood === "RETIRADA";
    switch (status) {
      case "pendente": return { label: "ACEITAR PEDIDO", next: "preparando", emoji: "✓" };
      case "preparando": 
        return isPickupOrder 
          ? { label: "PRONTO P/ RETIRADA", next: "pronto_para_entrega" as OrderStatus, emoji: "🏪" }
          : { label: "MARCAR COMO PRONTO", next: "pronto_para_entrega" as OrderStatus, emoji: "🔔" };
      case "pronto_para_entrega":
        if (isPickupOrder) return { label: "CLIENTE RETIROU", next: "finalizado" as OrderStatus, emoji: "✅" };
        if (isOwnDelivery && !hasLinkedDrivers && !driversLoading && !order?.driver_id) {
          return { label: "SAIU PARA ENTREGA", next: "saiu_entrega" as OrderStatus, emoji: "🛵" };
        }
        return null;
      case "saiu_entrega":
        if (isOwnDelivery && !hasLinkedDrivers && !driversLoading) return { label: "MARCAR COMO ENTREGUE", next: "finalizado" as OrderStatus, emoji: "✅" };
        return null;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Order status tabs */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex overflow-x-auto gap-1 px-3 py-2 no-scrollbar">
          {orderTabs.filter(tab => !(tab.status === "entregue" && isOwnDelivery)).map((tab) => {
            const count = tab.mergedStatuses 
              ? orders?.filter(o => tab.mergedStatuses!.includes(o.status as OrderStatus)).length || 0
              : orders?.filter(o => o.status === tab.status).length || 0;
            const Icon = tab.icon;
            const isActive = activeTab === tab.status;
            return (
              <button key={tab.status} onClick={() => { setActiveTab(tab.status as OrderTabKey); setBatchSelected(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-accent"
                }`}>
                <Icon className={`h-3.5 w-3.5 ${isActive && tab.status === "pendente" ? "animate-pulse" : ""}`} />
                {tab.label}
                {count > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-primary-foreground/20">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 max-w-6xl mx-auto w-full">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map((order: any) => {
            const action = getMainAction(order.status, order);
            const sc = statusColors[order.status] || statusColors.pendente;
            return (
              <div key={order.id} className="bg-card rounded-2xl overflow-hidden border border-border">
                <div className={`px-3 py-1.5 ${sc.bg} flex items-center justify-between`}>
                  <span className={`text-[10px] font-bold uppercase ${sc.text}`}>{sc.label}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="p-3">
                   <p className="text-base font-black">#{order.id.slice(0, 8).toUpperCase()}</p>
                   <p className="text-sm font-bold text-emerald-500">{formatBRL(Number(order.total_price))}</p>
                   <div className="mt-2 flex gap-2">
                     {action && (
                       <button onClick={() => updateOrderStatus(order.id, action.next)} className="flex-1 bg-primary text-white py-2 rounded-xl text-xs font-bold">
                         {action.label}
                       </button>
                     )}
                     {getClientWhatsApp(order.client_id) && (
                       <WhatsAppButton number={getClientWhatsApp(order.client_id)} message="Oi!" />
                     )}
                   </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-24 text-muted-foreground col-span-full">Nenhum pedido nesta aba.</div>
        )}
      </div>
    </div>
  );
};

export default OrdersTab;