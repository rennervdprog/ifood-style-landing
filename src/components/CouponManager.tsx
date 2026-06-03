import { formatBRL } from "@/lib/utils";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Tag, Percent, DollarSign, Truck } from "lucide-react";
import { useStorePlan } from "@/hooks/useStorePlan";

interface CouponManagerProps {
  storeId?: string; // if provided, manage store-specific coupons
  isAdmin?: boolean;
}

const discountTypeLabels: Record<string, { label: string; icon: React.ElementType }> = {
  percentage: { label: "Porcentagem", icon: Percent },
  fixed: { label: "Valor fixo", icon: DollarSign },
  free_shipping: { label: "Frete grátis", icon: Truck },
};

const CouponManager = ({ storeId, isAdmin }: CouponManagerProps) => {
  const queryClient = useQueryClient();
  const storePlan = useStorePlan(storeId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    description: "",
    discount_type: "percentage",
    discount_value: "",
    min_order_value: "",
    max_uses: "",
    first_order_only: false,
    expires_at: "",
  });

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["coupons", storeId],
    queryFn: async () => {
      let q = supabase.from("coupons" as any).select("*").order("created_at", { ascending: false });
      if (storeId) q = q.eq("store_id", storeId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const handleCreate = async () => {
    if (!form.code.trim()) {
      toast.error("Informe o código do cupom.");
      return;
    }

    // Enforce coupon limit for fixed plan
    if (!isAdmin && storePlan.maxCoupons !== null) {
      const activeCoupons = (coupons || []).filter((c: any) => c.is_active);
      if (activeCoupons.length >= storePlan.maxCoupons) {
        toast.error(`Seu plano permite no máximo ${storePlan.maxCoupons} cupons ativos. Desative um cupom existente ou faça upgrade.`);
        return;
      }
    }

    try {
      const payload: any = {
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: form.discount_type === "free_shipping" ? 0 : parseFloat(form.discount_value) || 0,
        min_order_value: parseFloat(form.min_order_value) || 0,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        first_order_only: form.first_order_only,
        expires_at: form.expires_at || null,
        is_active: true,
      };
      if (storeId) payload.store_id = storeId;

      const { error } = await supabase.from("coupons" as any).insert(payload);
      if (error) throw error;

      toast.success("Cupom criado!");
      setShowForm(false);
      setForm({ code: "", description: "", discount_type: "percentage", discount_value: "", min_order_value: "", max_uses: "", first_order_only: false, expires_at: "" });
      queryClient.invalidateQueries({ queryKey: ["coupons", storeId] });
    } catch (err: any) {
      toast.error(err.message?.includes("unique") ? "Código já existe." : "Erro ao criar cupom.");
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("coupons" as any).update({ is_active: !current }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["coupons", storeId] });
    toast.success(current ? "Cupom desativado" : "Cupom ativado");
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Excluir este cupom?")) return;
    await supabase.from("coupons" as any).delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["coupons", storeId] });
    toast.success("Cupom excluído");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          Cupons de Desconto
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" /> Novo
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <input
            placeholder="CÓDIGO (ex: PROMO10)"
            value={form.code}
            onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
          />
          <input
            placeholder="Descrição (opcional)"
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
          />
          <div className="flex gap-2">
            {Object.entries(discountTypeLabels).map(([key, { label, icon: Icon }]) => (
              <button
                key={key}
                onClick={() => setForm(f => ({ ...f, discount_type: key }))}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold border ${
                  form.discount_type === key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                }`}
              >
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
          </div>
          {form.discount_type !== "free_shipping" && (
            <input
              type="number"
              placeholder={form.discount_type === "percentage" ? "Desconto (%)" : "Desconto (R$)"}
              value={form.discount_value}
              onChange={(e) => setForm(f => ({ ...f, discount_value: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            />
          )}
          {form.discount_type === "free_shipping" && (
            <div className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-lg p-2 leading-relaxed">
              ⚠️ <strong>Atenção:</strong> ao oferecer frete grátis, sua loja absorve a taxa fixa de <strong>R$ 2,00</strong> da plataforma por pedido (modelo iFood/Rappi). O cliente vê R$ 0,00 de entrega; o valor é debitado do seu repasse.
            </div>
          )}
          <input
            type="number"
            placeholder="Pedido mínimo (R$) - opcional"
            value={form.min_order_value}
            onChange={(e) => setForm(f => ({ ...f, min_order_value: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
          />
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Máx. usos (vazio = ilimitado)"
              value={form.max_uses}
              onChange={(e) => setForm(f => ({ ...f, max_uses: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            />
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm(f => ({ ...f, expires_at: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.first_order_only}
              onChange={(e) => setForm(f => ({ ...f, first_order_only: e.target.checked }))}
              className="rounded border-border"
            />
            Apenas primeiro pedido
          </label>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground">
              Cancelar
            </button>
            <button onClick={handleCreate} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              Criar Cupom
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : coupons && coupons.length > 0 ? (
        <div className="space-y-2">
          {coupons.map((c: any) => {
            const typeInfo = discountTypeLabels[c.discount_type] || discountTypeLabels.percentage;
            const TypeIcon = typeInfo.icon;
            return (
              <div key={c.id} className={`bg-card border rounded-xl p-3 flex items-center justify-between ${c.is_active ? "border-border" : "border-red-500/30 opacity-60"}`}>
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <TypeIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{c.code}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.discount_type === "percentage" && `${c.discount_value}% off`}
                      {c.discount_type === "fixed" && `${formatBRL(Number(c.discount_value))} off`}
                      {c.discount_type === "free_shipping" && "Frete grátis"}
                      {c.min_order_value > 0 && ` · Min ${formatBRL(Number(c.min_order_value))}`}
                      {` · ${c.used_count} usos`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(c.id, c.is_active)}
                    className={`text-[10px] font-bold px-2 py-1 rounded ${c.is_active ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-500"}`}
                  >
                    {c.is_active ? "Ativo" : "Inativo"}
                  </button>
                  {isAdmin && (
                    <button onClick={() => deleteCoupon(c.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-6">Nenhum cupom criado ainda.</p>
      )}
    </div>
  );
};

export default CouponManager;
