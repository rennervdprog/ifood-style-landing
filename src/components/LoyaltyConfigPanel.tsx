import { formatBRL } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, Save, Loader2 } from "lucide-react";

interface LoyaltyConfigPanelProps {
  storeId: string;
}

const LoyaltyConfigPanel = ({ storeId }: LoyaltyConfigPanelProps) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [pointsPerReal, setPointsPerReal] = useState(1);
  const [minRedeem, setMinRedeem] = useState(50);
  const [discountPerPoint, setDiscountPerPoint] = useState(0.10);
  const [maxDiscountPercent, setMaxDiscountPercent] = useState(20);

  const { data: config, isLoading } = useQuery({
    queryKey: ["loyalty-config-admin", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_config")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
  });

  const { data: stats } = useQuery({
    queryKey: ["loyalty-stats", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_points")
        .select("points, total_orders, user_id")
        .eq("store_id", storeId);
      return data || [];
    },
    enabled: !!storeId,
  });

  useEffect(() => {
    if (config) {
      setEnabled(config.is_enabled);
      setPointsPerReal(config.points_per_real);
      setMinRedeem(config.min_points_redeem);
      setDiscountPerPoint(config.discount_per_point);
      setMaxDiscountPercent(config.max_discount_percent);
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        store_id: storeId,
        is_enabled: enabled,
        points_per_real: pointsPerReal,
        min_points_redeem: minRedeem,
        discount_per_point: discountPerPoint,
        max_discount_percent: maxDiscountPercent,
        updated_at: new Date().toISOString(),
      };

      if (config) {
        const { error } = await supabase
          .from("loyalty_config")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("loyalty_config")
          .insert(payload);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["loyalty-config"] });
      toast.success("Configuração de fidelidade salva!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const totalClients = stats?.length || 0;
  const totalPointsIssued = stats?.reduce((sum: number, s: any) => sum + (s.points || 0), 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Star className="h-5 w-5 text-primary fill-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Programa de Fidelidade</h3>
          <p className="text-xs text-muted-foreground">Fidelize clientes com pontos e descontos</p>
        </div>
      </div>

      {/* Stats */}
      {totalClients > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-foreground">{totalClients}</p>
            <p className="text-[10px] text-muted-foreground">Clientes fidelizados</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-foreground">{totalPointsIssued}</p>
            <p className="text-[10px] text-muted-foreground">Pontos emitidos</p>
          </div>
        </div>
      )}

      {/* Enable toggle */}
      <div className="flex items-center justify-between bg-card rounded-xl border border-border p-4">
        <div>
          <p className="text-sm font-bold text-foreground">Ativar programa</p>
          <p className="text-xs text-muted-foreground">Clientes ganham pontos a cada pedido</p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`w-12 h-7 rounded-full transition-colors relative ${enabled ? "bg-primary" : "bg-muted"}`}
        >
          <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5.5 left-auto right-0.5" : "left-0.5"}`} />
        </button>
      </div>

      {enabled && (
        <div className="space-y-4">
          {/* Points per real */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Pontos por R$ 1,00 gasto</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={pointsPerReal}
              onChange={(e) => setPointsPerReal(parseFloat(e.target.value) || 1)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-[10px] text-muted-foreground">Ex: 1 ponto por real = pedido de R$ 50 gera 50 pontos</p>
          </div>

          {/* Min points to redeem */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Mínimo de pontos para resgate</label>
            <input
              type="number"
              min={10}
              step={10}
              value={minRedeem}
              onChange={(e) => setMinRedeem(parseInt(e.target.value) || 50)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Discount per point */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Valor do desconto por ponto (R$)</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={discountPerPoint}
              onChange={(e) => setDiscountPerPoint(parseFloat(e.target.value) || 0.10)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-[10px] text-muted-foreground">
              Com {minRedeem} pontos, o cliente ganha até {formatBRL((minRedeem * discountPerPoint))} de desconto
            </p>
          </div>

          {/* Max discount percent */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Desconto máximo do pedido (%)</label>
            <input
              type="number"
              min={5}
              max={100}
              step={5}
              value={maxDiscountPercent}
              onChange={(e) => setMaxDiscountPercent(parseInt(e.target.value) || 20)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-[10px] text-muted-foreground">
              Limita o desconto a {maxDiscountPercent}% do subtotal do pedido
            </p>
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3.5 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar configuração
      </button>
    </div>
  );
};

export default LoyaltyConfigPanel;
