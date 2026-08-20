import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { REPASSE_RULES } from "@/lib/repasseRules";
import { FINANCE_COPY } from "@/lib/financeCommunication";

interface Props {
  storeId: string;
  onPayClick?: () => void;
}

export default function ValorAPagarCard({ storeId, onPayClick }: Props) {
  const { data } = useQuery({
    queryKey: ["valor-a-pagar", storeId],
    queryFn: async () => {
      const [{ data: bal }, { data: plan }, { data: monthlyCharges }] = await Promise.all([
        (supabase as any).from("store_balances").select("repasse_pendente, comissao_pendente").eq("store_id", storeId).maybeSingle(),
        (supabase as any).from("store_plans").select("pdv_commission_pending").eq("store_id", storeId).eq("is_active", true).maybeSingle(),
        (supabase as any).from("financial_transactions").select("amount").eq("store_id", storeId).eq("transaction_kind", "monthly_fee").eq("status", "pending").limit(50),
      ]);

      const repasse = Number(bal?.repasse_pendente || 0);
      const comissao = Number(bal?.comissao_pendente || 0);
      const pdv = Number(plan?.pdv_commission_pending || 0);
      const mensalidade = (monthlyCharges || []).reduce((sum: number, charge: any) => sum + Number(charge.amount || 0), 0);
      const operationalTotal = repasse + comissao + pdv;
      const total = operationalTotal + mensalidade;
      return { repasse, comissao, pdv, mensalidade, operationalTotal, total };
    },
    refetchInterval: 60_000,
  });

  const total = data?.total ?? 0;
  const isZero = total === 0;
  const blocked = (data?.operationalTotal ?? 0) >= REPASSE_RULES.BLOCK_THRESHOLD_BRL;

  return (
    <Card className={blocked ? "rounded-none border-0 border-l-4 border-l-destructive bg-card shadow-none" : isZero ? "rounded-none border-0 border-l-4 border-l-emerald-500 bg-card shadow-none" : "rounded-none border-0 border-l-4 border-l-amber-500 bg-card shadow-none"}>
      <CardContent className="space-y-3 px-4 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{FINANCE_COPY.outstandingShortTitle}</div>
          {blocked ? <AlertTriangle className="h-4 w-4 text-destructive" /> : isZero ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
        </div>
        <div className={`text-3xl font-black ${blocked ? "text-destructive" : isZero ? "text-emerald-500" : "text-foreground"}`}>{formatBRL(total)}</div>

        {!isZero && data && (
          <div className="space-y-1 text-xs border-t pt-2">
            {data.mensalidade > 0 && <Line label="Mensalidade pendente" value={data.mensalidade} />}
            {data.repasse > 0 && <Line label="Taxa de plataforma nas entregas" value={data.repasse} />}
            {data.comissao > 0 && <Line label="Comissão sobre vendas" value={data.comissao} />}
            {data.pdv > 0 && <Line label="Taxa PDV por venda" value={data.pdv} />}
          </div>
        )}

        {blocked && (
          <div className="text-xs text-destructive font-semibold border-t border-destructive/30 pt-2">
            ⚠️ Loja bloqueada: taxas e comissões operacionais acumuladas em {formatBRL(REPASSE_RULES.BLOCK_THRESHOLD_BRL)} ou mais. Quite os valores para que a situação seja reavaliada.
          </div>
        )}

        {isZero ? (
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Tudo em dia. Nenhum valor pendente.</div>
        ) : (
          <Button onClick={onPayClick} className="w-full font-bold gap-2" size="sm">
            Ver cobranças PIX <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{label}</span><span className="font-bold">{formatBRL(value)}</span></div>;
}
