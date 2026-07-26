import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, TrendingUp, DollarSign, Truck, Store as StoreIcon, LucideIcon } from "lucide-react";
import { formatBRL } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * MetricCard — KPI card reutilizado no header do dashboard.
 * ─────────────────────────────────────────────────────────── */
export interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  sublabel2?: string;
  highlight?: boolean;
  alert?: boolean;
}

export const MetricCard = ({ icon: Icon, label, value, sublabel, sublabel2, highlight, alert }: MetricCardProps) => (
  <Card
    className={
      "p-3 " +
      (highlight ? "border-primary/40 bg-primary/5 " : "") +
      (alert ? "border-destructive/40 bg-destructive/5 " : "")
    }
  >
    <div className="flex items-center gap-2 mb-1">
      <Icon className={"h-4 w-4 " + (alert ? "text-destructive" : "text-muted-foreground")} />
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</span>
    </div>
    <div className={"text-lg font-black " + (alert ? "text-destructive" : "text-foreground")}>{value}</div>
    {sublabel && <div className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</div>}
    {sublabel2 && <div className="text-[11px] text-muted-foreground">{sublabel2}</div>}
  </Card>
);

/* ─────────────────────────────────────────────────────────────
 * FinanceTab — visão geral financeira (lojas + entregadores).
 * ─────────────────────────────────────────────────────────── */
type StoreEntry = {
  name: string; storeId: string; physicalSales: number; appSales: number; totalSales: number;
  commissionDue: number; netTransfer: number; finalBalance: number; orderCount: number; deliveryFees: number;
  pdvSales: number; pdvOrders: number; pdvCommission: number;
};
type DriverEntry = {
  name: string; driverId: string; totalFees: number; cashFees: number; appFees: number; deliveryCount: number;
};

export interface FinanceTabProps {
  storeSettlement: StoreEntry[];
  driverSettlement: DriverEntry[];
  financeTotals: { totalVolume: number; grossProfit: number; totalDriverFees: number };
  financeFilter: "week" | "month";
  setFinanceFilter: (v: "week" | "month") => void;
  financeSubTab: "stores" | "drivers" | "subaccounts";
  setFinanceSubTab: (v: "stores" | "drivers" | "subaccounts") => void;
  selectedStore: string;
  setSelectedStore: (v: string) => void;
  stores: any[];
  loading: boolean;
  generateStoreWhatsApp: (entry: StoreEntry) => void;
  storeBalances: any[];
  queryClient: any;
  withdrawalRequests: any[];
  parentStorePlans: any[];
}

export const FinanceTab = ({
  storeSettlement,
  driverSettlement,
  financeTotals,
  financeFilter,
  setFinanceFilter,
  financeSubTab,
  setFinanceSubTab,
  selectedStore,
  setSelectedStore,
  stores,
  loading,
  generateStoreWhatsApp,
}: FinanceTabProps) => {
  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {(["week", "month"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFinanceFilter(f)}
              className={
                "px-3 py-1.5 text-xs font-semibold rounded-md transition " +
                (financeFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
              }
            >
              {f === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>

        <select
          value={selectedStore}
          onChange={(e) => setSelectedStore(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2 text-xs"
        >
          <option value="all">Todas as lojas</option>
          {stores.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard icon={TrendingUp} label="Volume Total" value={formatBRL(financeTotals.totalVolume)} />
        <MetricCard icon={DollarSign} label="Lucro Bruto (Comissões)" value={formatBRL(financeTotals.grossProfit)} highlight />
        <MetricCard icon={Truck} label="Taxas de Entrega (App)" value={formatBRL(financeTotals.totalDriverFees)} />
      </div>

      {/* Subabas */}
      <div className="flex items-center gap-1 border-b border-border">
        {([
          { k: "stores", label: "Lojas" },
          { k: "drivers", label: "Entregadores" },
          { k: "subaccounts", label: "Subcontas Asaas" },
        ] as const).map((tab) => (
          <button
            key={tab.k}
            onClick={() => setFinanceSubTab(tab.k)}
            className={
              "px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition " +
              (financeSubTab === tab.k
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
        </div>
      )}

      {!loading && financeSubTab === "stores" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><StoreIcon className="h-4 w-4" /> Fechamento por Loja</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {storeSettlement.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Sem vendas no período.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold">Loja</th>
                      <th className="px-3 py-2 font-semibold text-right">Pedidos</th>
                      <th className="px-3 py-2 font-semibold text-right">Vendas</th>
                      <th className="px-3 py-2 font-semibold text-right">Comissão</th>
                      <th className="px-3 py-2 font-semibold text-right">Saldo</th>
                      <th className="px-3 py-2 font-semibold text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeSettlement.map((e) => (
                      <tr key={e.storeId} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{e.name}</td>
                        <td className="px-3 py-2 text-right">{e.orderCount}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(e.totalSales)}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(e.commissionDue)}</td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant={e.finalBalance >= 0 ? "default" : "destructive"}>
                            {formatBRL(e.finalBalance)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => generateStoreWhatsApp(e)}>
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && financeSubTab === "drivers" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" /> Fechamento por Entregador</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {driverSettlement.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Sem entregas no período.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold">Entregador</th>
                      <th className="px-3 py-2 font-semibold text-right">Entregas</th>
                      <th className="px-3 py-2 font-semibold text-right">Taxa Total</th>
                      <th className="px-3 py-2 font-semibold text-right">A pagar (App)</th>
                      <th className="px-3 py-2 font-semibold text-right">Já recebeu (Dinheiro)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverSettlement.map((d) => (
                      <tr key={d.driverId} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{d.name}</td>
                        <td className="px-3 py-2 text-right">{d.deliveryCount}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(d.totalFees)}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(d.appFees)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatBRL(d.cashFees)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && financeSubTab === "subaccounts" && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground text-center">
            Consulte o painel dedicado de subcontas em <strong>Financeiro → Conciliação Asaas</strong>.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinanceTab;