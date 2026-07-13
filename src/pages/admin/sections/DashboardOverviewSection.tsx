import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type OrderStatus = any;
type DashboardTab = any;
import { CreditCard, AlertTriangle, ChevronRight, Clock, Bike, Monitor, ShoppingBag, DollarSign, Timer, Users, GraduationCap, ChevronUp, ChevronDown, User, MapPin, CheckCircle2, ArrowUpRight, UtensilsCrossed, Coins, Settings, Store, XCircle, Download, TrendingUp, Bell } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import WhatsAppButton from "@/components/WhatsAppButton";
import PlatformFeeExplainerCard from "@/components/PlatformFeeExplainerCard";
import EssencialProgressCard from "@/components/EssencialProgressCard";
import { GlanceCard } from "../components/GlanceCard";
import DriverDeliveriesCard from "../components/DriverDeliveriesCard";
import { CalendarClock } from "lucide-react";


interface Props {
  store: any;
  storePlan: any;
  isApproved: boolean;
  isStoreReallyOpen: boolean;
  allHoursClosed: boolean;
  isOwnDelivery: boolean;
  driversLoading: boolean;
  hasLinkedDrivers: boolean;
  pendingCount: number;
  preparingCount: number;
  readyCount: number;
  todayCount: number;
  todayTotal: number;
  avgDeliveryTime: number | null;
  clientAnalytics: any[];
  delayedOrders: any[];
  showDelayedPanel: boolean;
  setShowDelayedPanel: (v: boolean) => void;
  orders: any[] | undefined;
  statusColors: any;
  paymentIcons: any;
  paymentLabels: any;
  setDashboardTab: (t: any) => void;
  setActiveTab: (t: any) => void;
  navigate: (p: string) => void;
  avisosCount: number;
  getClientName: (id: string) => string;
  getClientWhatsApp: (id: string) => string;
  getOrderItemDisplayName: (item: any) => string;
  buildAcceptWhatsAppHref: (o: any) => string;
  buildReadyMessage: (o: any) => string;
  openWhatsApp: (phone: string, msg: string) => void;
  evolutionConnected?: boolean;
  cancelConfirm: string | null;
  cancelReason: string;
  setCancelConfirm: (v: string | null) => void;
  setCancelReason: (v: string) => void;
  cancellingOrder?: boolean;
  updateOrderStatus: (id: string, status: any) => void;
  handleAcceptOrder: (o: any) => void;
  handleCancelOrder: (o: any) => void;
}

