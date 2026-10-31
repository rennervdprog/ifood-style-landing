import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, Check, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/functionError";
import { formatBRL } from "@/lib/utils";
import { PdvOperatorLoginDialog } from "@/components/pdv/PdvOperatorLoginDialog";

const ESSENCIAL_FEE = 89.9;

/**
 * Cartão de migração Somente PDV → Essencial mantendo o PDV.
 * Só aparece para lojas pdv_only (aba "Meu Plano" do PDV).
 * A migração roda na edge function manage-store-addon
 * (action=migrate_to_essencial): PDV vira add-on ativo, plano vira
 * Essencial (fixed, R$ 89,90) e a loja ganha delivery/painel completo.
 * Vale a partir da próxima fatura; o add-on do PDV é proporcional
 * no primeiro mês (regra do monthly-billing).
 */
export default function PdvMigratePlanCard({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [pinOpen, setPinOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const { data: plan } = useQuery({
    queryKey: ["pdv-migrate-plan", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_plans")
        .select("plan_type, monthly_fee")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .maybeSingle();
      return data as { plan_type: string; monthly_fee: number } | null;
    },
  });

  const { data: addonPrice } = useQuery({
    queryKey: ["pdv-addon-catalog-price"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_addons" as any)
        .select("monthly_price")
        .eq("code", "pdv")
        .maybeSingle();
      return Number((data as any)?.monthly_price ?? 49);
    },
  });

  if (!plan || plan.plan_type !== "pdv_only") return null;

  const pdvPrice = addonPrice ?? 49;
  const total = ESSENCIAL_FEE + pdvPrice;

  const migrate = async () => {
    setMigrating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-store-addon", {
        body: { store_id: storeId, addon_code: "pdv", action: "migrate_to_essencial" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Pronto! Sua loja agora é Essencial + PDV. O delivery já está liberado no painel completo.");
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ["pdv-migrate-plan", storeId] });
      qc.invalidateQueries({ queryKey: ["store-pdv-access", storeId] });
      qc.invalidateQueries({ queryKey: ["plan-summary-card", storeId] });
      qc.invalidateQueries({ queryKey: ["store-subscription", storeId] });
      qc.invalidateQueries({ queryKey: ["store-plan", storeId] });
    } catch (e: any) {
      toast.error(await getFunctionErrorMessage(e, "Não foi possível migrar agora. Tente de novo."));
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="p-4 pb-0">
      <div className="rounded-2xl border-2 border-primary/60 bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-black text-lg leading-tight">Quer vender por delivery também?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Migre para o plano <b className="text-foreground">Essencial</b> e <b className="text-foreground">mantenha o PDV</b>:
              sua loja ganha vitrine no app e no site, pedidos de delivery e o painel completo —
              e o caixa continua funcionando do mesmo jeito.
            </p>
          </div>
        </div>

        <ul className="space-y-1.5 text-sm">
          {[
            "O PDV não para: ele vira um adicional do plano e segue liberado",
            "Seus produtos, estoque, operadores e histórico continuam os mesmos",
            "No delivery valem as taxas do Essencial: R$ 0,99 por entrega e R$ 1,99 por pedido pago no PIX",
          ].map((t) => (
            <li key={t} className="flex gap-2 items-start">
              <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" strokeWidth={3} />
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-xl bg-muted/40 p-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hoje (Somente PDV)</span>
            <b>{formatBRL(Number(plan.monthly_fee))}/mês</b>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Essencial</span>
            <b>{formatBRL(ESSENCIAL_FEE)}/mês</b>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Adicional PDV</span>
            <b>{formatBRL(pdvPrice)}/mês</b>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
            <span className="font-bold">Novo total</span>
            <b className="text-primary text-base">{formatBRL(total)}/mês</b>
          </div>
          <p className="text-[12px] text-muted-foreground pt-1">
            A troca vale a partir da próxima fatura. No primeiro mês, o adicional do PDV é cobrado proporcional aos dias.
          </p>
        </div>

        {!confirming ? (
          <button
            onClick={() => setPinOpen(true)}
            className="w-full bg-primary text-primary-foreground font-bold rounded-xl py-3 text-[15px] hover:bg-primary/90 transition-colors"
          >
            Migrar para o Essencial mantendo o PDV
          </button>
        ) : (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
            <p className="text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <b>Confirmar a migração?</b> Sua loja sai do Somente PDV e vira Essencial + PDV
                ({formatBRL(total)}/mês a partir da próxima fatura). Não tem volta automática —
                qualquer dúvida, fale com a gente antes.
              </span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={migrate}
                disabled={migrating}
                className="flex-1 bg-primary text-primary-foreground font-bold rounded-lg py-2.5 text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {migrating && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar migração
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={migrating}
                className="px-4 rounded-lg border border-border font-semibold text-sm hover:bg-muted transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <PdvOperatorLoginDialog
        open={pinOpen}
        storeId={storeId}
        onClose={() => setPinOpen(false)}
        onLogin={() => {
          setPinOpen(false);
          setConfirming(true);
        }}
        requiredRole="gerente"
        title="Autorização do gerente"
      />
    </div>
  );
}
