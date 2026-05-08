import { Search, XCircle, Truck, Loader2, Clock, ChefHat, Package, CheckCircle2, Bell } from "lucide-react";
import { AdminOrderCard } from "../components/AdminOrderCard";

type OrderStatus = any;
type OrderTabKey = any;

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
    isOwnDelivery, hasLinkedDrivers, driversLoading, onlineDrivers, linkedStoreDrivers,
    pendingCount, settlementSearch, setSettlementSearch, batchDispatch, batchDispatching,
    selectAllReady, toggleBatchOrder, toggleAddress, storeName,
    getClientName, getClientWhatsApp, getDriverName, getRequiredAddonHighlights, getMainAction,
    buildAcceptWhatsAppHref, buildReadyWhatsAppHref, updateOrderStatus, handleAcceptOrder,
    handleCancelOrder, handlePrint, invalidateOrders,
  } = props;

  return (
<>
  {/* Quick summary counters */}
  {orderCounters.total > 0 && (
      <div className="px-4 pt-3 pb-1">
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => { setActiveTab("pendente"); setBatchSelected(new Set()); }}
            className={`relative flex flex-col items-center p-2.5 rounded-xl border transition-all ${
              orderCounters.pendente > 0 ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 shadow-sm" : "bg-card border-border"
            }`}>
            {orderCounters.pendente > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />}
            <span className={`text-xl font-black ${orderCounters.pendente > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{orderCounters.pendente}</span>
            <span className="text-[9px] font-bold text-muted-foreground mt-0.5">Novos</span>
          </button>
          <button onClick={() => { setActiveTab("preparando"); setBatchSelected(new Set()); }}
            className={`flex flex-col items-center p-2.5 rounded-xl border transition-all ${
              orderCounters.preparando > 0 ? "bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/30 shadow-sm" : "bg-card border-border"
            }`}>
            <span className={`text-xl font-black ${orderCounters.preparando > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>{orderCounters.preparando}</span>
            <span className="text-[9px] font-bold text-muted-foreground mt-0.5">Preparo</span>
          </button>
          <button onClick={() => { setActiveTab("pronto_para_entrega"); setBatchSelected(new Set()); }}
            className={`flex flex-col items-center p-2.5 rounded-xl border transition-all ${
              orderCounters.pronto > 0 ? "bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/30 shadow-sm" : "bg-card border-border"
            }`}>
            <span className={`text-xl font-black ${orderCounters.pronto > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>{orderCounters.pronto}</span>
            <span className="text-[9px] font-bold text-muted-foreground mt-0.5">Prontos</span>
          </button>
          <button onClick={() => { setActiveTab("delivery"); setBatchSelected(new Set()); }}
            className={`flex flex-col items-center p-2.5 rounded-xl border transition-all ${
              orderCounters.delivery > 0 ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 shadow-sm" : "bg-card border-border"
            }`}>
            <span className={`text-xl font-black ${orderCounters.delivery > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{orderCounters.delivery}</span>
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
                ? tab.status === "pendente" 
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-400/40 shadow-sm" 
                  : "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}>
            <Icon className={`h-3.5 w-3.5 ${isActive && tab.status === "pendente" ? "animate-pulse" : ""}`} />
            {tab.label}
            {count > 0 && (
              <span className={`ml-0.5 min-w-[20px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                tab.status === "pendente" ? "bg-amber-400 text-amber-900 animate-pulse" : isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
              }`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  </div>

  {/* Settlement search */}
  {activeTab === "entregue" && (orders?.filter(o => o.status === "entregue").length || 0) > 1 && (
    <div className="px-4 pt-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" value={settlementSearch} onChange={e => setSettlementSearch(e.target.value)}
          placeholder="Buscar por ID, entregador ou cliente..."
          className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        {settlementSearch && (
          <button onClick={() => setSettlementSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )}

  {/* Batch dispatch bar (own delivery WITHOUT linked drivers + pronto_para_entrega) */}
  {isOwnDelivery && !hasLinkedDrivers && !driversLoading && activeTab === "pronto_para_entrega" && (filteredOrders.length > 0) && (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
        <Truck className="h-4 w-4 text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
            🛵 Agrupar pedidos para entrega
          </p>
          <p className="text-[10px] text-muted-foreground">
            Selecione os pedidos prontos e envie todos de uma vez
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={selectAllReady}
            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg hover:bg-blue-500/20 transition-colors">
            Todos
          </button>
          {batchSelected.size > 0 && (
            <button onClick={batchDispatch} disabled={batchDispatching}
              className="flex items-center gap-1 text-xs font-black text-white bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
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
    ) : filteredOrders.length > 0 ? (
      filteredOrders.map((order: any, index: number) => (
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
          storeName={store?.name}
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
          activeTab === "pendente" ? "bg-amber-100 dark:bg-amber-500/10" :
          activeTab === "preparando" ? "bg-orange-100 dark:bg-orange-500/10" :
          activeTab === "pronto_para_entrega" ? "bg-blue-100 dark:bg-blue-500/10" :
          activeTab === "delivery" ? "bg-indigo-100 dark:bg-indigo-500/10" :
          "bg-emerald-100 dark:bg-emerald-500/10"
        }`}>
          {activeTab === "pendente" && <Clock className="h-10 w-10 text-amber-400" />}
          {activeTab === "preparando" && <ChefHat className="h-10 w-10 text-orange-400" />}
          {activeTab === "pronto_para_entrega" && <Package className="h-10 w-10 text-blue-400" />}
          {activeTab === "delivery" && <Truck className="h-10 w-10 text-indigo-400" />}
          {(activeTab === "entregue" || activeTab === "finalizado") && <CheckCircle2 className="h-10 w-10 text-emerald-400" />}
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
      className="fixed bottom-24 lg:bottom-6 right-6 bg-amber-400 text-amber-900 font-black px-5 py-3 rounded-2xl shadow-xl animate-bounce flex items-center gap-2 text-sm z-30 ring-4 ring-amber-400/30">
      <Bell className="h-4 w-4" /> {pendingCount} novo{pendingCount > 1 ? "s" : ""}!
    </button>
  )}
</>
  );
}
