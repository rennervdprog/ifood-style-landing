import { AlertTriangle, ChevronRight, Clock, Bike, Bell, CheckCircle2 } from "lucide-react";
import CommissionAlert from "@/components/CommissionAlert";
import PlatformSplitAlert from "@/components/PlatformSplitAlert";

interface Props {
  store: any;
  storePlan: any;
  allHoursClosed: boolean;
  isOwnDelivery: boolean;
  driversLoading: boolean;
  hasLinkedDrivers: boolean;
  setDashboardTab: (t: any) => void;
  count: number;
}

export default function AvisosSection({
  store,
  storePlan,
  allHoursClosed,
  isOwnDelivery,
  driversLoading,
  hasLinkedDrivers,
  setDashboardTab,
  count,
}: Props) {
  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-black text-foreground tracking-tight">Avisos</h2>
          <p className="text-xs text-muted-foreground">
            {count > 0
              ? `${count} pendência${count > 1 ? "s" : ""} para resolver`
              : "Nenhuma pendência no momento"}
          </p>
        </div>
      </div>

      {count === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h3 className="font-black text-foreground mb-1">Tudo em ordem! 🎉</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Sua loja não tem nenhum aviso pendente. Quando algo precisar da sua atenção, vai aparecer aqui.
          </p>
        </div>
      )}

      {!store.asaas_wallet_id && (
        <button
          onClick={() => setDashboardTab("finance")}
          className="w-full text-left bg-destructive/10 border-2 border-destructive/40 rounded-2xl p-4 flex items-start gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive text-destructive-foreground flex-shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-destructive text-sm">
              Configure sua conta de recebimento (prioridade)
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Você ainda não criou sua subconta Asaas. <strong>Sem ela, você não recebe os pagamentos PIX</strong> dos pedidos. Leva 2 minutos e é gratuito.
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-destructive-foreground bg-destructive px-3 py-1.5 rounded-lg">
              Configurar agora <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </button>
      )}

      {allHoursClosed && (
        <div className="bg-muted border border-border rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-foreground text-sm">Configure seus horários</h3>
            <p className="text-xs text-muted-foreground mt-1">Sua loja está com todos os horários fechados.</p>
            <button
              onClick={() => setDashboardTab("hours")}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Clock className="inline h-3 w-3 mr-1" /> Configurar Horários
            </button>
          </div>
        </div>
      )}

      {isOwnDelivery && !driversLoading && !hasLinkedDrivers && (
        <div className="bg-destructive/10 border-2 border-destructive/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-destructive text-sm">Cadastre um motoboy para receber pedidos</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Sua loja está configurada como <strong>Entrega Própria</strong>, mas você ainda não vinculou nenhum motoboy. Sem um entregador cadastrado, <strong>você não conseguirá despachar pedidos</strong>.
            </p>
            <button
              onClick={() => setDashboardTab("drivers")}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-destructive-foreground bg-destructive hover:bg-destructive/90 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Bike className="inline h-3 w-3 mr-1" /> Cadastrar Motoboy Agora
            </button>
          </div>
        </div>
      )}

      {storePlan.hasCommission && (
        <CommissionAlert
          storeId={store.id}
          storeName={store.name}
          onGoToFinance={() => setDashboardTab("finance")}
        />
      )}
      {!storePlan.hasCommission && storePlan.isItatingaFixed && (storePlan.platformDeliverySplit || 0) > 0 && (
        <PlatformSplitAlert
          storeId={store.id}
          storeName={store.name}
          splitPerOrder={storePlan.platformDeliverySplit}
          onGoToFinance={() => setDashboardTab("finance")}
        />
      )}
    </div>
  );
}