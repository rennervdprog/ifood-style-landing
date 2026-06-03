import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, Pizza } from "lucide-react";

interface PizzaFlavorManagerProps {
  storeId: string;
}

interface PizzaFlavor {
  id: string;
  name: string;
  prices: Record<string, number>; // e.g. { "Brotinho": 25, "Grande": 45 }
}

interface PizzaConfig {
  sizes: string[];
  flavors: PizzaFlavor[];
  max_flavors?: 2 | 3 | 4;
}

type PizzaPriceMode = "maior" | "media" | "soma";

const DEFAULT_SIZES = ["Brotinho", "Média", "Grande", "Família"];

const formatBRL = (cents: number): string => {
  if (!cents) return "";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const parseCurrencyInput = (value: string): number => {
  const digits = value.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

const PizzaFlavorManager = ({ storeId }: PizzaFlavorManagerProps) => {
  const queryClient = useQueryClient();
  const [newFlavorName, setNewFlavorName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [activeSizes, setActiveSizes] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrices, setNewPrices] = useState<Record<string, number>>({});

  const { data: store } = useQuery({
    queryKey: ["store-for-pizza", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("settings").eq("id", storeId).single();
      return data;
    },
  });

  const settings = (store?.settings || {}) as Record<string, any>;
  const pizzaConfig: PizzaConfig = settings.pizza_config || { sizes: DEFAULT_SIZES, flavors: [] };
  const sizes = pizzaConfig.sizes?.length ? pizzaConfig.sizes : DEFAULT_SIZES;
  const flavors: PizzaFlavor[] = pizzaConfig.flavors || [];
  const maxFlavors: 2 | 3 | 4 = (pizzaConfig.max_flavors as 2 | 3 | 4) || 4;
  const halfEnabled: boolean = settings.pizza_half_enabled !== false;
  const priceMode: PizzaPriceMode = (settings.pizza_price_mode as PizzaPriceMode) || "maior";

  // Initialize active sizes from config
  if (activeSizes.length === 0 && sizes.length > 0) {
    // Will set on first render
  }

  const saveConfig = async (newConfig: PizzaConfig) => {
    const newSettings = { ...settings, pizza_config: newConfig } as any;
    const { error } = await supabase.from("stores").update({ settings: newSettings }).eq("id", storeId);
    if (error) { toast.error("Erro ao salvar"); return; }
    queryClient.invalidateQueries({ queryKey: ["store-for-pizza", storeId] });
  };

  const saveSettingField = async (patch: Record<string, any>) => {
    const newSettings = { ...settings, ...patch } as any;
    const { error } = await supabase.from("stores").update({ settings: newSettings }).eq("id", storeId);
    if (error) { toast.error("Erro ao salvar"); return; }
    queryClient.invalidateQueries({ queryKey: ["store-for-pizza", storeId] });
  };

  // Size management
  const toggleSize = async (size: string) => {
    const current = [...sizes];
    const idx = current.indexOf(size);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(size);
    }
    await saveConfig({ ...pizzaConfig, sizes: current });
    toast.success(idx >= 0 ? `${size} removido` : `${size} adicionado`);
  };

  const setMaxFlavors = async (n: 2 | 3 | 4) => {
    await saveConfig({ ...pizzaConfig, max_flavors: n });
    toast.success(n === 2 ? "Apenas meio a meio" : `Até ${n} sabores por pizza`);
  };

  // Flavor CRUD
  const addFlavor = async () => {
    if (!newFlavorName.trim()) return;
    if (flavors.some(f => f.name.toLowerCase() === newFlavorName.trim().toLowerCase())) {
      toast.error("Sabor já existe");
      return;
    }
    const newFlavor: PizzaFlavor = {
      id: crypto.randomUUID(),
      name: newFlavorName.trim(),
      prices: Object.fromEntries(sizes.map(s => [s, newPrices[s] || 0])),
    };
    await saveConfig({ ...pizzaConfig, flavors: [...flavors, newFlavor] });
    toast.success("Sabor adicionado!");
    setNewFlavorName("");
    setNewPrices({});
    setShowAddForm(false);
  };

  const deleteFlavor = async (id: string) => {
    await saveConfig({ ...pizzaConfig, flavors: flavors.filter(f => f.id !== id) });
    toast.success("Sabor excluído!");
  };

  const updateFlavorName = async (id: string, name: string) => {
    await saveConfig({
      ...pizzaConfig,
      flavors: flavors.map(f => f.id === id ? { ...f, name } : f),
    });
    setEditingId(null);
    toast.success("Nome atualizado!");
  };

  const updateFlavorPrice = async (id: string, size: string, cents: number) => {
    await saveConfig({
      ...pizzaConfig,
      flavors: flavors.map(f =>
        f.id === id ? { ...f, prices: { ...f.prices, [size]: cents } } : f
      ),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pizza className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-bold text-foreground/80 uppercase tracking-wider">Sabores & Preços</h2>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 bg-primary/20 text-primary px-3 py-2 rounded-xl text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" /> Novo Sabor
        </button>
      </div>

      {/* Size Selection */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-foreground/70 uppercase">Tamanhos disponíveis</h3>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_SIZES.map(size => {
            const active = sizes.includes(size);
            return (
              <button
                key={size}
                onClick={() => toggleSize(size)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  active
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">Selecione os tamanhos que sua pizzaria oferece</p>
      </div>

      {/* Max flavors per pizza */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-foreground/70 uppercase">Sabores por pizza</h3>
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
            onClick={() => saveSettingField({ pizza_half_enabled: !halfEnabled })}
            className={`w-12 h-6 rounded-full transition-colors relative ${halfEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${halfEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>

        {halfEnabled && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-foreground/70">Como calcular o valor da pizza com vários sabores?</p>
            {([
              { id: "maior", title: "💰 Maior valor", desc: "Cobra o preço do sabor mais caro." },
              { id: "media", title: "📊 Média dos valores", desc: "Cobra a média dos sabores." },
              { id: "soma",  title: "➗ Soma dividida", desc: "Cobra a fração de cada sabor (igual à média)." },
            ] as const).map(opt => {
              const active = priceMode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => saveSettingField({ pizza_price_mode: opt.id })}
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

      {/* Add Flavor Form */}
      {showAddForm && (
        <div className="bg-card border border-primary/20 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-primary">Novo Sabor</h3>
          <input
            type="text"
            placeholder="Nome do sabor (ex: Calabresa)"
            value={newFlavorName}
            onChange={(e) => setNewFlavorName(e.target.value)}
            className="w-full bg-muted text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
            autoFocus
          />
          {sizes.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {sizes.map(size => (
                <div key={size} className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">{size}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={newPrices[size] ? formatBRL(newPrices[size]) : ""}
                    onChange={(e) => setNewPrices({ ...newPrices, [size]: parseCurrencyInput(e.target.value) })}
                    className="w-full bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={addFlavor} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-bold">
              <Save className="h-4 w-4 inline mr-1" /> Salvar
            </button>
            <button onClick={() => { setShowAddForm(false); setNewFlavorName(""); setNewPrices({}); }} className="px-4 py-2 text-muted-foreground text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Flavor List */}
      {flavors.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center space-y-2">
          <Pizza className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground font-medium">Nenhum sabor cadastrado</p>
          <p className="text-xs text-muted-foreground">Adicione sabores para poder criar pizzas no cardápio</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Table header */}
          <div className="grid gap-2 px-3 py-2" style={{ gridTemplateColumns: `1fr repeat(${sizes.length}, 80px) 60px` }}>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Sabor</span>
            {sizes.map(s => (
              <span key={s} className="text-[10px] font-bold text-muted-foreground uppercase text-center">{s}</span>
            ))}
            <span />
          </div>

          {flavors.map(flavor => (
            <div
              key={flavor.id}
              className="bg-card border border-border rounded-xl grid gap-2 px-3 py-2.5 items-center"
              style={{ gridTemplateColumns: `1fr repeat(${sizes.length}, 80px) 60px` }}
            >
              {/* Name */}
              {editingId === flavor.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && updateFlavorName(flavor.id, editName)}
                    className="flex-1 bg-muted text-foreground px-2 py-1 rounded text-xs border border-primary focus:outline-none"
                    autoFocus
                  />
                  <button onClick={() => updateFlavorName(flavor.id, editName)} className="text-primary">
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">{flavor.name}</span>
                  <button onClick={() => { setEditingId(flavor.id); setEditName(flavor.name); }} className="text-muted-foreground hover:text-foreground">
                    <Edit2 className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Prices per size */}
              {sizes.map(size => (
                <input
                  key={size}
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={flavor.prices[size] ? formatBRL(flavor.prices[size]) : ""}
                  onChange={(e) => {
                    const cents = parseCurrencyInput(e.target.value);
                    // Optimistic local update then save
                    updateFlavorPrice(flavor.id, size, cents);
                  }}
                  className="w-full bg-muted text-foreground px-2 py-1 rounded text-xs border border-border focus:border-primary focus:outline-none text-center"
                />
              ))}

              {/* Delete */}
              <button onClick={() => deleteFlavor(flavor.id)} className="text-red-400 hover:text-red-300 justify-self-center">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        💡 Configure os sabores aqui e depois crie os produtos no Cardápio selecionando os sabores
      </p>
    </div>
  );
};

export default PizzaFlavorManager;
