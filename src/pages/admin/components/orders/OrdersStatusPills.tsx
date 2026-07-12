import type { OrderStatus, OrderTabKey } from "../../types";

interface Props {
  orderTabs: any[];
  orders: any[] | undefined;
  activeTab: OrderTabKey;
  isOwnDelivery: boolean;
  onSelect: (t: OrderTabKey) => void;
}

export default function OrdersStatusPills({ orderTabs, orders, activeTab, isOwnDelivery, onSelect }: Props) {
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="flex overflow-x-auto gap-1 px-3 py-2 no-scrollbar max-w-6xl mx-auto">
        {orderTabs
          .filter((tab) => !(tab.status === "entregue" && isOwnDelivery))
          .map((tab) => {
            const count = tab.mergedStatuses
              ? orders?.filter((o) => tab.mergedStatuses.includes(o.status as OrderStatus)).length || 0
              : orders?.filter((o) => o.status === tab.status).length || 0;
            const Icon = tab.icon;
            const isActive = activeTab === tab.status;
            const isPending = tab.status === "pendente";
            return (
              <button
                key={tab.status}
                onClick={() => onSelect(tab.status as OrderTabKey)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : count > 0
                    ? "bg-card border border-border text-foreground hover:bg-accent"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {isPending && count > 0 && !isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-ping" />
                )}
                <Icon className={`h-3.5 w-3.5 ${isActive && isPending ? "animate-pulse" : ""}`} />
                {tab.label}
                {count > 0 && (
                  <span
                    className={`ml-0.5 min-w-[20px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      isPending && !isActive
                        ? "bg-primary text-primary-foreground animate-pulse"
                        : isActive
                        ? "bg-primary-foreground/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}