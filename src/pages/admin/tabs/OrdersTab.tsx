import React from "react";
import { Search, Clock, Package, Bike, Truck, CheckCircle2, History, Trash2, Smartphone, Banknote } from "lucide-react";
import { useAdmin } from "../AdminContext";
import { OrderCard } from "@/components/OrderCard";

const OrdersTab = () => {
  const { 
    orders, activeTab, setActiveTab, updateOrderStatus, getClientName,
    paymentIcons, paymentLabels, isOwnDelivery, hasLinkedDrivers,
    driversLoading, toggleBatchOrder, batchSelected, getMainAction
  } = useAdmin();

  const orderTabs = [
    { status: "pendente", label: "Novos", icon: Clock },
    { status: "preparando", label: "Preparo", icon: Package },
    { status: "pronto_para_entrega", label: "Prontos", icon: CheckCircle2 },
    { status: "delivery", label: "Entrega", icon: Bike, mergedStatuses: ["saiu_entrega", "em_transito"] },
    { status: "entregue", label: "Entregues", icon: Truck },
    { status: "finalizado", label: "Histórico", icon: History },
    { status: "cancelado", label: "Cancelados", icon: Trash2 },
  ];

  const filteredOrders = orders?.filter(o => {
    if (activeTab === "delivery") return ["saiu_entrega", "em_transito"].includes(o.status);
    return o.status === activeTab;
  }) || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab Switcher */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex overflow-x-auto gap-1 px-3 py-2 no-scrollbar">
          {orderTabs.filter(tab => !(tab.status === "entregue" && isOwnDelivery)).map(tab => {
            const isActive = activeTab === tab.status;
            const count = tab.mergedStatuses 
              ? orders?.filter(o => tab.mergedStatuses!.includes(o.status)).length || 0
              : orders?.filter(o => o.status === tab.status).length || 0;
            return (
              <button key={tab.status} onClick={() => setActiveTab(tab.status)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-accent"
                }`}>
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-primary-foreground/20">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
            <Package className="h-16 w-16 mb-4" />
            <p className="font-bold text-sm">Nenhum pedido nesta categoria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onStatusChange={updateOrderStatus}
                getClientName={getClientName}
                paymentIcons={paymentIcons}
                paymentLabels={paymentLabels}
                isOwnDelivery={isOwnDelivery}
                hasLinkedDrivers={hasLinkedDrivers}
                driversLoading={driversLoading}
                toggleBatchOrder={toggleBatchOrder}
                batchSelected={batchSelected}
                getMainAction={getMainAction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersTab;
