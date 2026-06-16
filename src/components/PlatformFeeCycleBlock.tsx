import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nextMonday, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, QrCode, TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface Props {
  storeId: string;
}

/**
 * Bloco "Ciclo de cobrança da taxa de plataforma" para o Resumo Financeiro.
 * Mostra saldo pendente, próxima segunda-feira e o estado atual do ciclo.
 */
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

  type Estado = "acumulando" | "pronto" | "pix";
  const estado: Estado = pendente >= 30 ? "pronto" : pendente > 0 ? "acumulando" : "acumulando";

  const estados: Record<Estado, { label: string; cls: string; Icon: typeof Calendar }> = {
    acumulando: { label: "Acumulando", cls: "bg-muted text-muted-foreground border-border", Icon: TrendingUp },
    pronto:     { label: "Pronto para cobrar (≥ R$ 30)", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30", Icon: Calendar },
    pix:        { label: "PIX gerado", cls: "bg-primary/10 text-primary border-primary/30", Icon: QrCode },
  };
  const cur = estados[estado];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">Ciclo de cobrança da taxa de plataforma</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Cobramos por PIX automático toda segunda. Pague no mesmo dia para evitar bloqueio futuro.
          </p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${cur.cls} shrink-0`}>
          <cur.Icon className="h-3 w-3 inline mr-1 -mt-px" />
          {cur.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/40 border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo pendente</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{formatBRL(pendente)}</p>
        </div>
        <div className="rounded-xl bg-muted/40 border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Próxima cobrança</p>
          <p className="text-sm font-bold text-foreground mt-1 capitalize">{proximaSegunda}</p>
        </div>
      </div>

      <a href="#repasse-history" className="block text-[11px] text-primary hover:underline text-center pt-1">
        Ver histórico abaixo
      </a>
    </div>
  );
}