export default function DashboardOverviewSection(props: Props) {
  const {
    store, storePlan, isStoreReallyOpen, allHoursClosed, isOwnDelivery, driversLoading,
    hasLinkedDrivers, pendingCount, preparingCount, readyCount, todayCount, todayTotal,
    avgDeliveryTime, clientAnalytics, delayedOrders, showDelayedPanel, setShowDelayedPanel,
    orders, statusColors, paymentIcons, paymentLabels, setDashboardTab, setActiveTab, navigate,
    avisosCount,
    getClientName, getClientWhatsApp, getOrderItemDisplayName, buildAcceptWhatsAppHref,
    buildReadyMessage, openWhatsApp, evolutionConnected, cancelConfirm, cancelReason,
    setCancelConfirm, setCancelReason, cancellingOrder, updateOrderStatus, handleAcceptOrder, handleCancelOrder,
  } = props;

  // Status do PDV (sincronizado com a tela /admin/pdv via tabela pdv_sessions)
  const { data: pdvSession } = useQuery({
    queryKey: ["pdv-session-status", store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_sessions" as any)
        .select("id, opening_amount, opened_at")
        .eq("store_id", store.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: !!store?.id && storePlan.pdvEnabled !== false,
    refetchInterval: 20_000,
  });
  const isPdvOpen = !!pdvSession?.id;

  // Cobrança PIX pendente (leva para aba Repasse)
  const { data: pendingCharge } = useQuery({
    queryKey: ["dashboard-pending-charge", store?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("financial_transactions")
        .select("id, amount, created_at")
        .eq("store_id", store.id)
        .eq("transaction_kind", "commission_charge")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: !!store?.id,
    refetchInterval: 30_000,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const greetingEmoji = hour < 12 ? "☀️" : hour < 18 ? "🌤️" : "🌙";

  // ── Fase 1: métricas extras (ticket médio, cancelamento, tempo até saiu_entrega) ──
  const todayKey = new Date().toDateString();
  const todayOrders = (orders || []).filter((o: any) => new Date(o.created_at).toDateString() === todayKey);
  const ticketMedio = todayCount > 0 ? todayTotal / todayCount : 0;
  const cancelados = todayOrders.filter((o: any) => o.status === "cancelado" || o.status === "recusado").length;
  const taxaCancel = todayOrders.length > 0 ? (cancelados / todayOrders.length) * 100 : 0;
  const saidasComTempo = todayOrders
    .filter((o: any) => ["saiu_entrega", "em_transito", "entregue", "finalizado"].includes(o.status))
    .map((o: any) => {
      const dispatched = o.dispatched_at || o.updated_at;
      if (!dispatched) return null;
      return (new Date(dispatched).getTime() - new Date(o.created_at).getTime()) / 60000;
    })
    .filter((m: any) => typeof m === "number" && m > 0 && m < 600);
  const tempoAteSaida = saidasComTempo.length > 0
    ? Math.round(saidasComTempo.reduce((a: number, b: number) => a + b, 0) / saidasComTempo.length)
    : null;

  const exportCsv = () => {
    const rows = [
      ["id", "criado_em", "status", "cliente", "bairro", "pagamento", "total"],
      ...todayOrders.map((o: any) => [
        o.id.slice(0, 8),
        new Date(o.created_at).toLocaleString("pt-BR"),
        o.status,
        getClientName(o.client_id).split(",").join(" "),
        (o.neighborhood || "").split(",").join(" "),
        o.payment_method || "",
        Number(o.total_price).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
<div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5 lg:space-y-6">

  {avisosCount > 0 && (
    <button
      onClick={() => setDashboardTab("avisos")}
      className="w-full text-left bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform"
    >
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white flex-shrink-0">
        <Bell className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-black flex items-center justify-center border-2 border-background">
          {avisosCount}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-black text-foreground">
          Você tem {avisosCount} aviso{avisosCount > 1 ? "s" : ""} pendente{avisosCount > 1 ? "s" : ""}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Toque para ver e resolver</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
    </button>
  )}

  {pendingCharge && (
    <button
      onClick={() => setDashboardTab("plan")}
      className="w-full text-left bg-primary/5 border-2 border-primary/40 rounded-2xl p-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform"
    >
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground flex-shrink-0">
        <CreditCard className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-destructive border-2 border-background animate-pulse" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-black text-foreground">
          Cobrança gerada — {formatBRL(Number(pendingCharge.amount || 0))}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Toque para pagar via PIX</p>
      </div>
      <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
    </button>
  )}

  {/* ── Trial em andamento: progresso dos dias restantes ── */}
  {storePlan.isInTrial && storePlan.trialEndsAt && (() => {
    const daysLeft = Math.max(0, storePlan.trialDaysLeft);
    const started = storePlan.startedAt ? new Date(storePlan.startedAt).getTime() : null;
    const endsAt = new Date(storePlan.trialEndsAt).getTime();
    const totalDays = started
      ? Math.max(1, Math.ceil((endsAt - started) / 86400000))
      : Math.max(daysLeft, 7);
    const daysUsed = Math.max(0, totalDays - daysLeft);
    const pct = Math.min(100, Math.round((daysUsed / totalDays) * 100));
    const urgent = daysLeft <= 3;
    const endsLabel = new Date(storePlan.trialEndsAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
    const fee = Number(storePlan.monthlyFee || 0);
    return (
      <button
        onClick={() => setDashboardTab("plan")}
        className={`w-full text-left rounded-2xl p-4 border-2 active:scale-[0.99] transition-transform ${
          urgent
            ? "bg-destructive/5 border-destructive/30"
            : "bg-primary/5 border-primary/30"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            urgent ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
          }`}>
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-black ${urgent ? "text-destructive" : "text-foreground"}`}>
              {daysLeft === 0
                ? "Seu período de teste termina hoje"
                : `Período de teste — restam ${daysLeft} dia${daysLeft > 1 ? "s" : ""}`}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Termina em <span className="font-semibold text-foreground">{endsLabel}</span>
              {fee > 0 && (
                <> — cobrança automática de <span className="font-semibold text-foreground">{formatBRL(fee)}</span> ao final</>
              )}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${urgent ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground font-semibold">
            {daysUsed} de {totalDays} dias usados
          </span>
          <span className={`text-[10px] font-bold ${urgent ? "text-destructive" : "text-primary"}`}>
            {urgent ? "Ative seu plano para não interromper" : "Ver detalhes do plano"}
          </span>
        </div>
      </button>
    );
  })()}

  {/* Explicação permanente da taxa R$ X/entrega — visível para todos os planos */}
  {storePlan.platformDeliverySplit > 0 && (
    <PlatformFeeExplainerCard storeId={store.id} splitPerOrder={storePlan.platformDeliverySplit} />
  )}

  {/* Progresso Essencial R$0 → R$180 quando bater R$ 5.000/60d */}
  <EssencialProgressCard store={store} storePlan={storePlan} />

  {/* ── Banner PDV ── */}
  {storePlan.pdvEnabled !== false && (
    <button
      onClick={() => navigate("/admin/pdv")}
      className={`w-full text-left rounded-2xl p-4 flex items-center gap-4 active:scale-[0.99] transition-transform group border ${
        isPdvOpen ? "bg-primary/5 border-primary/40" : "bg-card border-border hover:border-primary/40"
      }`}
    >
      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-colors ${
        isPdvOpen ? "bg-primary/20 border-primary/30" : "bg-primary/10 border-primary/20 group-hover:bg-primary/20"
      }`}>
        <Monitor className="h-6 w-6 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-black text-foreground">PDV — Caixa Presencial</h3>
          {isPdvOpen ? (
            <span className="text-[10px] font-bold bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Caixa aberto
            </span>
          ) : (
            <span className="text-[10px] font-bold bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">
              Disponível
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isPdvOpen
            ? `Troco inicial ${formatBRL(Number(pdvSession?.opening_amount) || 0)} — toque para registrar vendas.`
            : "Venda no balcão, mesa ou comanda. Sem taxa PIX — maquininha própria."}
        </p>
        <p className="text-[11px] text-primary font-semibold mt-1.5 flex items-center gap-1">
          {isPdvOpen ? "Ir para o PDV" : "Abrir caixa"} <ChevronRight className="h-3.5 w-3.5" />
        </p>
      </div>
    </button>
  )}

   {/* ── KPI Cards ── */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
    <GlanceCard
      icon={ShoppingBag} label="Pedidos Pendentes" value={pendingCount}
      subValue={preparingCount > 0 ? `+ ${preparingCount} em preparo` : "Sem pedidos novos"}
      color={pendingCount > 0 ? "text-primary" : "text-muted-foreground"}
      highlight={pendingCount > 0}
      onClick={() => { setDashboardTab("orders"); setActiveTab("pendente"); }}
    />
    <div className="flex flex-col gap-3">
      <GlanceCard
        icon={DollarSign} label="Faturamento Hoje" value={formatBRL(todayTotal)}
        subValue={`${todayCount} pedido${todayCount !== 1 ? "s" : ""} hoje`}
        color="text-foreground" trend={todayTotal > 0 ? "up" : null}
        onClick={() => setDashboardTab("finance")}
      />
    </div>
    <GlanceCard
      icon={Timer} label="Tempo Médio" value={avgDeliveryTime ? `${avgDeliveryTime} min` : "—"}
      subValue="Pedido até entrega" color="text-muted-foreground"
    />
    <GlanceCard
      icon={Users} label="Total Clientes" value={clientAnalytics.length}
      subValue="Clientes registrados" color="text-muted-foreground"
      onClick={() => setDashboardTab("clients")}
    />
  </div>

  {/* ── Fase 1: KPIs avançados ── */}
  {todayOrders.length > 0 && (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <GlanceCard
        icon={TrendingUp} label="Ticket Médio" value={formatBRL(ticketMedio)}
        subValue="Por pedido hoje" color="text-foreground"
      />
      <GlanceCard
        icon={XCircle} label="Taxa de Cancelamento"
        value={`${taxaCancel.toFixed(1)}%`}
        subValue={`${cancelados} de ${todayOrders.length} hoje`}
        color={taxaCancel > 10 ? "text-destructive" : "text-muted-foreground"}
      />
      <GlanceCard
        icon={Timer} label="Pedido → Saída"
        value={tempoAteSaida ? `${tempoAteSaida} min` : "—"}
        subValue="Tempo médio na cozinha" color="text-muted-foreground"
      />
    </div>
  )}

  {/* ── Fase 1: Exportar CSV ── */}
  {todayOrders.length > 0 && (
    <div className="flex justify-end">
      <button
        onClick={exportCsv}
        className="inline-flex items-center gap-2 text-xs font-bold text-foreground bg-card border border-border hover:border-primary/40 px-4 py-2 rounded-xl transition-colors"
      >
        <Download className="h-3.5 w-3.5" /> Exportar pedidos de hoje (CSV)
      </button>
    </div>
  )}

  {/* ── Entregas por motoboy (delivery normal + manual) ── */}
  {store?.id && hasLinkedDrivers && (
    <DriverDeliveriesCard
      storeId={store.id}
      onClick={() => setDashboardTab("drivers")}
    />
  )}

  {/* ── Tutorial Quick Access ── */}
  <button
    onClick={() => setDashboardTab("tutoriais")}
    className="w-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/30 rounded-2xl p-4 flex items-center gap-3 hover:shadow-lg hover:border-primary/50 active:scale-[0.99] transition-all text-left"
  >
    <div className="w-12 h-12 bg-primary/15 rounded-2xl flex items-center justify-center flex-shrink-0">
      <GraduationCap className="h-6 w-6 text-primary" />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-black text-foreground text-sm flex items-center gap-2">
        📚 Tutoriais Completos
        <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">NOVO</span>
      </h3>
      <p className="text-[11px] text-muted-foreground mt-0.5">Aprenda cada função do painel passo a passo, em linguagem simples</p>
    </div>
    <ArrowUpRight className="h-5 w-5 text-primary flex-shrink-0" />
  </button>

  {delayedOrders.length > 0 && (
    <div className="bg-destructive/5 border-2 border-destructive/20 rounded-2xl overflow-hidden">
      <button onClick={() => setShowDelayedPanel(!showDelayedPanel)} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="text-left">
            <span className="text-sm font-black text-destructive">{delayedOrders.length} pedido{delayedOrders.length > 1 ? "s" : ""} em atraso</span>
            <p className="text-[10px] text-muted-foreground">Mais de 20 min sem atualização</p>
          </div>
        </div>
        {showDelayedPanel ? <ChevronUp className="h-5 w-5 text-destructive" /> : <ChevronDown className="h-5 w-5 text-destructive" />}
      </button>
      {showDelayedPanel && (
        <div className="px-4 pb-4 space-y-2">
          {delayedOrders.map((order: any) => {
            const elapsedMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
            const formatElapsed = (m: number) => {
              if (m < 60) return `${m} min`;
              if (m < 1440) {
                const h = Math.floor(m / 60);
                const r = m % 60;
                return r ? `${h}h ${r}min` : `${h}h`;
              }
              const d = Math.floor(m / 1440);
              const h = Math.floor((m % 1440) / 60);
              return h ? `${d}d ${h}h` : `${d}d`;
            };
            const sc = statusColors[order.status] || statusColors.pendente;
            return (
              <div key={order.id} className="bg-card border border-destructive/20 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
                  </div>
                  <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">⏱️ {formatElapsed(elapsedMin)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{getClientName(order.client_id)}</span><span>•</span>
                  <span>{paymentIcons[order.payment_method]} {paymentLabels[order.payment_method] || order.payment_method}</span><span>•</span>
                  <span className="font-bold text-foreground">{formatBRL(Number(order.total_price))}</span>
                </div>
                <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 space-y-0.5">
                  {order.order_items?.slice(0, 4).map((item: any) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="text-foreground"><span className="text-primary font-bold">{item.quantity}x</span> {getOrderItemDisplayName(item)}</span>
                      <span className="text-muted-foreground">{formatBRL(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                  {(order.order_items?.length || 0) > 4 && <p className="text-[10px] text-muted-foreground">+{order.order_items.length - 4} itens...</p>}
                </div>
                <div className="flex gap-2">
                  {order.status === "pendente" && (
                    <button onClick={() => {
                      setDashboardTab("orders");
                      setActiveTab("preparando");
                      updateOrderStatus(order.id, "preparando");
                    }}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 rounded-xl text-xs active:scale-[0.98] transition-transform">
                      {order.payment_method === "pix" ? "🍳 PRODUZIR" : "✓ ACEITAR"}
                    </button>
                  )}
                  {order.status === "preparando" && (
                    <button
                      onClick={() => {
                        const phone = getClientWhatsApp(order.client_id);
                        if (!evolutionConnected && !phone) {
                          alert(`Atenção: Cliente #${order.id.slice(0, 8)} sem telefone.`);
                        } else if (!evolutionConnected) {
                          const msg = buildReadyMessage(order);
                          openWhatsApp(phone, msg);
                        }
                        setDashboardTab("orders");
                        setActiveTab("pronto_para_entrega");
                        updateOrderStatus(order.id, "pronto_para_entrega" as OrderStatus);
                      }}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 rounded-xl text-xs active:scale-[0.98] transition-transform flex items-center justify-center no-underline"
                    >
                      🔔 MARCAR PRONTO
                    </button>
                  )}
                  {getClientWhatsApp(order.client_id) && (
                    <WhatsAppButton number={getClientWhatsApp(order.client_id)} message={`Olá! Sobre seu pedido #${order.id.slice(0, 8).toUpperCase()}, estamos cuidando dele!`} />
                  )}
                              
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )}

  {/* ── New Orders Queue ── */}
  {pendingCount > 0 && (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-3 h-3 bg-primary rounded-full animate-ping absolute" />
            <div className="w-3 h-3 bg-primary rounded-full relative" />
          </div>
          <h3 className="font-black text-foreground text-base tracking-tight">Novos Pedidos</h3>
          <span className="bg-primary text-primary-foreground text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-sm shadow-primary/30">
            {pendingCount}
          </span>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">aguardando aceite</span>
      </div>
      <div className="space-y-3">
        {orders?.filter(o => o.status === "pendente").slice(0, 5).map((order: any) => (
          <div key={order.id} className="bg-card border-2 border-primary/30 rounded-2xl p-4 hover:shadow-lg hover:shadow-primary/5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-xl font-black text-foreground">{formatBRL(Number(order.total_price))}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 flex-wrap">
              <div className="flex items-center gap-1"><User className="h-3 w-3" /><span className="font-medium">{getClientName(order.client_id)}</span></div>
              <span>•</span>
              <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /><span>{order.neighborhood}</span></div>
              <span>•</span>
              <span className="font-medium">{paymentIcons[order.payment_method]} {paymentLabels[order.payment_method] || order.payment_method}</span>
            </div>
            <div className="bg-muted/40 rounded-xl px-3 py-2.5 mb-3 space-y-1">
              {order.order_items?.map((item: any) => (
                <div key={item.id} className="text-sm text-foreground flex justify-between">
                  <span><span className="text-primary font-bold">{item.quantity}x</span> {getOrderItemDisplayName(item)}</span>
                  <span className="text-muted-foreground text-xs">{formatBRL(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            {order.payment_method === "pix" && (
              <div className="text-center mb-3">
                <span className="text-[11px] bg-muted text-muted-foreground px-3 py-1 rounded-lg font-bold inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> PIX Confirmado
                </span>
              </div>
            )}
            {/* CORREÇÃO: Link <a> em vez de button+window.open para evitar popup blocker */}
            <a
              href={buildAcceptWhatsAppHref(order)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (buildAcceptWhatsAppHref(order) === "#") e.preventDefault();
                handleAcceptOrder(order);
                updateOrderStatus(order.id, "preparando");
              }}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black py-3.5 rounded-xl text-sm active:scale-[0.98] transition-all h-12 flex items-center justify-center no-underline"
            >
              {order.payment_method === "pix" ? "🍳 COMEÇAR PRODUÇÃO" : "✓ ACEITAR PEDIDO"}
            </a>
            {cancelConfirm === order.id ? (
              <div className="mt-2 space-y-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-xs font-bold text-destructive">Motivo do cancelamento</p>
                {[
                  { value: "out_of_stock", label: "📦 Acabou no estoque" },
                  { value: "client_request", label: "👤 Cliente solicitou" },
                  { value: "out_of_area", label: "📍 Fora da área de entrega" },
                  { value: "closed", label: "🔒 Loja fechada / sem entregador" },
                  { value: "other", label: "📝 Outro motivo" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCancelReason(opt.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      cancelReason === opt.value
                        ? "border-destructive/30 bg-destructive/10 font-bold text-destructive"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={() => handleCancelOrder(order)}
                    disabled={!cancelReason || cancellingOrder}
                    className="flex-1 rounded-xl bg-destructive py-2.5 text-xs font-bold text-destructive-foreground disabled:opacity-40"
                  >
                    {cancellingOrder ? "Cancelando..." : "Confirmar Cancelamento"}
                  </button>
                  <button
                    onClick={() => { setCancelConfirm(null); setCancelReason(""); }}
                    className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setCancelConfirm(order.id); setCancelReason(""); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-destructive py-1.5 mt-1 transition-colors">
                Recusar pedido
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )}

  {/* ── In-Progress Summary ── */}
  {(preparingCount > 0 || readyCount > 0) && (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-foreground text-base">Em Andamento</h3>
        <button onClick={() => setDashboardTab("orders")} className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
          Ver todos <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
        {orders?.filter(o => ["preparando", "pronto_para_entrega", "em_transito", "saiu_entrega"].includes(o.status)).slice(0, 6).map((order: any) => {
          const sc = statusColors[order.status] || statusColors.pendente;
          return (
            <button key={order.id}
              onClick={() => { setDashboardTab("orders"); setActiveTab(order.status as OrderStatus); }}
              className={`flex-shrink-0 bg-card border-2 ${sc.border} rounded-2xl p-3 flex flex-col gap-2 min-w-[160px] hover:shadow-md transition-all`}>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full self-start ${sc.bg} ${sc.text}`}>{sc.label}</span>
              <span className="text-sm font-black text-foreground">#{order.id.slice(0, 6).toUpperCase()}</span>
              <span className="text-[11px] text-muted-foreground truncate w-full text-left">{getClientName(order.client_id)}</span>
            </button>
          );
        })}
      </div>
    </div>
  )}


  {/* ── Quick Actions ── */}
  <div className="space-y-3">
    <h3 className="font-black text-foreground text-base tracking-tight">Ações Rápidas</h3>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {[
        { label: "Cardápio", hint: "Itens e fotos", icon: UtensilsCrossed, tab: "menu" as DashboardTab },
        { label: "Finanças", hint: "Saques e taxas", icon: Coins, tab: "finance" as DashboardTab },
        { label: "Horários", hint: "Aberto/fechado", icon: Clock, tab: "hours" as DashboardTab },
        { label: "Configurações", hint: "Loja e entrega", icon: Settings, tab: "settings" as DashboardTab },
      ].map((action) => (
        <button
          key={action.label}
          onClick={() => setDashboardTab(action.tab)}
          className="group relative overflow-hidden flex items-center gap-3 bg-card border border-border rounded-2xl p-3.5 hover:shadow-md hover:shadow-primary/5 hover:border-primary/30 active:scale-[0.97] transition-all text-left"
        >
          <div className="pointer-events-none absolute -top-8 -right-8 w-20 h-20 bg-primary/0 group-hover:bg-primary/10 rounded-full blur-2xl transition-colors" />
          <div className="relative w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
            <action.icon className="h-5 w-5 text-primary" />
          </div>
          <div className="relative min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground leading-tight">{action.label}</span>
            <span className="block text-[10px] text-muted-foreground/80 mt-0.5 truncate">{action.hint}</span>
          </div>
        </button>
      ))}
    </div>
  </div>

  {/* ── Empty state ── */}
  {pendingCount === 0 && preparingCount === 0 && readyCount === 0 && todayCount === 0 && clientAnalytics.length === 0 && (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-24 h-24 bg-muted/50 rounded-3xl flex items-center justify-center mb-5">
        <Store className="h-12 w-12 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-black text-foreground mb-2">Tudo tranquilo por aqui! 😌</h3>
      <p className="text-sm text-muted-foreground max-w-xs">Nenhum pedido ainda hoje. Compartilhe o link da sua loja para começar a receber pedidos!</p>
      <button onClick={() => setDashboardTab("settings")}
        className="mt-4 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl text-sm active:scale-[0.97] transition-transform">
        Configurar Loja
      </button>
    </div>
  )}
</div>
  );
}
