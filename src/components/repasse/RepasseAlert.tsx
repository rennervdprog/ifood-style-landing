import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, QrCode, Copy, Loader2, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { usePendingRepasse } from "@/hooks/usePendingRepasse";
import { REPASSE_RULES, REPASSE_LABELS } from "@/lib/repasseRules";

interface Props {
  storeId: string;
  storeName: string;
  onGoToFinance?: () => void;
}

/**
 * Alerta unificado de repasse pendente.
 * Substitui CommissionAlert + PlatformSplitAlert com um único componente,
 * cor semântica (âmbar = pendente / vermelho = bloqueio) e regra única de prazo.
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
      const { data } = await supabase.from("stores").select("status, owner_id").eq("id", storeId).maybeSingle();
      return data;
    },
    enabled: !!storeId,
  });

  const { data: ownerProfile } = useQuery({
    queryKey: ["repasse-owner-doc", storeData?.owner_id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("document").eq("user_id", storeData!.owner_id!).maybeSingle();
      return data;
    },
    enabled: !!storeData?.owner_id,
  });

  if (dismissed || total <= 0 || hasPendingCharge) return null;

  const isBlocked = storeData?.status === "bloqueado" || total >= REPASSE_RULES.BLOCK_THRESHOLD_BRL;
  const hasDocument = !!ownerProfile?.document;

  const generate = async () => {
    if (!hasDocument) {
      toast.error("Cadastre seu CPF/CNPJ no perfil antes de pagar.");
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
        qr: data.pix_code ?? data.qr_code ?? null,
        base64: data.qr_code_url ?? data.qr_code_base64 ?? null,
        amount: Number(data.amount || total),
        ref: data.reference_code,
      });
      toast.success("PIX gerado! Escaneie o QR Code para pagar.");
      qc.invalidateQueries({ queryKey: ["repasse-balance", storeId] });
      qc.invalidateQueries({ queryKey: ["repasse-has-pending-charge", storeId] });
      qc.invalidateQueries({ queryKey: ["repasse-charges", storeId] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar PIX.");
    } finally {
      setGenerating(false);
    }
  };

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Código PIX copiado!");
  };

  // Cor semântica: âmbar = pendente, vermelho = bloqueio.
  const tone = isBlocked
    ? { border: "border-red-500/40", bg: "from-red-500/10", icon: "text-red-500", text: "text-red-500", btn: "bg-red-500 hover:bg-red-600" }
    : { border: "border-amber-500/40", bg: "from-amber-500/10", icon: "text-amber-500", text: "text-amber-600 dark:text-amber-400", btn: "bg-amber-500 hover:bg-amber-600" };

  const parts: Array<{ label: string; value: number }> = [
    { label: REPASSE_LABELS.breakdown.splitEntrega, value: breakdown.splitEntrega },
    { label: REPASSE_LABELS.breakdown.comissao, value: breakdown.comissao },
    { label: REPASSE_LABELS.breakdown.pdv, value: breakdown.pdv },
  ].filter((p) => p.value > 0);

  return (
    <div className={`rounded-2xl border-2 ${tone.border} p-5 relative overflow-hidden`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${tone.bg} to-transparent`} />
      <div className="relative space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {isBlocked ? <ShieldAlert className={`h-6 w-6 ${tone.icon}`} /> : <AlertTriangle className={`h-6 w-6 ${tone.icon}`} />}
            <div>
              <h3 className="font-bold text-sm text-foreground">
                {isBlocked ? "Painel bloqueado — quite o repasse" : REPASSE_LABELS.pendingTitle}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pedidos pagos em dinheiro, cartão ou PIX na maquininha acumulam aqui.
              </p>
            </div>
          </div>
          {!isBlocked && !pix && (
            <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="text-center py-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Valor a repassar
          </p>
          <p className={`text-3xl font-black ${tone.text}`}>{formatBRL(total)}</p>
        </div>

        {parts.length > 1 && (
          <div className="rounded-xl p-3 bg-muted/30 border border-border/40 space-y-1">
            {parts.map((p) => (
              <div key={p.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-bold text-foreground">{formatBRL(p.value)}</span>
              </div>
            ))}
          </div>
        )}

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
            disabled={generating || !hasDocument}
            className={`w-full font-bold text-white shadow-lg ${tone.btn}`}
            size="lg"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...</>
            ) : !hasDocument ? (
              <><AlertTriangle className="h-4 w-4" /> Cadastre CPF/CNPJ no perfil</>
            ) : (
              <><QrCode className="h-4 w-4" /> Gerar PIX — {formatBRL(total)}</>
            )}
          </Button>
        )}

        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
          Sem pagamento em <strong>{REPASSE_RULES.SUSPENSION_DAYS} dias</strong>, a loja é suspensa.
          {" "}Saldo acima de <strong>{formatBRL(REPASSE_RULES.BLOCK_THRESHOLD_BRL)}</strong> trava o painel imediatamente.
        </p>

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