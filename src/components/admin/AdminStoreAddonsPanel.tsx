import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Loader2, Crown, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AdminStoreAddonsPanel({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data } = useQuery({
    queryKey: ["admin-store-addons", storeId],
    queryFn: async () => {
      const [catRes, subRes, storeRes] = await Promise.all([
        supabase.from("plan_addons" as any).select("code, name, monthly_price").eq("code", "pdv").maybeSingle(),
        supabase.from("store_addons" as any).select("enabled, price_override, cancels_at, activated_at, first_charge_done").eq("store_id", storeId).eq("addon_code", "pdv").maybeSingle(),
        supabase.from("stores" as any).select("legacy_pdv").eq("id", storeId).maybeSingle(),
      ]);
      const planRes = await supabase.from("store_plans" as any).select("billing_credit_cents").eq("store_id", storeId).maybeSingle();
      return {
        catalog: catRes.data as any,
        sub: subRes.data as any,
        legacy: !!(storeRes.data as any)?.legacy_pdv,
        creditCents: Number((planRes.data as any)?.billing_credit_cents ?? 0),
      };
    },
  });
  const isLegacyPdv = !!data?.legacy;

  const [enabled, setEnabled] = useState(false);
  const [override, setOverride] = useState<string>("");

  useEffect(() => {
    if (data) {
      setEnabled(!!data.sub?.enabled);
      setOverride(data.sub?.price_override !== null && data.sub?.price_override !== undefined ? String(data.sub.price_override) : "");
    }
  }, [data?.sub?.enabled, data?.sub?.price_override]);

  const catalogPrice = Number(data?.catalog?.monthly_price ?? 49);
  const effectivePrice = override === "" ? catalogPrice : Number(override);

  const save = async () => {
    setSaving(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("manage-store-addon", {
        body: {
          store_id: storeId,
          addon_code: "pdv",
          action: "admin_set",
          enabled,
          price_override: override === "" ? null : Number(override),
        },
      });
      if (error || (res as any)?.error) throw new Error((res as any)?.error || error?.message);
      toast.success("Add-on atualizado");
      qc.invalidateQueries({ queryKey: ["admin-store-addons", storeId] });
      qc.invalidateQueries({ queryKey: ["store-pdv-access", storeId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-primary" />
        <span className="text-xs font-black">Add-ons pagos</span>
        {isLegacyPdv && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold">Legacy (PDV incluso)</span>
        )}
      </div>
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold">PDV — Ponto de Venda</p>
            <p className="text-[10px] text-muted-foreground">Catálogo: R$ {catalogPrice.toFixed(2)}/mês</p>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-bold">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Ativo
          </label>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-muted-foreground flex-1">
            Override VIP (R$/mês, vazio=usa catálogo, 0=grátis)
            <input
              type="number" step="0.01" min="0" value={override}
              onChange={(e) => setOverride(e.target.value)}
              placeholder={catalogPrice.toFixed(2)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
            />
          </label>
        </div>
        {data?.sub?.cancels_at && (
          <p className="text-[10px] text-amber-500">Agendado p/ cancelar em {new Date(data.sub.cancels_at).toLocaleDateString("pt-BR")}</p>
        )}
        {data?.sub?.enabled && !data?.sub?.first_charge_done && effectivePrice > 0 && (
          <p className="text-[10px] text-sky-500">1ª cobrança será proporcional aos dias restantes do mês.</p>
        )}
        {(data?.creditCents ?? 0) > 0 && (
          <p className="text-[10px] text-emerald-500">Crédito acumulado: <b>R$ {(data!.creditCents / 100).toFixed(2)}</b> (será abatido na próxima fatura)</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          Efetivo: <b>R$ {effectivePrice.toFixed(2)}/mês</b> {effectivePrice === 0 && enabled && "(VIP grátis)"}
        </p>
        <button onClick={save} disabled={saving}
          className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black disabled:opacity-40 flex items-center justify-center gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5" />}
          Salvar add-on
        </button>
      </div>
    </div>
  );
}