import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, QrCode, Copy, Loader2, X, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PlatformSplitAlertProps {
  storeId: string;
  storeName: string;
  splitPerOrder: number;
  onGoToFinance?: () => void;
}

const PlatformSplitAlert = ({ storeId, storeName, splitPerOrder, onGoToFinance }: PlatformSplitAlertProps) => {
  const [generating, setGenerating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; amount: number } | null>(null);
  const queryClient = useQueryClient();

  const { data: storeBalance } = useQuery({
    queryKey: ["store-balance-split", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_balances")
        .select("repasse_pendente")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
    refetchInterval: 30000,
  });

  const pendingFee = Number(storeBalance?.repasse_pendente || 0);

  if (dismissed || pendingFee <= 0) return null;

  const handlePayFee = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("store-platform-fee-pix", {
        body: { store_id: storeId, amount: pendingFee },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPixData({ qr_code: data.qr_code, qr_code_base64: data.qr_code_base64, amount: data.amount });
      toast.success("PIX gerado! Escaneie o QR Code para pagar.");
      queryClient.invalidateQueries({ queryKey: ["store-balance-split", storeId] });
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

  return (
    <div className="rounded-2xl border-2 border-blue-500/30 p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 to-transparent" />
      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-blue-500" />
            <div>
              <h3 className="font-bold text-sm text-foreground">
                Repasse Pendente — Taxa Plataforma
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Taxa de R$ {splitPerOrder.toFixed(2)} por pedido em dinheiro/cartão. Efetue o repasse via PIX.
              </p>
            </div>
          </div>
          {!pixData && (
            <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Amount */}
        <div className="text-center py-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Valor a Repassar</p>
          <p className="text-3xl font-black text-blue-500">
            R$ {pendingFee.toFixed(2)}
          </p>
        </div>

        {/* Info */}
        <div className="rounded-xl p-3 bg-blue-500/10 border border-blue-500/20 flex items-center gap-2">
          <Banknote className="h-4 w-4 text-blue-400" />
          <p className="text-xs font-medium text-blue-400">
            Cada pedido finalizado com pagamento físico (dinheiro/cartão) gera uma taxa de R$ {splitPerOrder.toFixed(2)} para a plataforma.
          </p>
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
            <p className="text-2xl font-black text-center text-foreground">R$ {pixData.amount.toFixed(2)}</p>

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
        ) : (
          <Button
            onClick={handlePayFee}
            disabled={generating}
            className="w-full font-bold text-white shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/20"
            size="lg"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...</>
            ) : (
              <><QrCode className="h-4 w-4" /> Pagar Repasse via PIX</>
            )}
          </Button>
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
