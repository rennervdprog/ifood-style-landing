import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarCheck, ArrowRight, TrendingUp, PiggyBank, Users, Clock } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface Partner {
  id: string;
  name: string;
  profit_percent: number;
  emergency_fund_percent: number;
  is_owner: boolean;
  is_active: boolean;
}

interface SettlementProps {
  partners: Partner[];
}

function getSettlementPeriods() {
  const now = new Date();
  const day = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Next payout date
  let nextPayoutDay: number;
  let periodStart: Date;
  let periodEnd: Date;

  if (day < 5) {
    // Next payout: day 5 of this month → covers 16th to end of previous month
    nextPayoutDay = 5;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    periodStart = new Date(prevYear, prevMonth, 16);
    const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
    periodEnd = new Date(prevYear, prevMonth, lastDay, 23, 59, 59);
  } else if (day < 20) {
    // Next payout: day 20 of this month → covers 1st to 15th of this month
    nextPayoutDay = 20;
    periodStart = new Date(year, month, 1);
    periodEnd = new Date(year, month, 15, 23, 59, 59);
  } else {
    // Next payout: day 5 of next month → covers 16th to end of this month
    nextPayoutDay = 5;
    periodStart = new Date(year, month, 16);
    const lastDay = new Date(year, month + 1, 0).getDate();
    periodEnd = new Date(year, month, lastDay, 23, 59, 59);
  }

  const nextPayoutDate = day >= 20
    ? new Date(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, 5)
    : new Date(year, month, nextPayoutDay);

  const daysUntilPayout = Math.ceil((nextPayoutDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return { periodStart, periodEnd, nextPayoutDate, nextPayoutDay, daysUntilPayout };
}

const PartnerSettlement = ({ partners }: SettlementProps) => {
  const { periodStart, periodEnd, nextPayoutDate, daysUntilPayout } = useMemo(() => getSettlementPeriods(), []);

  // Revenue from finalized orders in period (commissions)
  const { data: periodOrders = { count: 0, totalCommission: 0, totalSubtotal: 0 } } = useQuery({
    queryKey: ["settlement-orders", periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("app_fee, subtotal")
        .eq("status", "finalizado")
        .gte("created_at", periodStart.toISOString())
        .lte("created_at", periodEnd.toISOString());
      if (error) throw error;
      return {
        count: (data || []).length,
        totalCommission: (data || []).reduce((s, o) => s + Number(o.app_fee || 0), 0),
        totalSubtotal: (data || []).reduce((s, o) => s + Number(o.subtotal || 0), 0),
      };
    },
  });

  // Active plan fees (monthly, pro-rated to half month)
  const { data: planFees = 0 } = useQuery({
    queryKey: ["settlement-plan-fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_plans")
        .select("monthly_fee")
        .eq("is_active", true);
      if (error) throw error;
      const totalMonthly = (data || []).reduce((s, p) => s + Number(p.monthly_fee || 0), 0);
      return totalMonthly / 2; // Half-month per payout period
    },
  });

  // Pending balances (commission + repasse)
  const { data: pendingBalances = 0 } = useQuery({
    queryKey: ["settlement-pending"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_balances").select("comissao_pendente, repasse_pendente");
      if (error) throw error;
      return (data || []).reduce((s, b) => s + Number(b.comissao_pendente || 0) + Number(b.repasse_pendente || 0), 0);
    },
  });

  // Already paid this period
  const { data: alreadyPaid = 0 } = useQuery({
    queryKey: ["settlement-already-paid", periodStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_payouts")
        .select("net_amount")
        .gte("created_at", periodStart.toISOString())
        .eq("status", "paid");
      if (error) throw error;
      return (data || []).reduce((s, p) => s + Number(p.net_amount || 0), 0);
    },
  });

  const totalPeriodRevenue = periodOrders.totalCommission + planFees + pendingBalances;
  const activePartners = partners.filter(p => p.is_active);

  const formatDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const formatShortDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" /> Fechamento — Próximo Repasse
          </CardTitle>
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" />
            {daysUntilPayout} dias
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Info */}
        <div className="flex items-center justify-between bg-muted/60 rounded-lg p-3">
          <div>
            <p className="text-xs text-muted-foreground">Período</p>
            <p className="font-medium text-sm">{formatDate(periodStart)} → {formatDate(periodEnd)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Data do repasse</p>
            <p className="font-bold text-primary">{formatDate(nextPayoutDate)}</p>
          </div>
        </div>

        {/* Revenue Sources */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Receitas do Período
          </h4>
          <div className="space-y-1">
            <div className="flex justify-between text-sm bg-muted/40 rounded px-3 py-2">
              <span>Comissões ({periodOrders.count} pedidos finalizados)</span>
              <span className="font-medium">{formatBRL(periodOrders.totalCommission)}</span>
            </div>
            <div className="flex justify-between text-sm bg-muted/40 rounded px-3 py-2">
              <span>Assinaturas (quinzena)</span>
              <span className="font-medium">{formatBRL(planFees)}</span>
            </div>
            <div className="flex justify-between text-sm bg-muted/40 rounded px-3 py-2">
              <span>Saldos pendentes acumulados</span>
              <span className="font-medium">{formatBRL(pendingBalances)}</span>
            </div>
          </div>
          <div className="flex justify-between font-bold text-sm px-3 pt-1">
            <span>Total Receita do Período</span>
            <span className="text-primary">{formatBRL(totalPeriodRevenue)}</span>
          </div>
        </div>

        <Separator />

        {/* Partner Split */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" /> Quanto Cada Sócio Recebe
          </h4>
          <div className="space-y-3">
            {activePartners.map(p => {
              const gross = totalPeriodRevenue * (p.profit_percent / 100);
              const emergencyDeduction = gross * (p.emergency_fund_percent / 100);
              const net = gross - emergencyDeduction;

              return (
                <div key={p.id} className="bg-background border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {p.is_owner && <Badge variant="secondary" className="text-xs">Dono</Badge>}
                      <Badge className="text-xs">{p.profit_percent}%</Badge>
                    </div>
                    <span className="text-lg font-bold text-green-600">{formatBRL(net)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Bruto: {formatBRL(gross)}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="text-amber-600">Fundo ({p.emergency_fund_percent}%): -{formatBRL(emergencyDeduction)}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="text-green-600 font-semibold">Líquido: {formatBRL(net)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Emergency Fund Total */}
        <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium">Depósito no Fundo de Emergência</span>
          </div>
          <span className="font-bold text-amber-600">
            {formatBRL(activePartners.reduce((s, p) => {
              const gross = totalPeriodRevenue * (p.profit_percent / 100);
              return s + gross * (p.emergency_fund_percent / 100);
            }, 0))}
          </span>
        </div>

        {alreadyPaid > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            Já pago neste período: {formatBRL(alreadyPaid)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PartnerSettlement;
