import { ArrowLeft, Monitor, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  storeId: string;
  monthlyPrice: number;
  onBack: () => void;
}

export default function PdvUpsellScreen({ storeId, monthlyPrice, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const activate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-store-addon", {
        body: { store_id: storeId, addon_code: "pdv", action: "activate" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("PDV ativado! A cobrança proporcional entra na próxima fatura.");
      qc.invalidateQueries({ queryKey: ["store-pdv-access", storeId] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao ativar PDV.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-muted" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold">PDV — Ponto de Venda</h1>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Monitor className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black leading-tight">Ative o PDV da sua loja</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Caixa, sangria, suprimento, fechamento cego, atalhos, impressão térmica e integração com delivery.
            </p>
          </div>

          <ul className="space-y-2 text-sm">
            {[
              "Vendas presenciais separadas do delivery",
              "Impressão de comprovante térmico",
              "Sangria, suprimento e fechamento de caixa",
              "Relatórios por turno e por operador",
              "Atalhos de teclado profissionais",
            ].map((f) => (
              <li key={f} className="flex gap-2 items-start">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-xl bg-muted/40 p-4">
            <div className="text-3xl font-black text-primary">
              R$ {monthlyPrice.toFixed(2).replace(".", ",")}
              <span className="text-sm font-medium text-muted-foreground">/mês</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Cobrança proporcional aos dias restantes na primeira fatura. Cancele quando quiser.
            </p>
          </div>

          <Button className="w-full h-12 text-base font-bold" onClick={activate} disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Ativar PDV agora"}
          </Button>
          <p className="text-[11px] text-center text-muted-foreground">
            A ativação libera o PDV imediatamente.
          </p>
        </div>
      </main>
    </div>
  );
}