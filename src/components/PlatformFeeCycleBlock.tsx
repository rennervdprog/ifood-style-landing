import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nextMonday, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, QrCode, TrendingUp, CircleDashed } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { REPASSE_RULES } from "@/lib/repasseRules";
import { FINANCE_COPY, weeklyChargeRuleText } from "@/lib/financeCommunication";

interface Props {
  storeId: string;
}

/** Bloco do ciclo semanal de taxas e comissões no resumo financeiro. */
export default function PlatformFeeCycleBlock({ storeId }: Props) {
  const { data } = useQuery({
    queryKey: ["store-balance-split", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_balances")
        .select("repasse_pendente")
        .eq("store_id", storeId)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
    staleTime: 1000 * 30,
  });

  const pendente = Number(data?.repasse_pendente || 0);
  const proximaSegunda = format(nextMonday(new Date()), "EEEE, dd/MM", { locale: ptBR });

  type Estado = "zerado" | "acumulando" | "pronto";
  const estado: Estado = pendente >= REPASSE_RULES.MIN_AUTO_CHARGE_BRL
    ? "pronto"
    : pendente > 0
      ? "acumulando"
      : "zerado";

  const estados: Record<Estado, { label: string; cls: string; Icon: typeof Calendar }> = {
    zerado: { label: "Ciclo aberto (sem saldo)", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", Icon: CircleDashed },
    acumulando: { label: "Acumulando", cls: "bg-muted text-muted-foreground border-border", Icon: TrendingUp },
    pronto: { label: `Elegível para cobrança (≥ ${formatBRL(REPASSE_RULES.MIN_AUTO_CHARGE_BRL)})`, cls: "bg-amber-500/10 text-amber-700 border-amber-500/30", Icon: QrCode },
  };
  const cur = estados[estado];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">{FINANCE_COPY.weeklyChargeTitle}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Acompanhe os custos operacionais de vendas pagas fora do PIX online.
          </p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${cur.cls} shrink-0`}>
          <cur.Icon className="h-3 w-3 inline mr-1 -mt-px" />
          {cur.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/40 border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{FINANCE_COPY.cycleLabel}</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{formatBRL(pendente)}</p>
        </div>
        <div className="rounded-xl bg-muted/40 border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Próxima segunda-feira</p>
          <p className="text-sm font-bold text-foreground mt-1 capitalize">{proximaSegunda}</p>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">{weeklyChargeRuleText()}</p>
      <a href="#repasse-history" className="block text-[11px] text-primary hover:underline text-center pt-1">
        Ver cobranças e histórico
      </a>
    </div>
  );
}
