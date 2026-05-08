import { ShoppingBag, DollarSign, Timer, Users, GraduationCap, AlertTriangle, ChevronRight, Monitor, ArrowUpRight } from "lucide-react";
import { GlanceCard } from "../components/GlanceCard";
import { formatBRL } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useStorePlan } from "@/hooks/useStorePlan";
import CommissionAlert from "@/components/CommissionAlert";
import PlatformSplitAlert from "@/components/PlatformSplitAlert";

interface DashboardTabProps {
  store: any;
  pendingCount: number;
  preparingCount: number;
  todayTotal: number;
  todayCount: number;
  avgDeliveryTime: number | null;
  clientCount: number;
  delayedOrders: any[];
  setDashboardTab: (tab: any) => void;
  setActiveTab: (tab: any) => void;
  allHoursClosed: boolean;
  isOwnDelivery: boolean;
  driversLoading: boolean;
  hasLinkedDrivers: boolean;
}

const DashboardTab = ({
  store,
  pendingCount,
  preparingCount,
  todayTotal,
  todayCount,
  avgDeliveryTime,
  clientCount,
  delayedOrders,
  setDashboardTab,
  setActiveTab,
  allHoursClosed,
  isOwnDelivery,
  driversLoading,
  hasLinkedDrivers
}: DashboardTabProps) => {
  const navigate = useNavigate();
  const storePlan = useStorePlan(store?.id);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Status Alerts ── */}
      <div className="space-y-3">
        {allHoursClosed && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-amber-600 dark:text-amber-400 text-sm">⚠️ Configure seus horários</h3>
              <p className="text-xs text-muted-foreground mt-1">Sua loja está com todos os horários fechados.</p>
              <button onClick={() => setDashboardTab("hours")} className="mt-2 text-xs font-bold text-amber-600 bg-amber-500/10 px-3 py-1.5 rounded-lg">Configurar Agora</button>
            </div>
          </div>
        )}

        {isOwnDelivery && !driversLoading && !hasLinkedDrivers && (
          <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-red-600 dark:text-red-400 text-sm">🛵 Cadastre um motoboy</h3>
              <p className="text-xs text-muted-foreground mt-1">Sem um entregador cadastrado, você não conseguirá despachar pedidos.</p>
              <button onClick={() => setDashboardTab("drivers")} className="mt-2 text-xs font-bold text-white bg-red-500 px-3 py-1.5 rounded-lg">Cadastrar Agora</button>
            </div>
          </div>
        )}

        {storePlan.hasCommission && (
          <CommissionAlert storeId={store.id} storeName={store.name} onGoToFinance={() => setDashboardTab("finance")} />
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
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
          icon={Users} label="Total Clientes" value={clientCount}
          subValue="Clientes registrados" color="text-blue-500"
          onClick={() => setDashboardTab("clients")}
        />
      </div>

      {/* ── PDV Banner ── */}
      {storePlan.pdvEnabled !== false && (
        <button onClick={() => navigate("/admin/pdv")} className="w-full text-left bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 rounded-3xl p-5 flex items-center gap-4 group">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Monitor className="h-7 w-7 text-blue-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-foreground">PDV — Caixa Presencial</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Venda no balcão ou mesa sem taxas PIX.</p>
          </div>
          <ChevronRight className="h-6 w-6 text-blue-500" />
        </button>
      )}

      {/* ── Tutorial ── */}
      <button onClick={() => setDashboardTab("tutoriais")} className="w-full bg-primary/10 border-2 border-primary/20 rounded-3xl p-5 flex items-center gap-4 group">
        <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center shrink-0">
          <GraduationCap className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-black text-foreground text-base">📚 Tutoriais Completos</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Aprenda a usar o painel passo a passo.</p>
        </div>
        <ArrowUpRight className="h-6 w-6 text-primary" />
      </button>
    </div>
  );
};

export default DashboardTab;