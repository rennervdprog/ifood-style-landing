import { formatBRL } from "@/lib/utils";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, QrCode, Copy, Loader2, X, ChevronDown, ChevronUp, CircleCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const LOCK_THRESHOLD = 500;  // R$500 → modal bloqueante
const MIN_CHARGE = 30;       // R$30 → aparece o alerta (cobrança toda segunda-feira)

interface PlatformSplitAlertProps {
  storeId: string;
  storeName: string;
  splitPerOrder: number;
  onGoToFinance?: () => void;
}

const PlatformSplitAlert = ({ storeId, storeName, splitPerOrder, onGoToFinance }: PlatformSplitAlertProps) => {
  const [generating, setGenerating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; amount: number; reference_code?: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: storeBalance } = useQuery({
    queryKey: ["store-balance-split", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_balances")
        .select("repasse_pendente, comissao_pendente")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
    refetchInterval: 30000,
  });

  const { data: pdvPending } = useQuery({
    queryKey: ["store-pdv-pending", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_plans")
        .select("pdv_commission_pending")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.pdv_commission_pending || 0);
    },
    enabled: !!storeId,
    refetchInterval: 30000,
  });

  const { data: minPayoutSetting } = useQuery({
    queryKey: ["min-payout-amount"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "min_payout_amount")
        .maybeSingle();
      return Number(data?.value || 100);
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: pendingCharge } = useQuery({
    queryKey: ["repasse-pending-charge", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("financial_transactions")
        .select("amount, reference_code, pix_copy_paste, pix_qr_code, pix_qr_code_base64")
        .eq("store_id", storeId)
        .eq("transaction_kind", "commission_charge")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
    refetchInterval: 30000,
  });

  const minPayout = minPayoutSetting ?? 100;
  const repasse = Number(storeBalance?.repasse_pendente || 0);
  const comissao = Number(storeBalance?.comissao_pendente || 0);
  const pdv = Number(pdvPending || 0);
  // Total pendente: repasse (R$/entrega) + comissão (%) + PDV (R$/venda PDV)
  const pendingFee = repasse + comissao + pdv;
  const total = pendingFee;
  // Cobrança automática a partir de R$30 toda segunda-feira
  const canPay = pendingFee >= 30;

  const handlePayFee = async () => {
    setGenerating(true);
    try {
      const existingPixCode = pendingCharge?.pix_copy_paste || pendingCharge?.pix_qr_code;
      if (pendingCharge && existingPixCode) {
        setPixData({
          qr_code: existingPixCode,
          qr_code_base64: pendingCharge.pix_qr_code_base64 || "",
          amount: Number(pendingCharge.amount || pendingFee),
          reference_code: pendingCharge.reference_code,
        });
        toast.info("Cobrança PIX já gerada. Use o QR Code existente.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("payment-router", {
        body: {
          action: "commission_charge",
          store_id: storeId,
          amount: pendingFee,
          description: `Repasse ItaSuper - ${storeName}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPixData({
        qr_code: data.pix_code ?? data.qr_code ?? null,
        qr_code_base64: data.qr_code_url ?? data.qr_code_base64 ?? null,
        amount: Number(data.amount || pendingFee),
        reference_code: data.reference_code,
      });
      toast.success("PIX gerado! Escaneie o QR Code para pagar.");
      queryClient.invalidateQueries({ queryKey: ["store-balance-split", storeId] });
      queryClient.invalidateQueries({ queryKey: ["repasse-pending-charge", storeId] });
      queryClient.invalidateQueries({ queryKey: ["repasse-charges", storeId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar PIX.");
    } finally {
      setGenerating(false);
    }
    };
  
  const copyPixCode = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      toast.success("Código PIX copiado!");
    }
    };

  const isLocked = total >= LOCK_THRESHOLD; // ≥ R$500 trava o painel

  if (dismissed || total <= 0) return null;

  // ── MODAL BLOQUEANTE (≥ R$500) ──────────────────────────────────────────
  if (isLocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm bg-background rounded-3xl border-2 border-red-500/40 overflow-hidden shadow-2xl">
          {/* Header vermelho */}
          <div className="bg-red-500/10 border-b border-red-500/20 px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/15 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">Pagamento obrigatório</p>
              <p className="text-xs text-muted-foreground">Acesso ao painel suspenso temporariamente</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Valor */}
            <div className="bg-red-500/8 border border-red-500/20 rounded-2xl px-4 py-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Valor em aberto com a plataforma</p>
              <p className="text-3xl font-black text-red-500">{formatBRL(total)}</p>
            </div>

            {/* Explicação */}
            <p className="text-xs text-muted-foreground leading-relaxed text-center">
              Você tem <strong className="text-foreground">{formatBRL(total)}</strong> em taxas de pedidos pagos em dinheiro/cartão que ainda não foram repassados à plataforma. Para continuar usando o painel, efetue o pagamento via PIX.
            </p>

            {/* Detalhamento */}
            {(Number(repasse > 0) + Number(comissao > 0) + Number(pdv > 0)) >= 2 && (
              <div className="space-y-1.5">
                {repasse > 0 && <div className="flex justify-between text-xs px-1"><span className="text-muted-foreground">Taxa de entrega (delivery)</span><span className="font-bold">{formatBRL(repasse)}</span></div>}
                {comissao > 0 && <div className="flex justify-between text-xs px-1"><span className="text-muted-foreground">Comissão sobre vendas</span><span className="font-bold">{formatBRL(comissao)}</span></div>}
                {pdv > 0 && <div className="flex justify-between text-xs px-1"><span className="text-muted-foreground">Taxa PDV (R$/venda)</span><span className="font-bold">{formatBRL(pdv)}</span></div>}
              </div>
            )}

            {/* PIX gerado */}
            {pixData ? (
              <div className="space-y-3 bg-card rounded-2xl p-4 border border-border">
                <p className="text-sm font-bold text-center">{formatBRL(pixData.amount)}</p>
                {pixData.qr_code_base64 && (
                  <div className="flex justify-center">
                    <img src={pixData.qr_code_base64.startsWith("data:") ? pixData.qr_code_base64 : `data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code PIX" className="w-44 h-44 rounded-xl" />
                  </div>
                )}
                {pixData.qr_code && (
                  <button onClick={copyPixCode} className="w-full flex items-center justify-center gap-2 border border-border bg-muted/40 rounded-xl py-2.5 text-sm font-bold active:scale-[0.98] transition-transform">
                    <Copy className="h-4 w-4" /> Copiar Código PIX
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground text-center">Após o pagamento, o painel é liberado automaticamente.</p>
              </div>
            ) : (
              <button onClick={handlePayFee} disabled={generating}
                className="w-full h-13 bg-red-500 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 shadow-lg shadow-red-500/25 py-3.5">
                {generating
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...</>
                  : <><QrCode className="h-4 w-4" /> Gerar PIX — {formatBRL(total)}</>}
              </button>
            )}

            <p className="text-[10px] text-muted-foreground text-center">
              Dúvidas? Entre em contato com o suporte ItaSuper.
            </p>
          </div>
        </div>
      </div>
    );
  }




  return (
    <div className="rounded-2xl border-2 border-blue-500/30 p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 to-transparent" />
      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="h-6 w-6 text-blue-500" />
            <div>
              <h3 className="font-bold text-sm text-foreground">
                Repasse Pendente — Taxa Plataforma
              </h3>
              <div className="text-[10px] text-muted-foreground mt-0.5 space-y-0.5">
                <p>Taxa de {formatBRL(splitPerOrder)} por entrega + comissão (se houver) em pedidos físicos.</p>
                <p>Efetue o repasse via PIX para manter sua conta regularizada.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="text-center py-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Valor a Repassar</p>
          <p className="text-3xl font-black text-blue-500">
            {formatBRL(pendingFee)}
          </p>
        </div>

        {/* Info */}
        <div className="rounded-xl p-3 bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
          <Banknote className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs font-medium text-blue-400 space-y-1">
            <p>Pedidos pagos em <strong>dinheiro, cartão ou PIX maquininha</strong> acumulam aqui.</p>
            <p>O sistema gera uma cobrança via PIX toda <strong>segunda-feira</strong> quando o saldo atingir <strong>R$30</strong>.</p>
            <p>Se não pagar em 30 dias a loja é suspensa. Saldo acima de R$500 trava o painel imediatamente.</p>
            {(Number(repasse > 0) + Number(comissao > 0) + Number(pdv > 0)) >= 1 && (
              <div className="mt-1.5 space-y-0.5 text-[10px] text-blue-300 border-t border-blue-500/20 pt-1.5">
                {repasse > 0 && <p>Delivery ({formatBRL(splitPerOrder)}/entrega): <strong>{formatBRL(repasse)}</strong></p>}
                {comissao > 0 && <p>Comissão sobre vendas: <strong>{formatBRL(comissao)}</strong></p>}
                {pdv > 0 && <p>PDV (R$/venda no balcão): <strong>{formatBRL(pdv)}</strong></p>}
                <p className="text-blue-200 pt-0.5">Total: <strong>{formatBRL(pendingFee)}</strong></p>
              </div>
            )}
          </div>
        </div>

        {/* QR Code result */}
        {pixData ? (
          <div className="space-y-3 bg-card/60 rounded-xl p-4 border border-border/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Pague via PIX</p>
              <button onClick={() => setPixData(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-2xl font-black text-center text-foreground">{formatBRL(pixData.amount)}</p>

            {pixData.qr_code_base64 && (
              <div className="flex justify-center">
                <img
                  src={pixData.qr_code_base64.startsWith("data:") ? pixData.qr_code_base64 : `data:image/png;base64,${pixData.qr_code_base64}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 rounded-xl"
                />
              </div>
            )}
            {pixData.qr_code && (
              <Button onClick={copyPixCode} variant="outline" className="w-full">
                <Copy className="h-4 w-4" /> Copiar Código PIX
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground text-center">
              Após o pagamento, a confirmação é automática e o saldo será zerado.
            </p>
          </div>
        ) : canPay ? (
          <Button
            onClick={handlePayFee}
            disabled={generating}
            className="w-full font-bold text-white shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/20"
            size="lg"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...</>
            ) : (
              <><QrCode className="h-4 w-4" /> Pagar Pendência via PIX</>
            )}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (pendingFee / minPayout) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              PIX disponível a partir de <strong className="text-foreground">{formatBRL(minPayout)}</strong>
              {" "}— faltam <strong className="text-blue-500">{formatBRL(Math.max(0, minPayout - pendingFee))}</strong>
            </p>
            <p className="text-[10px] text-muted-foreground text-center">
              O valor cresce a cada pedido pago em dinheiro ou cartão.
            </p>
          </div>
        )}

        {onGoToFinance && !pixData && (
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
};

export default PlatformSplitAlert;
