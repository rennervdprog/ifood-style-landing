import { Monitor, Check, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStorePdvAccess, useAddonsFlag } from "@/hooks/useStorePdvAccess";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface Props { storeId: string; }

/** Seção "Módulos" na aba Meu Plano. */
export default function StoreAddonsPanel({ storeId }: Props) {
  const flag = useAddonsFlag();
  const access = useStorePdvAccess(storeId);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  // Enquanto flag desligada, nem aparece pro lojista.
  if (!flag) return null;

  const call = async (action: "activate" | "cancel") => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-store-addon", {
        body: { store_id: storeId, addon_code: "pdv", action },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(action === "activate" ? "PDV ativado!" : "Cancelamento agendado para o fim do ciclo.");
      qc.invalidateQueries({ queryKey: ["store-pdv-access", storeId] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao atualizar módulo.");
    } finally {
      setLoading(false);
    }
  };

  const isLegacy = access.source === "legacy";
  const isVip = access.source === "vip";
  const isPaid = access.source === "addon";
  const isNone = access.source === "none";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-bold text-sm">Módulos adicionais</h3>
        </div>

        <div className="rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Monitor className="h-5 w-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm">PDV — Ponto de Venda</span>
              {isLegacy && <Badge variant="outline" className="text-[10px]">Incluso (condição antiga)</Badge>}
              {isVip && <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/40">VIP grátis</Badge>}
              {isPaid && <Badge className="text-[10px]">Ativo</Badge>}
              {access.cancelsAt && (
                <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
                  Cancela em {new Date(access.cancelsAt).toLocaleDateString("pt-BR")}
                </Badge>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground mt-1">
              {isLegacy && "Você é loja original — PDV liberado com regra atual de R$ 1 por venda. Sem mensalidade extra."}
              {isVip && "PDV liberado como cortesia pela administração (R$ 0/mês)."}
              {isPaid && `Mensalidade: R$ ${access.monthlyPrice.toFixed(2).replace(".", ",")}. Cancele quando quiser.`}
              {isNone && `Ative por R$ ${access.monthlyPrice.toFixed(2).replace(".", ",")}/mês (proporcional na 1ª fatura).`}
            </p>
          </div>

          <div className="shrink-0">
            {isNone && (
              <Button size="sm" onClick={() => call("activate")} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar"}
              </Button>
            )}
            {isPaid && !access.cancelsAt && (
              <Button size="sm" variant="outline" onClick={() => call("cancel")} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar"}
              </Button>
            )}
            {(isLegacy || isVip) && <Check className="h-5 w-5 text-primary" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}