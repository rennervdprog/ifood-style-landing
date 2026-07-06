import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface Props {
  storeId: string;
  onPayClick?: () => void;
}

export default function ValorAPagarCard({ storeId, onPayClick }: Props) {
  const { data } = useQuery({
    queryKey: ["valor-a-pagar", storeId],
    queryFn: async () => {
      // Fonte única da verdade: mesmo saldo usado na aba Repasse e pelo cron
      // (store_balances + store_plans.pdv_commission_pending).
      const [{ data: bal }, { data: plan }] = await Promise.all([
        (supabase as any)
          .from("store_balances")
          .select("repasse_pendente, comissao_pendente")
          .eq("store_id", storeId)
          .maybeSingle(),
        (supabase as any)
          .from("store_plans")
          .select("pdv_commission_pending")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .maybeSingle(),
      ]);
      const repasse = Number(bal?.repasse_pendente || 0);
      const comissao = Number(bal?.comissao_pendente || 0);
      const pdv = Number(plan?.pdv_commission_pending || 0);
      const mensalidade = 0;
      const total = repasse + comissao + pdv + mensalidade;
      return { repasse, comissao, pdv, mensalidade, total };
    },
    refetchInterval: 60_000,
  });

  const total = data?.total ?? 0;
  const isZero = total === 0;
  const blocked = total >= 500;

  return (
    <Card className={blocked ? "border-destructive bg-destructive/5" : isZero ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">A pagar à plataforma</div>
          {blocked ? <AlertTriangle className="h-4 w-4 text-destructive" /> : isZero ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
        </div>
        <div className={`text-3xl font-black ${blocked ? "text-destructive" : isZero ? "text-emerald-500" : "text-foreground"}`}>
          {formatBRL(total)}
        </div>

        {!isZero && data && (
          <div className="space-y-1 text-xs border-t pt-2">
            {data.mensalidade > 0 && <Line label="Mensalidade vencida" value={data.mensalidade} />}
            {data.repasse > 0 && <Line label="Repasse de entregas (R$/entrega)" value={data.repasse} />}
            {data.comissao > 0 && <Line label="Comissão sobre vendas" value={data.comissao} />}
            {data.pdv > 0 && <Line label="Taxa PDV (R$/venda)" value={data.pdv} />}
          </div>
        )}

        {blocked && (
          <div className="text-xs text-destructive font-semibold border-t border-destructive/30 pt-2">
            ⚠️ Loja bloqueada: saldo acumulado ≥ R$ 500. Quite para voltar a receber pedidos.
          </div>
        )}

        {isZero ? (
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Tudo em dia. Nenhum valor pendente.</div>
        ) : (
          <Button onClick={onPayClick} className="w-full font-bold gap-2" size="sm">
            Pagar via PIX <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{formatBRL(value)}</span>
    </div>
  );
}