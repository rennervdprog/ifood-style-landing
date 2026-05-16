/**
 * PlatformSplitAlert — reescrito para clareza
 * Explica ao lojista de forma simples o que é, de onde vem e como pagar
 */
import { formatBRL } from "@/lib/utils";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, QrCode, Copy, Loader2, X, ChevronDown, ChevronUp, CircleCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  storeId: string;
  storeName: string;
  splitPerOrder: number;
  planType?: string;
  commissionRate?: number;
  onGoToFinance?: () => void;
}

const PlatformSplitAlert = ({ storeId, splitPerOrder, planType = "fixed", commissionRate = 0, onGoToFinance }: Props) => {
  const [generating, setGenerating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; amount: number } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const queryClient = useQueryClient();

  const { data: storeBalance } = useQuery({
    queryKey: ["store-balance-split", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("store_balances").select("repasse_pendente, comissao_pendente").eq("store_id", storeId).maybeSingle();
      return data;
    },
    enabled: !!storeId,
    refetchInterval: 30_000,
  });

  const repasse  = Number(storeBalance?.repasse_pendente  || 0);
  const comissao = Number(storeBalance?.comissao_pendente || 0);
  const total    = repasse + comissao;
  const canPay   = total >= 5;

  if (dismissed || total <= 0) return null;

  const handlePayFee = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("store-platform-fee-pix", { body: { store_id: storeId, amount: total } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPixData({ qr_code: data.qr_code, qr_code_base64: data.qr_code_base64, amount: data.amount });
      toast.success("PIX gerado!");
      queryClient.invalidateQueries({ queryKey: ["store-balance-split", storeId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar PIX.");
    } finally {
      setGenerating(false);
    }
  };

  const copyPix = () => { if (pixData?.qr_code) { navigator.clipboard.writeText(pixData.qr_code); toast.success("Código PIX copiado!"); } };

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <Banknote className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">Repasse pendente à plataforma</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pedidos pagos em <strong>dinheiro ou cartão</strong> acumulam aqui</p>
          </div>
        </div>
        {!pixData && <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-4 w-4" /></button>}
      </div>

      {/* Valor total */}
      <div className="px-4 pb-3">
        <div className="bg-white dark:bg-card rounded-xl border border-amber-500/20 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Total a repassar</p>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400">{formatBRL(total)}</p>
        </div>
      </div>

      {/* Detalhamento */}
      {repasse > 0 && comissao > 0 && (
        <div className="px-4 pb-3">
          <button onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showDetails ? "Ocultar detalhes" : "Ver detalhamento"}
          </button>
          {showDetails && (
            <div className="mt-2 space-y-1.5">
              {repasse > 0 && <div className="flex justify-between text-xs px-1"><span className="text-muted-foreground">Taxa de entrega (R${splitPerOrder.toFixed(2).replace(".", ",")} × pedidos físicos)</span><span className="font-bold">{formatBRL(repasse)}</span></div>}
              {comissao > 0 && <div className="flex justify-between text-xs px-1"><span className="text-muted-foreground">Comissão {commissionRate > 0 ? commissionRate + "%" : ""} sobre vendas físicas</span><span className="font-bold">{formatBRL(comissao)}</span></div>}
            </div>
          )}
        </div>
      )}

      {/* Explicação do fluxo */}
      <div className="px-4 pb-3">
        <div className="bg-muted/40 rounded-xl p-3 space-y-2">
          <p className="text-[11px] font-bold text-foreground uppercase tracking-wide">Como funciona</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CircleCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground"><strong className="text-foreground">PIX online:</strong> taxa descontada automaticamente na hora do pagamento. Não acumula nada aqui.</p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground"><strong className="text-foreground">Dinheiro / cartão:</strong> cliente paga direto a você. A taxa da plataforma (R${splitPerOrder.toFixed(2).replace(".", ",")} por entrega{commissionRate > 0 ? ` + ${commissionRate}% de comissão` : ""}) fica registrada aqui para você repassar via PIX.</p>
            </div>
            <div className="flex items-start gap-2">
              <CircleCheck className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground"><strong className="text-foreground">Automático:</strong> quando chegar em R$5, o sistema gera um PIX automaticamente todo dia. Se não pagar em 30 dias, a loja pode ser suspensa.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pagamento */}
      <div className="px-4 pb-4">
        {pixData ? (
          <div className="space-y-3 bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between"><p className="text-sm font-bold">Pague via PIX</p><button onClick={() => setPixData(null)}><X className="h-4 w-4 text-muted-foreground" /></button></div>
            <p className="text-2xl font-black text-center">{formatBRL(pixData.amount)}</p>
            {pixData.qr_code_base64 && <div className="flex justify-center"><img src={pixData.qr_code_base64.startsWith("data:") ? pixData.qr_code_base64 : `data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code PIX" className="w-44 h-44 rounded-xl" /></div>}
            {pixData.qr_code && <button onClick={copyPix} className="w-full flex items-center justify-center gap-2 border border-border bg-muted/40 rounded-xl py-2.5 text-sm font-bold active:scale-[0.98] transition-transform"><Copy className="h-4 w-4" /> Copiar Código PIX</button>}
            <p className="text-[10px] text-muted-foreground text-center">Após o pagamento, o saldo é zerado automaticamente.</p>
          </div>
        ) : canPay ? (
          <button onClick={handlePayFee} disabled={generating} className="w-full h-12 bg-amber-500 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 shadow-md shadow-amber-500/25">
            {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...</> : <><QrCode className="h-4 w-4" /> Pagar {formatBRL(total)} agora</>}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-1">Valor ainda abaixo de R$5,00 — crescerá a cada pedido físico.</p>
        )}
        {onGoToFinance && !pixData && <button onClick={onGoToFinance} className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-2">Ver detalhes no painel financeiro →</button>}
      </div>
    </div>
  );
};

export default PlatformSplitAlert;
