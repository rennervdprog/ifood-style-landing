import { useState } from "react";
import { Plus, X, Pizza, Beef, Pill, IceCream, Wine } from "lucide-react";

type StoreCategory = string;

interface CategoryProductFieldsProps {
  category: StoreCategory;
  metadata: Record<string, any>;
  onChange: (metadata: Record<string, any>) => void;
}

const CategoryProductFields = ({ category, metadata, onChange }: CategoryProductFieldsProps) => {
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

  const ListField = ({ label, fieldKey, placeholder }: { label: string; fieldKey: string; placeholder: string }) => (
    <div className="space-y-1.5">
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

  const ToggleField = ({ label, fieldKey }: { label: string; fieldKey: string }) => (
    <div className="flex items-center justify-between">
      <label className="text-xs font-bold text-foreground/70">{label}</label>
      <button
        onClick={() => set(fieldKey, !metadata[fieldKey])}
        className={`w-10 h-5 rounded-full transition-colors relative ${metadata[fieldKey] ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${metadata[fieldKey] ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );

  const TextField = ({ label, fieldKey, placeholder }: { label: string; fieldKey: string; placeholder: string }) => (
    <div className="space-y-1">
      <label className="text-xs font-bold text-foreground/70">{label}</label>
      <input
        type="text"
        value={metadata[fieldKey] || ""}
        onChange={(e) => set(fieldKey, e.target.value)}
        placeholder={placeholder}
        className="w-full bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none"
      />
    </div>
  );

  const SelectField = ({ label, fieldKey, options }: { label: string; fieldKey: string; options: string[] }) => (
    <div className="space-y-1">
      <label className="text-xs font-bold text-foreground/70">{label}</label>
      <select
        value={metadata[fieldKey] || ""}
        onChange={(e) => set(fieldKey, e.target.value)}
        className="w-full bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none"
      >
        <option value="">Selecione...</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );

  const PizzaSizeFields = () => (
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
              type="number"
              placeholder="R$"
              value={(metadata.sizes || []).find((s: any) => s.name === size)?.price || ""}
              onChange={(e) => {
                const sizes = (metadata.sizes || []).map((s: any) =>
                  s.name === size ? { ...s, price: parseFloat(e.target.value) || 0 } : s
                );
                set("sizes", sizes);
              }}
              className="w-20 bg-muted text-foreground px-2 py-1 rounded text-xs border border-border focus:outline-none"
              step="0.50"
            />
          )}
        </div>
      ))}
    </div>
  );

  // Beverage fields shared across categories
  const BeverageFields = () => (
    <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 space-y-3 mt-2">
      <div className="flex items-center gap-2 text-accent-foreground text-xs font-bold">
        <Wine className="h-4 w-4" /> 🥤 Campos de Bebida
      </div>
      <TextField label="Volume" fieldKey="drink_volume" placeholder="Ex: 350ml, 500ml, 1L..." />
      <SelectField label="Tipo de Bebida" fieldKey="drink_type" options={["Refrigerante", "Suco", "Água", "Cerveja", "Vinho", "Destilado", "Energético", "Milkshake", "Outro"]} />
      <ToggleField label="Servir gelado?" fieldKey="serve_cold" />
    </div>
  );

  // Wrap category fields + optional beverage toggle — hides category fields when beverage is on
  const withBeverageToggle = (categoryFields: React.ReactNode) => (
    <>
      <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-2">
        <ToggleField label="🥤 Este produto é uma bebida?" fieldKey="is_beverage" />
        {metadata.is_beverage && <BeverageFields />}
      </div>
      {!metadata.is_beverage && categoryFields}
    </>
  );

  switch (category) {
    case "pizzas":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            <Pizza className="h-4 w-4" /> Campos de Pizza
          </div>
          <PizzaSizeFields />
          <ToggleField label="Permite meia-meia?" fieldKey="allows_half" />
          {metadata.allows_half && (
            <TextField label="Máx. sabores" fieldKey="max_flavors" placeholder="2" />
          )}
          <ListField label="Sabores Disponíveis" fieldKey="flavors" placeholder="Ex: Calabresa, Margherita..." />
        </div>
      );

    case "lanches":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            <Beef className="h-4 w-4" /> Campos de Lanche
          </div>
          <ListField label="Ponto da Carne" fieldKey="meat_doneness" placeholder="Ex: Mal passado, Ao ponto..." />
          <ToggleField label="Produto é um combo?" fieldKey="is_combo" />
          {metadata.is_combo && (
            <ListField label="Itens do Combo" fieldKey="combo_items" placeholder="Ex: Batata G, Refri 500ml..." />
          )}
        </div>
      );

    case "farmacias":
      return (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            <Pill className="h-4 w-4" /> Campos de Farmácia
          </div>
          <ToggleField label="Receita Obrigatória?" fieldKey="requires_prescription" />
          <TextField label="Miligramagem / Dosagem" fieldKey="dosage" placeholder="Ex: 500mg, 20ml..." />
          <TextField label="Laboratório / Fabricante" fieldKey="manufacturer" placeholder="Ex: EMS, Medley..." />
          <TextField label="Princípio Ativo" fieldKey="active_ingredient" placeholder="Ex: Paracetamol..." />
          <SelectField label="Tipo de Produto" fieldKey="pharma_type" options={["Medicamento", "Cosmético", "Higiene", "Suplemento", "Outros"]} />
          <ToggleField label="Produto Genérico?" fieldKey="is_generic" />
        </div>
      );

    case "sobremesas":
    case "docerias":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            <IceCream className="h-4 w-4" /> Campos de Sorveteria / Doces
          </div>
          <ListField label="Sabores Disponíveis" fieldKey="flavors" placeholder="Ex: Chocolate, Baunilha..." />
          <TextField label="Tamanho / Peso" fieldKey="size_weight" placeholder="Ex: 300ml, 500g..." />
        </div>
      );

    case "japonesa":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            🍣 Campos de Comida Japonesa
          </div>
          <TextField label="Quantidade de Peças" fieldKey="pieces_count" placeholder="Ex: 8, 16, 30..." />
          <ListField label="Proteínas" fieldKey="proteins" placeholder="Ex: Salmão, Atum..." />
          <ToggleField label="Serve para compartilhar?" fieldKey="shareable" />
        </div>
      );

    case "cafeteria":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            ☕ Campos de Cafeteria
          </div>
          <ListField label="Tamanhos" fieldKey="drink_sizes" placeholder="Ex: P, M, G..." />
          <ListField label="Tipos de Leite" fieldKey="milk_options" placeholder="Ex: Integral, Desnatado, Vegetal..." />
          <ToggleField label="Pode ser gelado?" fieldKey="can_be_iced" />
        </div>
      );

    case "churrasco":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            🥩 Campos de Churrasco
          </div>
          <ListField label="Ponto da Carne" fieldKey="meat_doneness" placeholder="Ex: Mal passado, Ao ponto..." />
          <TextField label="Peso / Porção" fieldKey="portion_weight" placeholder="Ex: 300g, 500g..." />
          <ToggleField label="Serve para compartilhar?" fieldKey="shareable" />
        </div>
      );

    case "adegas":
      return (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            🍷 Campos de Adega
          </div>
          <TextField label="Volume" fieldKey="volume" placeholder="Ex: 350ml, 750ml, 1L..." />
          <TextField label="Teor Alcoólico" fieldKey="alcohol_content" placeholder="Ex: 4.5%, 13%..." />
          <SelectField label="Tipo" fieldKey="drink_type" options={["Cerveja", "Vinho", "Destilado", "Refrigerante", "Água", "Suco", "Energético", "Outro"]} />
          <ToggleField label="Servir gelado?" fieldKey="serve_cold" />
        </div>
      );

    default:
      return null;
  }
};

export default CategoryProductFields;
