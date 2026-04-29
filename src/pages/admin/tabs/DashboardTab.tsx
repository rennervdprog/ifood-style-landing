import React from "react";
import { 
  ShoppingBag, DollarSign, Timer, Users, GraduationCap, 
  ArrowUpRight, Banknote, Navigation, Bike, AlertTriangle, 
  ChevronUp, ChevronDown, Store, CreditCard
} from "lucide-react";
import { useAdmin } from "../AdminContext";
import { formatBRL } from "@/lib/utils";
import { OrderCard } from "@/components/OrderCard";
import CommissionAlert from "@/components/CommissionAlert";
import PlatformSplitAlert from "@/components/PlatformSplitAlert";
import SimulationBanner from "@/components/SimulationBanner";
import { statusColors } from "@/lib/orderStatus";

const GlanceCard = ({ icon: Icon, label, value, subValue, color, trend, highlight, onClick }: any) => (
  <button onClick={onClick} className={`bg-card border border-border rounded-3xl p-5 text-left transition-all ${onClick ? "hover:shadow-lg hover:border-primary/30 active:scale-[0.98]" : ""} ${highlight ? "ring-2 ring-primary/20 shadow-md" : ""}`}>
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 ${color.replace("text-", "bg-")}/10 rounded-2xl flex items-center justify-center`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      {trend && (
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${trend === "up" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>
          {trend === "up" ? "↑ BOM" : "↓ BAIXO"}
        </span>
      )}
    </div>
    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
    <h3 className="text-2xl font-black text-foreground mt-0.5">{value}</h3>
    <p className="text-[10px] text-muted-foreground mt-1.5 font-medium flex items-center gap-1 italic">{subValue}</p>
  </button>
);

const DashboardTab = () => {
  const { 
    store, isApproved, profileLoading, storeLoading, orders,
    todayTotal, todayCount, pendingCount, preparingCount, readyCount,
    avgDeliveryTime, clientAnalytics, isOwnDelivery, hasLinkedDrivers,
    driversLoading, onlineDrivers, setDashboardTab, setActiveTab,
    updateOrderStatus, toggleStoreOpen, getClientName, storePlan,
    allHoursClosed, delayedOrders, showDelayedPanel, setShowDelayedPanel,
    paymentIcons, paymentLabels, getMainAction
  } = useAdmin();

  if (!isApproved && !profileLoading) {
    return (
      <div className="p-4 lg:p-6 max-w-lg mx-auto flex flex-col items-center justify-center text-center min-h-[60vh]">
        <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-5">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">Cadastro em Análise 🔍</h2>
        <p className="text-sm text-muted-foreground max-w-xs mb-3">
          Recebemos seus dados com sucesso! Em até <span className="font-bold text-foreground">24 horas</span> o administrador liberará seu acesso.
        </p>
        <button onClick={() => window.location.reload()} className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl text-sm">
          Verificar Status
        </button>
      </div>
    );
  }

  if (storeLoading) return null;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5 lg:space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 rounded-3xl p-5 lg:p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg lg:text-xl font-black text-foreground">
              Olá, {store?.name}! 👋
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
            store?.is_open 
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" 
              : "bg-red-500/10 text-red-500 border border-red-500/20"
          }`}>
            <div className={`w-2 h-2 rounded-full ${store?.is_open ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            {store?.is_open ? "Aberta" : "Fechada"}
          </div>
        </div>
      </div>

      {allHoursClosed && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-amber-600 dark:text-amber-400 text-sm">⚠️ Configure seus horários</h3>
            <p className="text-xs text-muted-foreground mt-1">Sua loja está com todos os horários fechados.</p>
            <button onClick={() => setDashboardTab("hours")}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-500/10 px-3 py-1.5 rounded-lg transition-colors">
              Configurar Horários
            </button>
          </div>
        </div>
      )}

      {isOwnDelivery && !driversLoading && !hasLinkedDrivers && (
        <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-red-600 dark:text-red-400 text-sm">🛵 Cadastre um motoboy</h3>
            <p className="text-xs text-muted-foreground mt-1">Vincule um entregador para poder despachar pedidos.</p>
            <button onClick={() => setDashboardTab("drivers")}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-white bg-red-500 px-3 py-1.5 rounded-lg">
              Cadastrar Motoboy
            </button>
          </div>
        </div>
      )}

      {store && storePlan.hasCommission && (
        <CommissionAlert storeId={store.id} storeName={store.name} onGoToFinance={() => setDashboardTab("finance")} />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <GlanceCard
          icon={ShoppingBag} label="Pedidos Pendentes" value={pendingCount}
          subValue={preparingCount > 0 ? `+ ${preparingCount} em preparo` : "Sem pedidos novos"}
          color={pendingCount > 0 ? "text-amber-500" : "text-muted-foreground"}
          highlight={pendingCount > 0}
          onClick={() => { setDashboardTab("orders"); setActiveTab("pendente"); }}
        />
        <GlanceCard
          icon={DollarSign} label="Faturamento Hoje" value={formatBRL(todayTotal)}
          subValue={`${todayCount} pedido${todayCount !== 1 ? "s" : ""} hoje`}
          color="text-emerald-500" trend={todayTotal > 0 ? "up" : null}
          onClick={() => setDashboardTab("finance")}
        />
        <GlanceCard
          icon={Timer} label="Tempo Médio" value={avgDeliveryTime ? `${avgDeliveryTime} min` : "—"}
          subValue="Pedido até entrega" color="text-purple-500"
        />
        <GlanceCard
          icon={Users} label="Total Clientes" value={clientAnalytics.length}
          subValue="Clientes registrados" color="text-blue-500"
          onClick={() => setDashboardTab("clients")}
        />
      </div>

      {delayedOrders.length > 0 && (
        <div className="bg-red-500/5 border-2 border-red-500/20 rounded-2xl overflow-hidden">
          <button onClick={() => setShowDelayedPanel(!showDelayedPanel)} className="w-full flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div className="text-left">
                <span className="text-sm font-black text-red-600 dark:text-red-400">{delayedOrders.length} pedido{delayedOrders.length > 1 ? "s" : ""} em atraso</span>
                <p className="text-[10px] text-muted-foreground">Mais de 20 min sem atualização</p>
              </div>
            </div>
            {showDelayedPanel ? <ChevronUp className="h-5 w-5 text-red-500" /> : <ChevronDown className="h-5 w-5 text-red-500" />}
          </button>
          {showDelayedPanel && (
            <div className="px-4 pb-4 space-y-2">
              {delayedOrders.map((order: any) => (
                <OrderCard key={order.id} order={order} onStatusChange={(id, status) => { setDashboardTab("orders"); setActiveTab(status); updateOrderStatus(id, status); }} getClientName={getClientName} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: "Cardápio", icon: Store, tab: "menu", color: "text-orange-500", bg: "bg-orange-500/10" },
          { label: "Finanças", icon: Banknote, tab: "finance", color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Horários", icon: Timer, tab: "hours", color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Configurações", icon: Users, tab: "settings", color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map((action) => (
          <button key={action.label} onClick={() => setDashboardTab(action.tab)}
            className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3.5 hover:shadow-md active:scale-[0.97] transition-all text-left">
            <div className={`w-10 h-10 ${action.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <action.icon className={`h-5 w-5 ${action.color}`} />
            </div>
            <span className="text-sm font-bold text-foreground">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DashboardTab;
