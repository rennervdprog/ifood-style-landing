import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Truck, Wallet, AlertCircle, Calendar } from "lucide-react";
import { formatBRL } from "@/lib/utils";

/**
 * Painel exclusivo do admin: mostra quanto a plataforma tem a receber
 * de cada loja com plano FIXO.
 * - Mensalidade (R$ 90/R$75 novos; R$ 180/R$130 legado) - cobrada via PIX no dia X
 * - Taxa de R$2/entrega acumulada (repasse_pendente)
 * - Comissão pendente residual (caso plano fixo + commission_rate>0)
 */
const AdminFixedPlanReceivables = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-fixed-plan-receivables"],
    queryFn: async () => {
      // Stores com plano fixo ativo (não-teste)
      const { data: plans, error: pErr } = await supabase
        .from("store_plans")
        .select("store_id, plan_type, monthly_fee, commission_rate, next_billing_date, last_billed_at, trial_ends_at, started_at")
        .eq("is_active", true)
        .eq("plan_type", "fixed");
      if (pErr) throw pErr;

      const storeIds = (plans || []).map((p: any) => p.store_id);
      if (storeIds.length === 0) return [];

      const [{ data: stores }, { data: balances }] = await Promise.all([
        supabase.from("stores").select("id, name, owner_id, is_test, delivery_mode").in("id", storeIds),
        supabase.from("store_balances").select("store_id, repasse_pendente, comissao_pendente").in("store_id", storeIds),
      ]);

      return (plans || [])
        .map((p: any) => {
          const s = stores?.find((x: any) => x.id === p.store_id);
          if (!s || s.is_test) return null;
          const bal = balances?.find((b: any) => b.store_id === p.store_id);
          const repasse = Number(bal?.repasse_pendente || 0);
          const comissao = Number(bal?.comissao_pendente || 0);
          const monthly = Number(p.monthly_fee || 0);
          return {
            store_id: p.store_id,
            name: s.name as string,
            delivery_mode: s.delivery_mode as string,
            monthly,
            repasse,
            comissao,
            total: monthly + comissao, // repasse é passivo (a pagar), não receita
            next_billing_date: p.next_billing_date as string | null,
            last_billed_at: p.last_billed_at as string | null,
            trial_ends_at: p.trial_ends_at as string | null,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.total - a.total) as any[];
    },
    refetchInterval: 30_000,
  });

  const totalMonthly = (data || []).reduce((s, r: any) => s + r.monthly, 0); // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalRepasse = (data || []).reduce((s, r: any) => s + r.repasse, 0);
  const totalComissao = (data || []).reduce((s, r: any) => s + r.comissao, 0);
  // grandTotal = receita da plataforma (mensalidades + comissões)
  // repasse_pendente = valor que a PLATAFORMA deve AO lojista (R$2 por entrega acumulado)
  // NÃO deve ser somado à receita — é um passivo, não receita
  const grandTotal = totalMonthly + totalComissao;
  const totalPassivo = totalRepasse; // a pagar aos lojistas

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      {/* Resumo geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Crown className="w-4 h-4" /> Mensalidades
            </div>
            <p className="text-2xl font-bold">{formatBRL(totalMonthly)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Truck className="w-4 h-4" /> Taxas Entrega
            </div>
            <p className="text-2xl font-bold">{formatBRL(totalRepasse)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wallet className="w-4 h-4" /> Comissões
            </div>
            <p className="text-2xl font-bold">{formatBRL(totalComissao)}</p>
          </CardContent>
        </Card>
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <AlertCircle className="w-4 h-4" /> TOTAL A RECEBER
            </div>
            <p className="text-2xl font-bold text-primary">{formatBRL(grandTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista por loja */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            A Receber por Loja — Plano Fixo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data || []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma loja com plano fixo ativo.
            </p>
          )}
          {(data || []).map((row: any) => (
            <div
              key={row.store_id}
              className="border rounded-lg p-3 bg-muted/30 hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{row.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {row.delivery_mode === "own" ? "🛵 Entrega Própria" : "🚚 Plataforma"}
                  </Badge>
                  {row.trial_ends_at && new Date(row.trial_ends_at) > new Date() && (
                    <Badge variant="secondary" className="text-xs">Trial</Badge>
                  )}
                </div>
                <span className="font-bold text-lg text-primary">{formatBRL(row.total)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-background rounded px-2 py-1.5">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Mensalidade
                  </div>
                  <div className="font-semibold">{formatBRL(row.monthly)}</div>
                </div>
                <div className="bg-background rounded px-2 py-1.5">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Truck className="w-3 h-3" /> A Repassar (R$2)
                  </div>
                  <div className="font-semibold text-amber-500">-{formatBRL(row.repasse)}</div>
                </div>
                <div className="bg-background rounded px-2 py-1.5">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Wallet className="w-3 h-3" /> Comissão
                  </div>
                  <div className="font-semibold">{formatBRL(row.comissao)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Próx. cobrança: <strong>{formatDate(row.next_billing_date)}</strong>
                </span>
                {row.last_billed_at && (
                  <span>Última: {formatDate(row.last_billed_at)}</span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFixedPlanReceivables;