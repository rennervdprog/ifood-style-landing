import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UtensilsCrossed as Pastel } from "lucide-react";

interface PastelFlavorManagerProps {
  storeId: string;
}

interface PastelConfig {
  sizes?: string[];
  flavors?: any[];
  max_flavors?: 2 | 3 | 4;
}

type PastelPriceMode = "maior" | "media" | "soma";

const PastelFlavorManager = ({ storeId }: PastelFlavorManagerProps) => {
  const queryClient = useQueryClient();

  const { data: store } = useQuery({
    queryKey: ["store-for-pastel", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("settings").eq("id", storeId).single();
      return data;
    },
  });

  const settings = (store?.settings || {}) as Record<string, any>;
  const pastelConfig: PastelConfig = settings.pastel_config || {};
  const maxFlavors: 2 | 3 | 4 = (pastelConfig.max_flavors as 2 | 3 | 4) || 4;
  const halfEnabled: boolean = settings.pastel_half_enabled !== false;
  const priceMode: PastelPriceMode = (settings.pastel_price_mode as PastelPriceMode) || "maior";
  const singleSize: boolean = !!settings.pastel_single_size;

  const saveConfig = async (newConfig: PastelConfig) => {
    const newSettings = { ...settings, pastel_config: newConfig } as any;
    const { error } = await supabase.from("stores").update({ settings: newSettings }).eq("id", storeId);
    if (error) { toast.error("Erro ao salvar"); return; }
    queryClient.invalidateQueries({ queryKey: ["store-for-pastel", storeId] });
  };

  const saveSettingField = async (patch: Record<string, any>) => {
    const newSettings = { ...settings, ...patch } as any;
    const { error } = await supabase.from("stores").update({ settings: newSettings }).eq("id", storeId);
    if (error) { toast.error("Erro ao salvar"); return; }
    queryClient.invalidateQueries({ queryKey: ["store-for-pastel", storeId] });
  };

  const setMaxFlavors = async (n: 2 | 3 | 4) => {
    await saveConfig({ ...pastelConfig, max_flavors: n });
    toast.success(n === 2 ? "Apenas meio a meio" : `Até ${n} sabores por pastel`);
  };

  return (
    <div className="space-y-6">
      {/* Explanation banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-1.5">
        <p className="text-xs font-bold text-primary uppercase tracking-wider">Como funciona?</p>
        <p className="text-xs text-foreground/80 leading-relaxed">
          1️⃣ Cadastre cada <b>sabor de pastel como um produto normal</b> na aba <b>Cardápio</b> (com nome, foto e preço).<br/>
          2️⃣ Aqui você define apenas a <b>regra de combinação</b>: quantos sabores cabem em um pastel e como o preço é calculado quando o cliente escolher mais de um sabor.<br/>
          3️⃣ Para evitar que <b>bebidas</b> apareçam no modal de meio a meio, marque a opção <b>"É bebida?"</b> ao criar o produto.
        </p>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2">
        <Pastel className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-bold text-foreground/80 uppercase tracking-wider">Regras de Combinação</h2>
      </div>

      {/* Single vs multi size */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Trabalha com um único tamanho?</p>
            <p className="text-[10px] text-muted-foreground">
              Ative se sua pastelaria vende pastel em um tamanho só. O editor de tamanhos some do cadastro de produtos e o cliente vê apenas o preço base — meio a meio e múltiplos sabores continuam funcionando normalmente.
            </p>
          </div>
          <button
            onClick={() => saveSettingField({ pastel_single_size: !singleSize })}
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${singleSize ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${singleSize ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

      {/* Max flavors per pizza */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-foreground/70 uppercase">Sabores por pastel</h3>
        <div className="grid grid-cols-3 gap-2">
          {([2, 3, 4] as const).map(n => {
            const active = maxFlavors === n;
            return (
              <button
                key={n}
                onClick={() => setMaxFlavors(n)}
                className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all ${
                  active
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-muted border-transparent text-muted-foreground"
                }`}
              >
                <span className="text-xl font-black">{n}</span>
                <span className="text-[10px] font-bold mt-0.5">
                  {n === 2 ? "Só meio a meio" : `Até ${n} sabores`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Define o máximo de sabores que o cliente pode combinar em uma única pizza.
        </p>
      </div>

      {/* Half-and-half enable + price mode */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">Permitir múltiplos sabores</p>
            <p className="text-[10px] text-muted-foreground">Clientes poderão montar pizza com sabores diferentes</p>
          </div>
          <button
            onClick={() => saveSettingField({ pastel_half_enabled: !halfEnabled })}
            className={`w-12 h-6 rounded-full transition-colors relative ${halfEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${halfEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>

        {halfEnabled && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-foreground/70">Como calcular o valor da pastel com vários sabores?</p>
            {([
              { id: "maior", title: "💰 Maior valor", desc: "Cobra o preço do sabor mais caro." },
              { id: "media", title: "📊 Média dos valores", desc: "Cobra a média dos sabores." },
              { id: "soma",  title: "➗ Soma dividida", desc: "Cobra a fração de cada sabor (igual à média)." },
            ] as const).map(opt => {
              const active = priceMode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => saveSettingField({ pastel_price_mode: opt.id })}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    active ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <p className={`text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}>{opt.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PastelFlavorManager;
