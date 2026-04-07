import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Pizza, Beef, Pill, IceCream, Wine, AlertTriangle, Check } from "lucide-react";

// Scroll input into view when keyboard opens on mobile
const scrollOnFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  setTimeout(() => {
    e.target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 300);
};

type StoreCategory = string;

interface CategoryProductFieldsProps {
  category: StoreCategory;
  metadata: Record<string, any>;
  onChange: (metadata: Record<string, any>) => void;
  storeId?: string;
}

const CategoryProductFields = ({ category, metadata, onChange, storeId }: CategoryProductFieldsProps) => {
  const set = (key: string, value: any) => onChange({ ...metadata, [key]: value });

  const addToList = (key: string, value: string) => {
    if (!value.trim()) return;
    const list = metadata[key] || [];
    set(key, [...list, value.trim()]);
  };

  const removeFromList = (key: string, index: number) => {
    const list = [...(metadata[key] || [])];
    list.splice(index, 1);
    set(key, list);
  };

  const [tempInputs, setTempInputs] = useState<Record<string, string>>({});

  // Plain render helpers (NOT component declarations) to avoid remounting inputs
  const renderListField = (label: string, fieldKey: string, placeholder: string) => (
    <div className="space-y-1.5" key={fieldKey}>
      <label className="text-xs font-bold text-foreground/70">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {(metadata[fieldKey] || []).map((item: string, i: number) => (
          <span key={i} className="bg-primary/15 text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium">
            {item}
            <button onClick={() => removeFromList(fieldKey, i)} className="hover:text-red-400">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          placeholder={placeholder}
          value={tempInputs[fieldKey] || ""}
          onChange={(e) => setTempInputs({ ...tempInputs, [fieldKey]: e.target.value })}
          onFocus={scrollOnFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addToList(fieldKey, tempInputs[fieldKey] || "");
              setTempInputs({ ...tempInputs, [fieldKey]: "" });
            }
          }}
          className="flex-1 bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none"
        />
        <button
          onClick={() => {
            addToList(fieldKey, tempInputs[fieldKey] || "");
            setTempInputs({ ...tempInputs, [fieldKey]: "" });
          }}
          className="bg-primary/20 text-primary px-2.5 py-1.5 rounded-lg text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  const renderToggle = (label: string, fieldKey: string) => (
    <div className="flex items-center justify-between" key={fieldKey}>
      <label className="text-xs font-bold text-foreground/70">{label}</label>
      <button
        onClick={() => set(fieldKey, !metadata[fieldKey])}
        className={`w-10 h-5 rounded-full transition-colors relative ${metadata[fieldKey] ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${metadata[fieldKey] ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );

  const renderTextField = (label: string, fieldKey: string, placeholder: string) => (
    <div className="space-y-1" key={fieldKey}>
      <label className="text-xs font-bold text-foreground/70">{label}</label>
      <input
        type="text"
        value={metadata[fieldKey] || ""}
        onChange={(e) => set(fieldKey, e.target.value)}
        onFocus={scrollOnFocus}
        placeholder={placeholder}
        className="w-full bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none"
      />
    </div>
  );

  const renderSelect = (label: string, fieldKey: string, options: string[]) => (
    <div className="space-y-1" key={fieldKey}>
      <label className="text-xs font-bold text-foreground/70">{label}</label>
      <select
        value={metadata[fieldKey] || ""}
        onChange={(e) => set(fieldKey, e.target.value)}
        onFocus={scrollOnFocus}
        className="w-full bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none"
      >
        <option value="">Selecione...</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );

  const formatCurrency = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    const num = parseInt(digits, 10) / 100;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const parseCurrency = (formatted: string): number => {
    const digits = formatted.replace(/\D/g, "");
    if (!digits) return 0;
    return parseInt(digits, 10) / 100;
  };

  const renderPizzaSizes = () => (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-foreground/70">🍕 Tamanhos e Preços</label>
      {["Brotinho", "Média", "Grande", "Família"].map(size => (
        <div key={size} className="flex items-center gap-2">
          <label className="flex items-center gap-2 min-w-[100px]">
            <input
              type="checkbox"
              checked={(metadata.sizes || []).some((s: any) => s.name === size)}
              onChange={(e) => {
                const sizes = metadata.sizes || [];
                if (e.target.checked) {
                  set("sizes", [...sizes, { name: size, price: 0 }]);
                } else {
                  set("sizes", sizes.filter((s: any) => s.name !== size));
                }
              }}
              className="rounded border-border"
            />
            <span className="text-xs text-foreground">{size}</span>
          </label>
          {(metadata.sizes || []).some((s: any) => s.name === size) && (
            <input
              type="text"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={(() => {
                const price = (metadata.sizes || []).find((s: any) => s.name === size)?.price || 0;
                return price > 0 ? formatCurrency(String(Math.round(price * 100))) : "";
              })()}
              onChange={(e) => {
                const parsed = parseCurrency(e.target.value);
                const sizes = (metadata.sizes || []).map((s: any) =>
                  s.name === size ? { ...s, price: parsed } : s
                );
                set("sizes", sizes);
              }}
              className="w-24 bg-muted text-foreground px-2 py-1 rounded text-xs border border-border focus:outline-none"
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderBeverageFields = () => (
    <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 space-y-3 mt-2">
      <div className="flex items-center gap-2 text-accent-foreground text-xs font-bold">
        <Wine className="h-4 w-4" /> 🥤 Campos de Bebida
      </div>
      {renderTextField("Volume", "drink_volume", "Ex: 350ml, 500ml, 1L...")}
      {renderSelect("Tipo de Bebida", "drink_type", ["Refrigerante", "Suco", "Água", "Cerveja", "Vinho", "Destilado", "Energético", "Milkshake", "Outro"])}
      {renderToggle("Servir gelado?", "serve_cold")}
    </div>
  );

  const withBeverageToggle = (categoryFields: React.ReactNode) => (
    <>
      <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-2">
        {renderToggle("🥤 Este produto é uma bebida?", "is_beverage")}
        {metadata.is_beverage && renderBeverageFields()}
      </div>
      {!metadata.is_beverage && categoryFields}
    </>
  );

  switch (category) {
    case "pizzas":
      return withBeverageToggle(
        <PizzaFlavorSelector storeId={storeId} metadata={metadata} onChange={onChange} />
      );

    case "lanches":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            <Beef className="h-4 w-4" /> Campos de Lanche
          </div>
          {renderListField("Ponto da Carne", "meat_doneness", "Ex: Mal passado, Ao ponto...")}
          {renderToggle("Produto é um combo?", "is_combo")}
          {metadata.is_combo && renderListField("Itens do Combo", "combo_items", "Ex: Batata G, Refri 500ml...")}
        </div>
      );

    case "farmacias":
      return (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            <Pill className="h-4 w-4" /> Campos de Farmácia
          </div>
          {renderToggle("Receita Obrigatória?", "requires_prescription")}
          {renderTextField("Miligramagem / Dosagem", "dosage", "Ex: 500mg, 20ml...")}
          {renderTextField("Laboratório / Fabricante", "manufacturer", "Ex: EMS, Medley...")}
          {renderTextField("Princípio Ativo", "active_ingredient", "Ex: Paracetamol...")}
          {renderSelect("Tipo de Produto", "pharma_type", ["Medicamento", "Cosmético", "Higiene", "Suplemento", "Outros"])}
          {renderToggle("Produto Genérico?", "is_generic")}
        </div>
      );

    case "sobremesas":
    case "docerias":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            <IceCream className="h-4 w-4" /> Campos de Sorveteria / Doces
          </div>
          {renderListField("Sabores Disponíveis", "flavors", "Ex: Chocolate, Baunilha...")}
          {renderTextField("Tamanho / Peso", "size_weight", "Ex: 300ml, 500g...")}
        </div>
      );

    case "japonesa":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            🍣 Campos de Comida Japonesa
          </div>
          {renderTextField("Quantidade de Peças", "pieces_count", "Ex: 8, 16, 30...")}
          {renderListField("Proteínas", "proteins", "Ex: Salmão, Atum...")}
          {renderToggle("Serve para compartilhar?", "shareable")}
        </div>
      );

    case "cafeteria":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            ☕ Campos de Cafeteria
          </div>
          {renderListField("Tamanhos", "drink_sizes", "Ex: P, M, G...")}
          {renderListField("Tipos de Leite", "milk_options", "Ex: Integral, Desnatado, Vegetal...")}
          {renderToggle("Pode ser gelado?", "can_be_iced")}
        </div>
      );

    case "churrasco":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            🥩 Campos de Churrasco
          </div>
          {renderListField("Ponto da Carne", "meat_doneness", "Ex: Mal passado, Ao ponto...")}
          {renderTextField("Peso / Porção", "portion_weight", "Ex: 300g, 500g...")}
          {renderToggle("Serve para compartilhar?", "shareable")}
        </div>
      );

    case "adegas":
      return (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            🍷 Campos de Adega
          </div>
          {renderTextField("Volume", "volume", "Ex: 350ml, 750ml, 1L...")}
          {renderTextField("Teor Alcoólico", "alcohol_content", "Ex: 4.5%, 13%...")}
          {renderSelect("Tipo", "drink_type", ["Cerveja", "Vinho", "Destilado", "Refrigerante", "Água", "Suco", "Energético", "Outro"])}
          {renderToggle("Servir gelado?", "serve_cold")}
        </div>
      );

    default:
      return null;
  }
};

// Pizza Flavor Selector - uses pre-configured flavors from store settings
const PizzaFlavorSelector = ({
  storeId,
  metadata,
  onChange,
}: {
  storeId?: string;
  metadata: Record<string, any>;
  onChange: (m: Record<string, any>) => void;
}) => {
  const { data: store } = useQuery({
    queryKey: ["store-pizza-config", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("settings").eq("id", storeId!).single();
      return data;
    },
    enabled: !!storeId,
  });

  const settings = (store?.settings || {}) as Record<string, any>;
  const pizzaConfig = settings.pizza_config || { sizes: [], flavors: [] };
  const availableFlavors: Array<{ id: string; name: string; prices: Record<string, number> }> = pizzaConfig.flavors || [];
  const availableSizes: string[] = pizzaConfig.sizes || [];

  if (availableFlavors.length === 0) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-600">Configure os sabores primeiro</p>
          <p className="text-xs text-muted-foreground">Vá na aba "Sabores" no menu lateral para cadastrar sabores e preços antes de criar pizzas.</p>
        </div>
      </div>
    );
  }

  const selectedFlavors: string[] = metadata.selected_flavors || [];

  const toggleFlavor = (flavorId: string) => {
    const current = [...selectedFlavors];
    const idx = current.indexOf(flavorId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(flavorId);
    }
    // Derive price from first selected flavor's lowest size price
    const selectedFlavorData = availableFlavors.filter(f => current.includes(f.id));
    let minPrice = 0;
    if (selectedFlavorData.length > 0) {
      const allPrices = selectedFlavorData.flatMap(f => Object.values(f.prices).filter(p => p > 0));
      minPrice = allPrices.length > 0 ? Math.min(...allPrices) / 100 : 0;
    }
    // Build sizes array from selected flavors for compatibility
    const sizesWithPrices = availableSizes.map(size => {
      const maxPrice = Math.max(...selectedFlavorData.map(f => (f.prices[size] || 0)));
      return { name: size, price: maxPrice / 100 };
    }).filter(s => s.price > 0);

    onChange({
      ...metadata,
      selected_flavors: current,
      sizes: sizesWithPrices,
      _derived_price: minPrice,
    });
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
      <div className="flex items-center gap-2 text-primary text-xs font-bold">
        <Pizza className="h-4 w-4" /> Selecione os Sabores
      </div>
      <p className="text-[10px] text-muted-foreground">Marque os sabores disponíveis para esta pizza. Os preços vêm da aba Sabores.</p>
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {availableFlavors.map(flavor => {
          const isSelected = selectedFlavors.includes(flavor.id);
          const priceDisplay = availableSizes
            .filter(s => flavor.prices[s] && flavor.prices[s] > 0)
            .map(s => `${s}: ${(flavor.prices[s] / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`)
            .join(" · ");
          return (
            <button
              key={flavor.id}
              type="button"
              onClick={() => toggleFlavor(flavor.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                isSelected
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-muted border border-border hover:border-primary/20"
              }`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                isSelected ? "bg-primary border-primary" : "border-border"
              }`}>
                {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{flavor.name}</p>
                {priceDisplay && <p className="text-[10px] text-muted-foreground">{priceDisplay}</p>}
              </div>
            </button>
          );
        })}
      </div>
      {selectedFlavors.length > 0 && (
        <p className="text-xs text-primary font-medium">{selectedFlavors.length} sabor(es) selecionado(s)</p>
      )}
    </div>
  );
};

export default CategoryProductFields;
