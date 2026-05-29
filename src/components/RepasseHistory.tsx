/**
 * RepasseHistory
 * Histórico de cobranças de repasse físico (R$2/entrega + comissões)
 * Mostra status de pagamento, PIX copia e cola e histórico semanal
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2, Clock, AlertCircle, Copy, ChevronDown, ChevronUp,
  History, Banknote, Truck, TrendingDown, Zap, Loader2
} from "lucide-react";
import { toast } from "sonner";

interface RepasseHistoryProps {
  storeId: string;
}

interface RepasseRecord {
  id: string;
  period_start: string;
  period_end: string;
  repasse_amount: number;
  comissao_amount: number;
  total_amount: number;
  status: "pending" | "charged" | "paid" | "cancelled";
  pix_copy_paste: string | null;
  charged_at: string | null;
  paid_at: string | null;
}

const STATUS_CONFIG = {
  pending:   { label: "Pendente",   color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",    icon: Clock },
  charged:   { label: "Aguardando pagamento", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",     icon: AlertCircle },
  paid:      { label: "Pago",       color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  cancelled: { label: "Cancelado",  color: "bg-muted/50 text-muted-foreground border-border",             icon: AlertCircle },
};

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function PixCard({ pixCode }: { pixCode: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    toast.success("PIX copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-3 rounded-xl bg-muted/40 border border-border/50 p-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        PIX Copia e Cola
      </p>
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-mono text-foreground truncate flex-1">
          {pixCode.slice(0, 40)}...
        </p>
        <Button size="sm" variant="outline" className="h-7 px-2 shrink-0" onClick={handleCopy}>
          <Copy className="h-3 w-3 mr-1" />
          <span className="text-[10px]">{copied ? "Copiado!" : "Copiar"}</span>
        </Button>
      </div>
    </div>
  );
}

function RepasseCard({ record }: { record: RepasseRecord }) {
  const [expanded, setExpanded] = useState(record.status === "charged");
  const cfg = STATUS_CONFIG[record.status];
  const Icon = cfg.icon;

  return (
    <Card className="border-border/40">
      <CardContent className="pt-4 pb-3 px-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              Semana {formatDate(record.period_start)} — {formatDate(record.period_end)}
            </p>
            <p className="text-xl font-black text-foreground">
              {formatBRL(record.total_amount)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge className={`text-[10px] font-bold border ${cfg.color} flex items-center gap-1`}>
              <Icon className="h-2.5 w-2.5" />
              {cfg.label}
            </Badge>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-muted-foreground flex items-center gap-0.5 hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Menos" : "Detalhes"}
            </button>
          </div>
        </div>

        {/* Breakdown */}
        {expanded && (
          <div className="space-y-2">
            <div className="rounded-xl bg-muted/30 border border-border/30 p-3 space-y-1.5">
              {record.repasse_amount > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Truck className="h-3 w-3" />
                    Taxa de entrega (R$2/pedido físico)
                  </span>
                  <span className="font-bold text-foreground">{formatBRL(record.repasse_amount)}</span>
                </div>
              )}
              {record.comissao_amount > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingDown className="h-3 w-3" />
                    Comissão sobre vendas físicas
                  </span>
                  <span className="font-bold text-foreground">{formatBRL(record.comissao_amount)}</span>
                </div>
              )}
              <div className="border-t border-border/40 pt-1.5 flex items-center justify-between text-[11px]">
                <span className="font-black text-foreground">Total</span>
                <span className="font-black text-foreground">{formatBRL(record.total_amount)}</span>
              </div>
            </div>

            {record.charged_at && (
              <p className="text-[10px] text-muted-foreground">
                Cobrança gerada em {new Date(record.charged_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            {record.paid_at && (
              <p className="text-[10px] text-emerald-600 font-bold">
                ✅ Pago em {new Date(record.paid_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}

            {/* PIX — só se aguardando pagamento */}
            {record.status === "charged" && record.pix_copy_paste && (
              <PixCard pixCode={record.pix_copy_paste} />
            )}

            {record.status === "charged" && !record.pix_copy_paste && (
              <p className="text-[10px] text-muted-foreground italic">
                PIX disponível no e-mail ou entre em contato com o suporte.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RepasseHistory({ storeId }: RepasseHistoryProps) {
  const { data: records, isLoading } = useQuery({
    queryKey: ["repasse-history", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_repasse_history" as any)
        .select("*")
        .eq("store_id", storeId)
        .order("period_end", { ascending: false })
        .limit(24); // últimos 6 meses (aprox.)
      if (error) throw error;
      return (data || []) as RepasseRecord[];
    },
    enabled: !!storeId,
  });

  const [paying, setPaying] = useState(false);

  const handleManualCharge = async () => {
    setPaying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/repasse-manual-charge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ store_id: storeId }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        toast.success(`PIX gerado! R$${Number(data.amount).toFixed(2)} — vence em ${data.due_date}`);
        // Copiar PIX automaticamente
        if (data.pix_copy_paste) {
          navigator.clipboard.writeText(data.pix_copy_paste);
          toast.success("PIX copiado automaticamente!");
        }
      } else {
        toast.error(data.error || "Erro ao gerar PIX");
      }
    } catch (err) {
      toast.error("Erro de conexão");
    } finally {
      setPaying(false);
    }
  };

  const { data: balance } = useQuery({
    queryKey: ["store-balance-repasse", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_balances")
        .select("repasse_pendente, comissao_pendente")
        .eq("store_id", storeId)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
  });

  const pendingAmount = Number(balance?.repasse_pendente || 0) + Number(balance?.comissao_pendente || 0);
  const pendingCount = records?.filter(r => r.status === "charged").length || 0;

  return (
    <div className="space-y-4">
      {/* Saldo acumulando */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-4 pb-4 px-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <Banknote className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                Acumulando esta semana
              </p>
              <p className="text-lg font-black text-foreground">
                {formatBRL(pendingAmount)}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Cobrado toda segunda-feira quando atingir R$30,00
              </p>
            </div>
          </div>
          {pendingAmount >= 5 && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full h-8 text-[11px] border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
              onClick={handleManualCharge}
              disabled={paying}
            >
              {paying ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              ) : (
                <Zap className="h-3 w-3 mr-1.5" />
              )}
              {paying ? "Gerando PIX..." : `Pagar agora — ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(pendingAmount)}`}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Aviso se tem cobrança pendente */}
      {pendingCount > 0 && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-3 pb-3 px-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-[11px] text-blue-700 dark:text-blue-400">
              Você tem {pendingCount} cobrança{pendingCount > 1 ? "s" : ""} aguardando pagamento.
              Pague via PIX para manter a loja ativa.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-bold text-foreground">Histórico de repasses</h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : !records?.length ? (
        <Card className="border-border/30">
          <CardContent className="py-10 text-center">
            <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum repasse registrado ainda.</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              O primeiro repasse aparece aqui após a segunda-feira.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map(record => (
            <RepasseCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
