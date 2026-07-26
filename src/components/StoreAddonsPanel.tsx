import { Monitor, Check, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const qc = useQueryClient();

  // Enquanto flag desligada, nem aparece pro lojista.
  // Lojas legacy também não veem — PDV já é incluso na regra antiga.
  if (!flag) return null;
  if (access.source === "legacy" || access.source === "pdv_only") return null;

  const call = async (action: "activate" | "cancel" | "reactivate") => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-store-addon", {
        body: { store_id: storeId, addon_code: "pdv", action },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        action === "activate" ? "PDV ativado!"
        : action === "reactivate" ? "Cancelamento desfeito."
        : "Cancelamento agendado para o fim do ciclo."
      );
      qc.invalidateQueries({ queryKey: ["store-pdv-access", storeId] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao atualizar módulo.");
    } finally {
      setLoading(false);
    }
  };

  const isVip = access.source === "vip";
  const isPaid = access.source === "addon";
  const isNone = access.source === "none";
  const cancelDate = access.cancelsAt ? new Date(access.cancelsAt).toLocaleDateString("pt-BR") : null;

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
              {isVip && <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/40">VIP grátis</Badge>}
              {isPaid && <Badge className="text-[10px]">Ativo</Badge>}
              {cancelDate && (
                <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
                  Cancela em {cancelDate}
                </Badge>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground mt-1">
              {isVip && "PDV liberado como cortesia pela administração (R$ 0/mês)."}
              {isPaid && !cancelDate && `Mensalidade: R$ ${access.monthlyPrice.toFixed(2).replace(".", ",")}. Cancele quando quiser.`}
              {isPaid && cancelDate && `Você mantém acesso até ${cancelDate}. Nenhuma cobrança no próximo ciclo.`}
              {isNone && `Ative por R$ ${access.monthlyPrice.toFixed(2).replace(".", ",")}/mês (proporcional na 1ª fatura).`}
            </p>
          </div>

          <div className="shrink-0 flex gap-2">
            {isNone && (
              <Button size="sm" onClick={() => call("activate")} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar"}
              </Button>
            )}
            {isPaid && !access.canReactivate && (
              <Button size="sm" variant="outline" onClick={() => setConfirmCancel(true)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar"}
              </Button>
            )}
            {access.canReactivate && (
              <Button size="sm" onClick={() => call("reactivate")} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="h-4 w-4 mr-1" />Reativar</>}
              </Button>
            )}
            {isVip && <Check className="h-5 w-5 text-primary" />}
          </div>
        </div>

        <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar módulo PDV?</AlertDialogTitle>
              <AlertDialogDescription>
                Você mantém o acesso até o fim do ciclo atual. Nenhuma cobrança será feita
                no próximo mês. Pode reativar a qualquer momento antes do fim do ciclo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setConfirmCancel(false); call("cancel"); }}>
                Confirmar cancelamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}