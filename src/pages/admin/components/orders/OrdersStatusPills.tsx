import type { OrderStatus, OrderTabKey } from "../../types";

interface Props {
  orderTabs: any[];
  orders: any[] | undefined;
  activeTab: OrderTabKey;
  isOwnDelivery: boolean;
  onSelect: (tab: OrderTabKey) => void;
}

export default function OrdersStatusPills({ orderTabs, orders, activeTab, isOwnDelivery, onSelect }: Props) {
  return (
    <nav className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md" aria-label="Status dos pedidos">
      <div className="no-scrollbar mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 pt-3 lg:px-6">
        {orderTabs
          .filter((tab) => !(tab.status === "entregue" && isOwnDelivery))
          .map((tab) => {
            const count = tab.mergedStatuses
              ? orders?.filter((order) => tab.mergedStatuses.includes(order.status as OrderStatus)).length || 0
              : orders?.filter((order) => order.status === tab.status).length || 0;
            const Icon = tab.icon;
            const isActive = activeTab === tab.status;
            const isPending = tab.status === "pendente";

            return (
              <button
                key={tab.status}
                onClick={() => onSelect(tab.status as OrderTabKey)}
                className={`relative inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-3 text-xs font-black transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {count > 0 && (
                  <span className={`ml-0.5 min-w-[19px] rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    isActive ? "bg-primary/10 text-primary" : isPending ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </nav>
  );
}
