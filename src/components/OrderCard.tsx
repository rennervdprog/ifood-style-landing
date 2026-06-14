import { memo } from "react";
import { Clock, ChefHat, Package, Truck, CheckCircle2, AlertTriangle, Timer, Smartphone, Banknote } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { statusColors } from "@/lib/orderStatus";
import { getOrderItemDisplayName } from "@/lib/orderItemName";

interface OrderCardProps {
  order: any;
  onStatusChange?: (orderId: string, nextStatus: string) => void;
  showActions?: boolean;
  paymentIcons?: Record<string, React.ReactNode>;
  paymentLabels?: Record<string, string>;
  getClientName?: (clientId: string) => string;
  isOwnDelivery?: boolean;
  hasLinkedDrivers?: boolean;
  driversLoading?: boolean;
  toggleBatchOrder?: (orderId: string) => void;
  batchSelected?: Set<string>;
  getMainAction?: (status: string, order: any) => { label: string; next: string; emoji: string } | null;
}

const defaultPaymentIcons: Record<string, React.ReactNode> = {
  pix: <Smartphone className="h-3 w-3" />,
  cartao: <Banknote className="h-3 w-3" />,
  dinheiro: <Banknote className="h-3 w-3" />,
};

const defaultPaymentLabels: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
};

const OrderCardInner = ({
  order,
  onStatusChange,
  showActions = true,
  paymentIcons = defaultPaymentIcons,
  paymentLabels = defaultPaymentLabels,
  getClientName = (id) => id.slice(0, 8),
  isOwnDelivery,
  hasLinkedDrivers,
  driversLoading,
  toggleBatchOrder,
  batchSelected = new Set(),
  getMainAction,
}: OrderCardProps) => {
  const sc = statusColors[order.status] || statusColors.pendente;
  const elapsedMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isDelayed = elapsedMin > 20 && ["pendente", "preparando"].includes(order.status);
  const action = getMainAction?.(order.status, order);

  return (
    <div className={`bg-card rounded-2xl overflow-hidden border transition-all duration-300 ${
      batchSelected.has(order.id) ? "border-blue-500 ring-2 ring-blue-500/30" :
      isDelayed ? "border-destructive/50 shadow-[0_0_12px_-4px] shadow-destructive/20" :
      order.status === "pendente" ? "border-amber-400/40 shadow-amber-400/5 animate-pulse-border" : "border-border"
    } hover:shadow-md`}>
      <div className={`px-3 py-1.5 ${sc.bg} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {isOwnDelivery && !hasLinkedDrivers && !driversLoading && order.status === "pronto_para_entrega" && toggleBatchOrder && (
            <button onClick={() => toggleBatchOrder(order.id)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                batchSelected.has(order.id) ? "bg-blue-500 border-blue-500 text-white" : "border-muted-foreground/40 hover:border-blue-400"
              }`}>
              {batchSelected.has(order.id) && <CheckCircle2 className="h-3.5 w-3.5" />}
            </button>
          )}
          <span className={`text-[10px] font-bold uppercase ${sc.text}`}>{sc.label}</span>
          {isDelayed && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="h-2.5 w-2.5" /> Atrasado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {["pendente", "preparando", "pronto_para_entrega"].includes(order.status) && (
            <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              isDelayed ? "bg-destructive/10 text-destructive" : 
              elapsedMin > 10 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : 
              "bg-muted text-muted-foreground"
            }`}>
              <Timer className="h-2.5 w-2.5" />
              {elapsedMin}min
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h4 className="text-sm font-black text-foreground">#{order.id.slice(0, 8).toUpperCase()}</h4>
            <p className="text-xs text-muted-foreground truncate font-medium">{getClientName(order.client_id)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-black text-foreground">{formatBRL(order.total_price)}</p>
            <div className="flex items-center gap-1 justify-end text-[10px] text-muted-foreground font-bold mt-0.5">
              {paymentIcons[order.payment_method]}
              <span>{paymentLabels[order.payment_method]?.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className="bg-muted/30 rounded-xl p-3 space-y-2">
          {order.order_items?.map((item: any) => (
            <div key={item.id} className="flex justify-between text-xs items-baseline">
              <span className="text-foreground leading-relaxed flex gap-1.5">
                <span className="text-primary font-black">{item.quantity}x</span>
                <span className="font-medium">{getOrderItemDisplayName(item)}</span>
              </span>
              <span className="text-muted-foreground font-medium">{formatBRL(item.unit_price * item.quantity)}</span>
            </div>
          ))}
        </div>

        {showActions && action && onStatusChange && (
          <button onClick={() => onStatusChange(order.id, action.next)}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-xs shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <span>{action.emoji}</span>
            <span>{action.label}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export const OrderCard = memo(OrderCardInner);
