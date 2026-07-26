import { formatBRL } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Truck, Save, MapPin, DollarSign, Users, Crown } from "lucide-react";
import { DEFAULT_DELIVERY_FEE_CONFIG, type DeliveryFeeConfig as FeeConfig } from "@/lib/deliveryFee";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";

const BRLInput = ({ value, onChange, placeholder }: { value: string, onChange: (v: string) => void, placeholder?: string }) => {
  const [display, setDisplay] = useState(value && parseFloat(value) > 0 ? formatBRLDisplay(parseFloat(value)) : "");
  
  useEffect(() => {
    setDisplay(value && parseFloat(value) > 0 ? formatBRLDisplay(parseFloat(value)) : "");
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw.replace(/\D/g, "")) {
      setDisplay("");
      onChange("0");
      return;
    }
    const n = parseBRLCentsInput(raw);
    setDisplay(formatBRLDisplay(n));
    onChange(n.toFixed(2));
  };

  return (
    <div className="flex-1 flex items-center gap-2 bg-background border border-border rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary">
      <span className="text-sm text-muted-foreground font-bold">R$</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder || "0,00"}
        className="flex-1 bg-transparent text-foreground text-sm focus:outline-none"
      />
    </div>
  );
};

const DeliveryFeeConfigPanel = () => {
  const queryClient = useQueryClient();
  const [cityName, setCityName] = useState(DEFAULT_DELIVERY_FEE_CONFIG.city_name);
  const [cityFee, setCityFee] = useState(DEFAULT_DELIVERY_FEE_CONFIG.city_fee.toFixed(2));
  const [ruralBaseFee, setRuralBaseFee] = useState(DEFAULT_DELIVERY_FEE_CONFIG.rural_base_fee.toFixed(2));
  const [ruralPerKm, setRuralPerKm] = useState(DEFAULT_DELIVERY_FEE_CONFIG.rural_per_km.toFixed(2));
  const [driverSplit, setDriverSplit] = useState(DEFAULT_DELIVERY_FEE_CONFIG.driver_split.toFixed(2));
  const [platformSplit, setPlatformSplit] = useState(DEFAULT_DELIVERY_FEE_CONFIG.platform_split.toFixed(2));
  const [pixOperationalFee, setPixOperationalFee] = useState(DEFAULT_DELIVERY_FEE_CONFIG.pix_operational_fee.toFixed(2));
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

  // Contagem de lojas com override VIP na taxa da plataforma
  const { data: vipOverrideCount = 0 } = useQuery({
    queryKey: ["delivery-fee-vip-overrides"],
    queryFn: async () => {
      const { count } = await supabase
        .from("store_plans")
        .select("store_id", { count: "exact", head: true })
        .eq("is_active", true)
        .not("platform_delivery_split_override", "is", null);
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (configData && !loaded) {
      setCityName(configData.city_name || DEFAULT_DELIVERY_FEE_CONFIG.city_name);
      setCityFee((configData.city_fee ?? DEFAULT_DELIVERY_FEE_CONFIG.city_fee).toFixed(2));
      setRuralBaseFee((configData.rural_base_fee ?? DEFAULT_DELIVERY_FEE_CONFIG.rural_base_fee).toFixed(2));
      setRuralPerKm((configData.rural_per_km ?? DEFAULT_DELIVERY_FEE_CONFIG.rural_per_km).toFixed(2));
      setDriverSplit((configData.driver_split ?? DEFAULT_DELIVERY_FEE_CONFIG.driver_split).toFixed(2));
      setPlatformSplit((configData.platform_split ?? DEFAULT_DELIVERY_FEE_CONFIG.platform_split).toFixed(2));
      setPixOperationalFee((configData.pix_operational_fee ?? DEFAULT_DELIVERY_FEE_CONFIG.pix_operational_fee).toFixed(2));
      setLoaded(true);
    }
  }, [configData, loaded]);

  const handleSave = async () => {
    const config: FeeConfig = {
      city_name: cityName.trim(),
      city_fee: parseFloat(cityFee) || 0,
      rural_base_fee: parseFloat(ruralBaseFee) || 0,
      rural_per_km: parseFloat(ruralPerKm) || 0,
      driver_split: parseFloat(driverSplit) || 0,
      platform_split: parseFloat(platformSplit) || 0,
      pix_operational_fee: parseFloat(pixOperationalFee) || 0,
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
  const totalDeliveryFee = (parseFloat(driverSplit) || 0) + (parseFloat(platformSplit) || 0);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
        <Truck className="h-4 w-4" /> Configuração de Taxa de Entrega
      </h2>

      {vipOverrideCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          <Crown className="h-3.5 w-3.5" />
          <span>
            <b>{vipOverrideCount}</b> loja(s) com <b>override VIP</b> na taxa da plataforma — a config global abaixo NÃO se aplica a elas.
          </span>
        </div>
      )}

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
          <BRLInput value={cityFee} onChange={setCityFee} placeholder="5,00" />
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-xs font-bold text-muted-foreground mb-3">🏕️ Fora da Cidade (Zona Rural)</p>

          {/* Rural Base Fee */}
          <div className="space-y-1 mb-3">
            <label className="text-xs font-bold text-muted-foreground">Taxa Base (fixa)</label>
            <BRLInput value={ruralBaseFee} onChange={setRuralBaseFee} placeholder="5,00" />
          </div>

          {/* Rural Per KM */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Taxa por KM</label>
            <div className="flex items-center gap-2">
              <BRLInput value={ruralPerKm} onChange={setRuralPerKm} placeholder="0,60" />
              <span className="text-xs text-muted-foreground font-bold whitespace-nowrap">/ km</span>
            </div>
          </div>
        </div>

        {/* Split Config */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> 🏍️ Split de Entrega (Plano Fixo)
          </p>
          <p className="text-[10px] text-muted-foreground mb-3">Esses valores só se aplicam a lojas no <strong>Plano Fixo</strong>. Lojas com comissão usam a % do plano.</p>

          {/* Driver Split */}
          <div className="space-y-1 mb-3">
            <label className="text-xs font-bold text-muted-foreground">Motoboy da plataforma (por corrida)</label>
            <BRLInput value={driverSplit} onChange={setDriverSplit} placeholder="4,00" />
          </div>

          {/* Platform Split */}
          <div className="space-y-1 mb-3">
            <label className="text-xs font-bold text-muted-foreground">Plataforma (por corrida)</label>
            <BRLInput value={platformSplit} onChange={setPlatformSplit} placeholder="2,00" />
          </div>

          {/* PIX Operational Fee */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Taxa operacional PIX (por transação)</label>
            <BRLInput value={pixOperationalFee} onChange={setPixOperationalFee} placeholder="1,00" />
            <p className="text-[10px] text-muted-foreground mt-1">Cobrado da loja em cada pagamento PIX (plano fixo).</p>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1">
          <p className="text-xs font-bold text-primary">📊 Simulação</p>
          <p className="text-xs text-muted-foreground">
            Dentro de {cityName || "cidade"}: <span className="text-foreground font-bold">{formatBRL((parseFloat(cityFee) || 0))}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Zona rural (ex: 15km): <span className="text-foreground font-bold">{formatBRL(exampleRuralFee)}</span>
            <span className="text-[10px] ml-1">({formatBRL((parseFloat(ruralBaseFee) || 0))} + 15 × {formatBRL((parseFloat(ruralPerKm) || 0))})</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Plano fixo — motoboy recebe: <span className="text-foreground font-bold">{formatBRL((parseFloat(driverSplit) || 0))}</span> + plataforma: <span className="text-foreground font-bold">{formatBRL((parseFloat(platformSplit) || 0))}</span> = total <span className="text-foreground font-bold">{formatBRL(totalDeliveryFee)}</span>
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