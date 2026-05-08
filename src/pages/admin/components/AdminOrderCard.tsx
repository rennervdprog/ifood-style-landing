import { memo } from "react";
import {
  CheckCircle2, AlertTriangle, Timer, Bike, MapPin, ChevronDown, ChevronUp,
  Store, Loader2, Truck, Banknote, MessageCircle, Copy, Printer
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { getOrderItemDisplayName } from "@/lib/orderItemName";
import { openWhatsApp } from "@/lib/whatsapp";
import WhatsAppButton from "@/components/WhatsAppButton";
import { statusColors, paymentIcons } from "../constants";
import { parseOrderAddons } from "../helpers";
import type { OrderStatus, RequiredAddonHighlight } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RequiredAddonHighlightsProps { highlights: RequiredAddonHighlight[]; }
const RequiredAddonHighlights = ({ highlights }: RequiredAddonHighlightsProps) => {
  if (highlights.length === 0) return null;
  return (
    <div className="mx-3 mb-2 space-y-1.5">
      {highlights.map((highlight, index) => (
        <div key={`${highlight.itemId}-${highlight.groupName}-${highlight.addonName}-${index}`} className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{highlight.itemName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-primary">{highlight.groupName}</span>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="text-sm font-black uppercase text-foreground">{highlight.addonName}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export interface AdminOrderCardProps {
  order: any;
  index: number;
  isAddressExpanded: boolean;
  isBatchSelected: boolean;
  isOwnDelivery: boolean;
  hasLinkedDrivers: boolean;
  driversLoading: boolean;
  cancelConfirm: string | null;
  storeName?: string;
  onlineDriversCount: number;
  linkedStoreDrivers: any[] | undefined;
  highlights: RequiredAddonHighlight[];
  clientName: string;
  clientWhatsApp: string;
  driverName: (id: string) => string;
  mainAction: { label: string; next: OrderStatus; emoji: string } | null;
  acceptHref: string;
  readyHref: string;
  toggleAddress: (id: string) => void;
  toggleBatchOrder: (id: string) => void;
  setActiveTab: (t: any) => void;
  setCancelConfirm: (id: string | null) => void;
  updateOrderStatus: (id: string, s: OrderStatus) => void;
  handleAcceptOrder: (order: any) => void;
  handleCancelOrder: (order: any) => void;
  handlePrint: (order: any) => void;
  invalidateOrders: () => void;
}

const AdminOrderCardImpl = (props: AdminOrderCardProps) => {
  const {
    order, index, isAddressExpanded, isBatchSelected, isOwnDelivery, hasLinkedDrivers,
    driversLoading, cancelConfirm, storeName, onlineDriversCount, linkedStoreDrivers,
    highlights, clientName, clientWhatsApp, driverName, mainAction, acceptHref, readyHref,
    toggleAddress, toggleBatchOrder, setActiveTab, setCancelConfirm, updateOrderStatus,
    handleAcceptOrder, handleCancelOrder, handlePrint, invalidateOrders,
  } = props;

  const sc = statusColors[order.status] || statusColors.pendente;
  const elapsedMs = Date.now() - new Date(order.created_at).getTime();
  const elapsedMin = Math.floor(elapsedMs / 60000);
  const isDelayed = elapsedMin > 20 && ["pendente", "preparando"].includes(order.status);
  const action = mainAction;

  return (
    <div
      style={{ animationDelay: `${index * 50}ms` }}
      className={`bg-card rounded-2xl overflow-hidden border transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 ${
        isBatchSelected ? "border-blue-500 ring-2 ring-blue-500/30" :
        isDelayed ? "border-destructive/50 shadow-[0_0_12px_-4px] shadow-destructive/20" :
        order.status === "pendente" ? "border-amber-400/40 shadow-amber-400/5 animate-pulse-border" : "border-border"
      } hover:shadow-md`}
    >
      <div className={`px-3 py-1.5 ${sc.bg} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {isOwnDelivery && !hasLinkedDrivers && !driversLoading && order.status === "pronto_para_entrega" && (
            <button onClick={() => toggleBatchOrder(order.id)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                isBatchSelected ? "bg-blue-500 border-blue-500 text-white" : "border-muted-foreground/40 hover:border-blue-400"
              }`}>
              {isBatchSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
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

      <div className="px-3 pt-2.5 pb-1.5 flex items-start justify-between">
        <div>
          <p className="text-base font-black text-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[11px] text-muted-foreground">
            <span>{clientName}</span>
            <span className="text-muted-foreground/40">•</span>
            <span>{order.neighborhood}</span>
            <span className="text-muted-foreground/40">•</span>
            <span>{paymentIcons[order.payment_method]}</span>
          </div>
          {order.driver_id && (
            <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <Bike className="h-3 w-3" />
              <span>Motoboy: {driverName(order.driver_id)}</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-emerald-500">{formatBRL(Number(order.total_price))}</p>
          {order.payment_method === "pix" && (
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">PIX PAGO</span>
          )}
        </div>
      </div>

      <RequiredAddonHighlights highlights={highlights} />

      <div className="mx-3 mb-2 bg-muted/50 rounded-xl px-3 py-2 space-y-0.5">
        {order.order_items?.map((item: any) => (
          <div key={item.id} className="text-sm text-foreground">
            <span className="text-primary font-bold">{item.quantity}x</span> {getOrderItemDisplayName(item)}
          </div>
        ))}
        {order.order_items?.map((item: any) => {
          const addons = parseOrderAddons(item.addons);
          if (!addons || addons.length === 0) return null;
          const optionalAddons = addons.filter((a: any) => !a.required);
          return (
            <div key={`addons-${item.id}`} className="pl-3 space-y-1 mt-1">
              {optionalAddons.length > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  {optionalAddons.map((a: any, idx: number) => (
                    <span key={idx}>+ {a.name}{a.price > 0 ? ` (${formatBRL(Number(a.price))})` : ""}{idx < optionalAddons.length - 1 ? ", " : ""}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {order.order_items?.map((item: any) => {
          if (!item.observations) return null;
          return <div key={`obs-${item.id}`} className="pl-5 text-[11px] text-muted-foreground italic">📝 {item.observations}</div>;
        })}
        {order.payment_method === "dinheiro" && (order as any).needs_change && Number((order as any).change_for) > 0 && (
          <div className="flex items-center gap-1 pt-1 border-t border-border">
            <Banknote className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] text-amber-500 font-bold">Troco: {formatBRL(Number((order as any).change_for) - Number(order.total_price))}</span>
          </div>
        )}
      </div>

      <div className="mx-3 mb-2">
        {order.neighborhood === "RETIRADA" ? (
          <div className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2">
            <Store className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400">🏪 Retirada na loja</span>
          </div>
        ) : (
          <>
            <button onClick={() => toggleAddress(order.id)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full">
              <MapPin className="h-3 w-3" />
              <span className="truncate flex-1 text-left">{order.neighborhood}</span>
              {isAddressExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {isAddressExpanded && (
              <div className="mt-1.5 bg-muted/30 rounded-lg p-2.5 text-xs text-muted-foreground space-y-0.5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <p>{order.address_details}</p>
                <p className="text-muted-foreground/70">Taxa entrega: {formatBRL(Number(order.delivery_fee))}</p>
              </div>
            )}
          </>
        )}
      </div>

      {order.neighborhood !== "RETIRADA" && order.status === "pronto_para_entrega" && !order.driver_id && !isOwnDelivery && (
        <div className="mx-3 mb-2 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Aguardando entregador</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${onlineDriversCount > 0 ? "bg-emerald-500 animate-pulse" : "bg-destructive"}`} />
            <span className="text-[10px] text-muted-foreground">
              {onlineDriversCount > 0 ? `${onlineDriversCount} entregador(es) online` : "Nenhum entregador online"}
            </span>
          </div>
        </div>
      )}
      {order.neighborhood !== "RETIRADA" && order.status === "pronto_para_entrega" && isOwnDelivery && !order.driver_id && (
        <div className="mx-3 mb-2 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2 space-y-2">
          <div className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
              {(order as any).assigned_driver_id
                ? `🎯 Designado para ${driverName((order as any).assigned_driver_id)}`
                : "🛵 Aberto — qualquer motoboy pode aceitar"}
            </span>
          </div>
          {linkedStoreDrivers && linkedStoreDrivers.length > 1 && (
            <select
              value={(order as any).assigned_driver_id || ""}
              onChange={async (e) => {
                const target = e.target.value || null;
                try {
                  const { error } = await supabase.rpc("store_assign_order_driver" as any, {
                    _order_id: order.id,
                    _driver_user_id: target,
                  });
                  if (error) throw error;
                  toast.success(target ? "Pedido designado!" : "Pedido liberado para todos.");
                  invalidateOrders();
                } catch (err: any) {
                  toast.error(err.message || "Erro ao designar motoboy");
                }
              }}
              className="w-full text-xs px-2 py-1.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary"
            >
              <option value="">🌐 Liberar para todos</option>
              {linkedStoreDrivers.map((d: any) => (
                <option key={d.user_id} value={d.user_id}>🎯 Enviar para {d.full_name}</option>
              ))}
            </select>
          )}
          {linkedStoreDrivers && linkedStoreDrivers.length > 0 && (
            <p className="text-[10px] text-muted-foreground">{linkedStoreDrivers.length} motoboy(s) vinculado(s)</p>
          )}
        </div>
      )}
      {order.neighborhood !== "RETIRADA" && order.status === "pronto_para_entrega" && isOwnDelivery && order.driver_id && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2">
          <Bike className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">🏍️ {driverName(order.driver_id)} aceitou o pedido</span>
        </div>
      )}
      {order.status === "saiu_entrega" && isOwnDelivery && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2">
          <Truck className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">🛵 {order.driver_id ? driverName(order.driver_id) : "Motoboy"} está entregando</span>
        </div>
      )}
      {order.driver_id && (order.status === "em_transito" || (order.status === "saiu_entrega" && !isOwnDelivery)) && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2">
          <Truck className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">🛵 {driverName(order.driver_id)} entregando</span>
        </div>
      )}

      {isOwnDelivery && hasLinkedDrivers && (order as any).delivery_pin && ["preparando", "pronto_para_entrega", "saiu_entrega", "em_transito"].includes(order.status) && (
        <div className="mx-3 mb-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-center">
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mb-1">🔐 PIN de Entrega (cliente confirma)</p>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-[0.3em]">{(order as any).delivery_pin}</p>
          {order.driver_id && (
            <p className="text-[10px] text-muted-foreground mt-1">Motoboy: {driverName(order.driver_id)}</p>
          )}
        </div>
      )}

      {isOwnDelivery && (order as any).delivery_confirmed_by_client && ["entregue", "finalizado"].includes(order.status) && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs text-emerald-500 font-bold">Cliente confirmou entrega ✅</span>
          {order.driver_id && (
            <span className="ml-auto text-[10px] text-muted-foreground">{driverName(order.driver_id)}</span>
          )}
        </div>
      )}

      {(order.status === "pronto_para_entrega" || order.status === "saiu_entrega" || order.status === "em_transito") && (order as any).collection_code && !isOwnDelivery && (
        <div className="mx-3 mb-2 bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 text-center">
          <p className="text-[10px] text-purple-500 font-bold mb-1">🔐 Código de Coleta</p>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-[0.3em]">{(order as any).collection_code}</p>
        </div>
      )}

      {["dinheiro", "cartao"].includes(order.payment_method) && (order as any).settlement_code && ["entregue", "finalizado"].includes(order.status) && !(order as any).return_to_store_confirmed && !isOwnDelivery && (
        <div className="mx-3 mb-2 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
          {order.driver_id && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/10">
              <Bike className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">🏍️ {driverName(order.driver_id)}</span>
              <span className="ml-auto text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">#{order.id.slice(0, 8).toUpperCase()}</span>
            </div>
          )}
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">🔑 Código de Acerto</p>
            <button onClick={() => { navigator.clipboard.writeText((order as any).settlement_code); toast.success("Copiado!"); }}
              className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <Copy className="h-2.5 w-2.5" /> Copiar
            </button>
          </div>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-[0.3em] text-center">{(order as any).settlement_code}</p>
          <p className="text-[10px] text-muted-foreground text-center mt-1">Informe somente após receber {formatBRL(Number(order.total_price))}</p>
        </div>
      )}
      {["dinheiro", "cartao"].includes(order.payment_method) && (order as any).return_to_store_confirmed && ["entregue", "finalizado"].includes(order.status) && !isOwnDelivery && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs text-emerald-500 font-bold">Acerto realizado ✅</span>
        </div>
      )}

      <div className="mx-3 mb-2 flex flex-wrap gap-1.5">
        {clientWhatsApp && (
          <>
            {order.status === "pendente" && (
              <button onClick={() => {
                const msg = `Olá ${clientName}! *ItaSuper*: Pedido aceito e em produção! 🍔\nPedido: #${order.id.slice(0, 8).toUpperCase()}\nTotal: ${formatBRL(Number(order.total_price))}`;
                openWhatsApp(clientWhatsApp, msg);
              }} className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-lg" title="Avisar cliente">
                <MessageCircle className="h-3 w-3" /> <span className="hidden sm:inline">Avisar</span>
              </button>
            )}
            {(order.status === "em_transito" || order.status === "saiu_entrega") && (
              <button onClick={() => {
                const msg = `Olá ${clientName}! Motoboy *ItaSuper* saiu para entrega! 🚀\nEndereço: ${order.address_details}`;
                openWhatsApp(clientWhatsApp, msg);
              }} className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-lg" title="Informar saída">
                <MessageCircle className="h-3 w-3" /> <span className="hidden sm:inline">Saiu</span>
              </button>
            )}
            <WhatsAppButton number={clientWhatsApp}
              message={`Olá ${clientName}! Aqui é do ${storeName}. Pedido #${order.id.slice(0, 8).toUpperCase()}...`}
              label="Chat" size="sm" />
          </>
        )}
      </div>

      <div className="px-3 pb-3 pt-1 flex items-center gap-2">
        <button onClick={() => handlePrint(order)}
          title="Imprimir"
          className="p-2.5 bg-muted rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Printer className="h-4 w-4" />
        </button>
        <div className="flex-1">
          {action && order.status === "pendente" ? (
            <div className="space-y-1">
              {order.payment_method === "pix" && (
                <div className="text-center">
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-bold">💰 PIX — Pagamento Confirmado</span>
                </div>
              )}
              <a
                href={acceptHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  handleAcceptOrder(order);
                  setActiveTab("preparando");
                  updateOrderStatus(order.id, "preparando");
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-sm active:scale-[0.98] transition-transform h-12 flex items-center justify-center no-underline"
              >
                {order.payment_method === "pix" ? "🍳 COMEÇAR PRODUÇÃO" : "✓ ACEITAR PEDIDO"}
              </a>
              <button onClick={() => handleCancelOrder(order)}
                className="w-full text-center text-xs text-destructive hover:text-destructive/80 py-1">
                Recusar pedido
              </button>
            </div>
          ) : action ? (
            <div className="space-y-1">
              {action.next === "pronto_para_entrega" ? (
                <a
                  href={readyHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    setActiveTab("pronto_para_entrega");
                    updateOrderStatus(order.id, action.next);
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-transform h-12 flex items-center justify-center no-underline"
                >
                  {action.emoji} {action.label}
                </a>
              ) : (
                <button onClick={() => {
                  if (action.next === "preparando") setActiveTab("preparando");
                  else if (action.next === "pronto_para_entrega") setActiveTab("pronto_para_entrega");
                  updateOrderStatus(order.id, action.next);
                }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-transform h-12">
                  {action.emoji} {action.label}
                </button>
              )}
              {cancelConfirm === order.id ? (
                <div className="flex gap-1.5">
                  <button onClick={() => handleCancelOrder(order)}
                    className="flex-1 bg-destructive text-destructive-foreground text-xs font-bold py-2 rounded-xl">
                    {order.payment_method === "pix" ? "💰 Cancelar + Reembolso PIX" : "Confirmar Cancelamento"}
                  </button>
                  <button onClick={() => setCancelConfirm(null)}
                    className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground">
                    Não
                  </button>
                </div>
              ) : (
                <button onClick={() => setCancelConfirm(order.id)}
                  className="w-full text-center text-xs text-destructive hover:text-destructive/80 py-1">
                  ✕ Cancelar pedido
                </button>
              )}
            </div>
          ) : !["entregue", "finalizado", "cancelado"].includes(order.status) ? (
            cancelConfirm === order.id ? (
              <div className="flex gap-1.5">
                <button onClick={() => handleCancelOrder(order)}
                  className="flex-1 bg-destructive text-destructive-foreground text-xs font-bold py-2 rounded-xl">
                  {order.payment_method === "pix" ? "💰 Cancelar + Reembolso PIX" : "Confirmar Cancelamento"}
                </button>
                <button onClick={() => setCancelConfirm(null)}
                  className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground">
                  Não
                </button>
              </div>
            ) : (
              <button onClick={() => setCancelConfirm(order.id)}
                className="w-full text-center text-xs text-destructive hover:text-destructive/80 py-1">
                ✕ Cancelar pedido
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};

const areEqual = (prev: AdminOrderCardProps, next: AdminOrderCardProps) => {
  const a = prev.order, b = next.order;
  if (a.id !== b.id) return false;
  if (a.status !== b.status) return false;
  if (a.driver_id !== b.driver_id) return false;
  if ((a as any).assigned_driver_id !== (b as any).assigned_driver_id) return false;
  if ((a as any).delivery_pin !== (b as any).delivery_pin) return false;
  if ((a as any).delivery_confirmed_by_client !== (b as any).delivery_confirmed_by_client) return false;
  if ((a as any).collection_code !== (b as any).collection_code) return false;
  if ((a as any).settlement_code !== (b as any).settlement_code) return false;
  if ((a as any).return_to_store_confirmed !== (b as any).return_to_store_confirmed) return false;
  if (a.total_price !== b.total_price) return false;
  if (prev.isAddressExpanded !== next.isAddressExpanded) return false;
  if (prev.isBatchSelected !== next.isBatchSelected) return false;
  if (prev.cancelConfirm !== next.cancelConfirm && (prev.cancelConfirm === a.id || next.cancelConfirm === a.id)) return false;
  if (prev.onlineDriversCount !== next.onlineDriversCount && a.status === "pronto_para_entrega" && !a.driver_id) return false;
  if (prev.isOwnDelivery !== next.isOwnDelivery) return false;
  if (prev.hasLinkedDrivers !== next.hasLinkedDrivers) return false;
  if (prev.driversLoading !== next.driversLoading) return false;
  if (prev.clientName !== next.clientName) return false;
  if (prev.clientWhatsApp !== next.clientWhatsApp) return false;
  return true;
};

export const AdminOrderCard = memo(AdminOrderCardImpl, areEqual);
export default AdminOrderCard;