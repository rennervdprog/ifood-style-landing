import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, QrCode, Copy, Loader2, X, ShieldAlert, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { REPASSE_RULES } from "@/lib/repasseRules";
import { usePendingRepasse } from "@/hooks/usePendingRepasse";

interface Props {
  storeId: string;
  storeName: string;
  onGoToFinance?: () => void;
}

/** Próxima segunda-feira (a de hoje conta só na semana que vem, como no motor). */
function nextMondayInfo() {
  const d = new Date();
  const day = d.getDay(); // 0=Dom .. 6=Sab
  const diff = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return {
    date: d,
    days: Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000)),
    label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
  };
}

/**
 * Cartão-resumo do repasse: quanto a loja deve, de quê, quando vira cobrança
 * e o que acontece em cada faixa — com o estado REAL de bloqueio vindo do
 * banco (stores.status / billing_blocked_at), não inferido do saldo.
 */
export default function RepasseAlert({ storeId, storeName, onGoToFinance }: Props) {
  const { total, breakdown, hasPendingCharge } = usePendingRepasse(storeId);
  const [dismissed, setDismissed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pix, setPix] = useState<{ qr: string | null; base64: string | null; amount: number; ref?: string } | null>(null);
  const qc = useQueryClient();

  const { data: storeData } = useQuery({
    queryKey: ["repasse-store-status", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("status, billing_blocked_at, billing_block_reason")
        .eq("id", storeId)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
  });

  if (dismissed || total <= 0 || hasPendingCharge) return null;

  const MIN = REPASSE_RULES.MIN_AUTO_CHARGE_BRL;
  const TETO = REPASSE_RULES.BLOCK_THRESHOLD_BRL;

  const realBlocked = storeData?.status === "bloqueado";
  const aboveCeiling = !realBlocked && total >= TETO;
  const awaitingMonday = !realBlocked && total >= MIN;
  const canGenerate = realBlocked || total >= MIN;
  const monday = nextMondayInfo();

  const blockedSince = storeData?.billing_blocked_at
    ? new Date(storeData.billing_blocked_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : null;
  const blockedReason =
    storeData?.billing_block_reason === "overdue"
      ? "uma cobrança ficou mais de 30 dias sem pagar"
      : storeData?.billing_block_reason === "threshold"
        ? "o saldo passou do teto de " + formatBRL(TETO)
        : "repasse em aberto";

  const pill = realBlocked
    ? { text: "Vendas pausadas", cls: "bg-red-500 text-white" }
    : aboveCeiling
      ? { text: `Acima do teto de ${formatBRL(TETO)}`, cls: "bg-primary/15 text-primary" }
      : awaitingMonday
        ? { text: "Entra na cobrança de segunda", cls: "bg-primary/15 text-primary" }
        : { text: "Acumulando nesta semana", cls: "bg-muted text-muted-foreground" };

  const subtitle = realBlocked
    ? "Sua loja parou de receber pedidos. Quite pra reativar."
    : aboveCeiling
      ? "Passou do teto — quite antes de segunda pra não pausar as vendas."
      : awaitingMonday
        ? "Na segunda, esse valor vira uma cobrança PIX."
        : "Suas vendas da semana estão juntando a parte do ItaSuper.";

  const whenText = realBlocked
    ? `Vendas pausadas${blockedSince ? ` desde ${blockedSince}` : ""} — ${blockedReason}. Quite o valor abaixo: a reativação é automática após o pagamento.`
    : aboveCeiling
      ? `Sua loja NÃO está bloqueada. Mas se na segunda, ${monday.label}, o saldo continuar acima de ${formatBRL(TETO)}, as vendas pausam até quitar.`
      : awaitingMonday
        ? `Próxima cobrança: segunda, ${monday.label} (em ${monday.days} dia${monday.days === 1 ? "" : "s"}). Se preferir, quite agora pelo botão abaixo.`
        : `Faltam ${formatBRL(MIN - total)} pra chegar aos ${formatBRL(MIN)} — aí o valor entra na cobrança automática de segunda, ${monday.label}. Sem multa e sem pressa.`;

  const tone = realBlocked
    ? { border: "border-red-500/40", bg: "from-red-500/10", icon: "text-red-500", text: "text-red-500", btn: "bg-red-500 hover:bg-red-600", bar: "bg-red-500" }
    : aboveCeiling || awaitingMonday
      ? { border: "border-primary/40", bg: "from-primary/10", icon: "text-primary", text: "text-primary", btn: "bg-primary hover:bg-primary/90", bar: "bg-primary" }
      : { border: "border-border", bg: "from-muted/40", icon: "text-muted-foreground", text: "text-foreground", btn: "bg-primary hover:bg-primary/90", bar: "bg-primary" };

  // Barra de progresso com os marcos de cobrança (150) e teto (500).
  const scale = Math.max(TETO, total);
  const fillPct = Math.min(100, (total / scale) * 100);
  const minPct = (MIN / scale) * 100;
  const tetoPct = (TETO / scale) * 100;

  const parts: Array<{ label: string; value: number }> = [
    { label: "Taxa das entregas", value: breakdown.splitEntrega },
    { label: "Comissão do plano", value: breakdown.comissao },
    { label: "Taxa do PDV", value: breakdown.pdv },
  ].filter((p) => p.value > 0);

  const generate = async () => {
    if (!canGenerate) {
      toast.error(`Geração de PIX disponível a partir de ${formatBRL(MIN)}.`);
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-router", {
        body: {
          action: "commission_charge",
          store_id: storeId,
          amount: total,
          description: `Repasse ItaSuper — ${storeName}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPix({
        qr: data?.pix_copy_paste ?? data?.qr_code ?? null,
        base64: data?.pix_qr_code_base64 ?? data?.qr_code_base64 ?? null,
        amount: Number(data?.amount ?? total),
        ref: data?.reference_code,
      });
      qc.invalidateQueries({ queryKey: ["repasse-has-pending-charge", storeId] });
      toast.success("PIX gerado! Pague para quitar o repasse.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar PIX. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Código PIX copiado!");
  };

  return (
    <div className={`rounded-2xl border-2 ${tone.border} p-5 relative overflow-hidden`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${tone.bg} to-transparent`} />
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {realBlocked ? <ShieldAlert className={`h-6 w-6 ${tone.icon}`} /> : <AlertTriangle className={`h-6 w-6 ${tone.icon}`} />}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-foreground">Repasse pra plataforma</h3>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pill.cls}`}>{pill.text}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
          </div>
          {!realBlocked && !pix && (
            <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="text-center py-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Valor a repassar
          </p>
          <p className={`text-3xl font-black ${tone.text}`}>{formatBRL(total)}</p>
        </div>

        {/* Progresso até os marcos */}
        <div className="px-1 pt-1">
          <div className="relative h-2.5 rounded-full bg-muted">
            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${fillPct}%` }} />
            <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-foreground/50" style={{ left: `${minPct}%` }} />
            <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-foreground/70" style={{ left: `${tetoPct}%` }} />
          </div>
          <div className="relative h-4 mt-1 text-[9px] font-bold text-muted-foreground">
            <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${minPct}%` }}>
              {formatBRL(MIN)} · cobrança
            </span>
            <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${tetoPct}%` }}>
              {formatBRL(TETO)} · teto
            </span>
          </div>
        </div>

        {parts.length > 0 && (
          <div className="rounded-xl p-3 bg-muted/30 border border-border/40 space-y-1">
            {parts.map((p) => (
              <div key={p.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-bold text-foreground">{formatBRL(p.value)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl bg-muted/30 border border-border/40 p-3">
          <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-foreground leading-relaxed">{whenText}</p>
        </div>

        {pix ? (
          <div className="space-y-3 bg-card/60 rounded-xl p-4 border border-border/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Pague via PIX</p>
              <button onClick={() => setPix(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {pix.ref && <p className="text-xs text-muted-foreground text-center">Fatura <span className="font-bold text-foreground">{pix.ref}</span></p>}
            <p className="text-2xl font-black text-center text-foreground">{formatBRL(pix.amount)}</p>
            {pix.base64 && (
              <div className="flex justify-center">
                <img
                  src={pix.base64.startsWith("data:") ? pix.base64 : `data:image/png;base64,${pix.base64}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 rounded-xl"
                />
              </div>
            )}
            {pix.qr && (
              <Button onClick={() => copy(pix.qr!)} variant="outline" className="w-full">
                <Copy className="h-4 w-4" /> Copiar Código PIX
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground text-center">
              Após o pagamento, a confirmação é automática e o saldo é zerado.
            </p>
          </div>
        ) : (
          <Button
            onClick={generate}
            disabled={generating || !canGenerate}
            className={`w-full font-bold text-white shadow-lg ${tone.btn}`}
            size="lg"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...</>
            ) : !canGenerate ? (
              <><QrCode className="h-4 w-4" /> PIX a partir de {formatBRL(MIN)}</>
            ) : realBlocked ? (
              <><QrCode className="h-4 w-4" /> Quitar agora com PIX — {formatBRL(total)}</>
            ) : (
              <><QrCode className="h-4 w-4" /> Gerar PIX — {formatBRL(total)}</>
            )}
          </Button>
        )}

        <ol className="text-[11px] text-muted-foreground leading-relaxed space-y-1 list-none">
          <li><strong className="text-foreground">1.</strong> Durante a semana, tudo que você vende fica com você — só junta a parte do ItaSuper.</li>
          <li><strong className="text-foreground">2.</strong> Toda segunda, se o acumulado passou de {formatBRL(MIN)}, geramos o PIX pra você quitar.</li>
          <li><strong className="text-foreground">3.</strong> Se a segunda chegar com o saldo acima de {formatBRL(TETO)} sem quitar, as vendas pausam até o pagamento. Cobrança sem pagar por {REPASSE_RULES.SUSPENSION_DAYS} dias também pausa. Pagou, volta na hora.</li>
        </ol>

        {onGoToFinance && !pix && (
          <button
            onClick={onGoToFinance}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline"
          >
            Ver detalhes no painel financeiro
          </button>
        )}
      </div>
    </div>
  );
}
