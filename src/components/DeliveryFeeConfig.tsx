import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Truck, Save, MapPin, DollarSign } from "lucide-react";
import { DEFAULT_DELIVERY_FEE_CONFIG, type DeliveryFeeConfig as FeeConfig } from "@/lib/deliveryFee";

const DeliveryFeeConfigPanel = () => {
  const queryClient = useQueryClient();
  const [cityName, setCityName] = useState(DEFAULT_DELIVERY_FEE_CONFIG.city_name);
  const [cityFee, setCityFee] = useState(DEFAULT_DELIVERY_FEE_CONFIG.city_fee.toString());
  const [ruralBaseFee, setRuralBaseFee] = useState(DEFAULT_DELIVERY_FEE_CONFIG.rural_base_fee.toString());
  const [ruralPerKm, setRuralPerKm] = useState(DEFAULT_DELIVERY_FEE_CONFIG.rural_per_km.toString());
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: configData } = useQuery({
    queryKey: ["delivery-fee-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "delivery_fee_config")
        .maybeSingle();
      return data?.value as unknown as FeeConfig | null;
    },
  });

  useEffect(() => {
    if (configData && !loaded) {
      setCityName(configData.city_name || DEFAULT_DELIVERY_FEE_CONFIG.city_name);
      setCityFee((configData.city_fee ?? DEFAULT_DELIVERY_FEE_CONFIG.city_fee).toString());
      setRuralBaseFee((configData.rural_base_fee ?? DEFAULT_DELIVERY_FEE_CONFIG.rural_base_fee).toString());
      setRuralPerKm((configData.rural_per_km ?? DEFAULT_DELIVERY_FEE_CONFIG.rural_per_km).toString());
      setLoaded(true);
    }
  }, [configData, loaded]);

  const handleSave = async () => {
    const config: FeeConfig = {
      city_name: cityName.trim(),
      city_fee: parseFloat(cityFee) || 0,
      rural_base_fee: parseFloat(ruralBaseFee) || 0,
      rural_per_km: parseFloat(ruralPerKm) || 0,
    };

    if (!config.city_name) {
      toast.error("Informe o nome da cidade.");
      return;
    }

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("admin_settings")
        .select("id")
        .eq("key", "delivery_fee_config")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("admin_settings")
          .update({ value: config as any, updated_at: new Date().toISOString() })
          .eq("key", "delivery_fee_config");
      } else {
        await supabase
          .from("admin_settings")
          .insert({ key: "delivery_fee_config", value: config as any });
      }

      toast.success("Configuração de entrega salva!");
      queryClient.invalidateQueries({ queryKey: ["delivery-fee-config"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  // Preview calculation
  const exampleRuralFee = (parseFloat(ruralBaseFee) || 0) + (parseFloat(ruralPerKm) || 0) * 15;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
        <Truck className="h-4 w-4" /> Configuração de Taxa de Entrega
      </h2>

      <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
        {/* City Name */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Cidade Base
          </label>
          <input
            type="text"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            placeholder="Itatinga"
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-[10px] text-muted-foreground">CEPs desta cidade terão taxa fixa.</p>
        </div>

        {/* City Fee */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Taxa Fixa (dentro da cidade)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={cityFee}
              onChange={(e) => setCityFee(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="5.00"
              className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-xs font-bold text-muted-foreground mb-3">🏕️ Fora da Cidade (Zona Rural)</p>

          {/* Rural Base Fee */}
          <div className="space-y-1 mb-3">
            <label className="text-xs font-bold text-muted-foreground">Taxa Base (fixa)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={ruralBaseFee}
                onChange={(e) => setRuralBaseFee(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="5.00"
                className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Rural Per KM */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Taxa por KM</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={ruralPerKm}
                onChange={(e) => setRuralPerKm(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="0.60"
                className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">/km</span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1">
          <p className="text-xs font-bold text-primary">📊 Simulação</p>
          <p className="text-xs text-muted-foreground">
            Dentro de {cityName || "cidade"}: <span className="text-foreground font-bold">R$ {(parseFloat(cityFee) || 0).toFixed(2)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Zona rural (ex: 15km): <span className="text-foreground font-bold">R$ {exampleRuralFee.toFixed(2)}</span>
            <span className="text-[10px] ml-1">(R$ {(parseFloat(ruralBaseFee) || 0).toFixed(2)} + 15 × R$ {(parseFloat(ruralPerKm) || 0).toFixed(2)})</span>
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Configuração"}
        </button>
      </div>
    </div>
  );
};

export default DeliveryFeeConfigPanel;
