import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

interface CategoryProductFieldsProps {
  category: string;
  metadata: Record<string, any>;
  onChange: (metadata: Record<string, any>) => void;
  storeId?: string;
}

const ManagedTextField = ({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
}) => {
  const [localValue, setLocalValue] = useState(value || "");

  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-foreground/70">{label}</label>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onCommit(localValue)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit(localValue);
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        className="w-full bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none"
      />
    </div>
  );
};

const CategoryProductFields = ({ category, metadata, onChange, storeId }: CategoryProductFieldsProps) => {
  const set = (key: string, value: any) => onChange({ ...metadata, [key]: value });

  const addToList = (key: string, value: string) => {
    if (!value.trim()) return;
    set(key, [...(metadata[key] || []), value.trim()]);
  };

  const removeFromList = (key: string, index: number) => {
    const list = [...(metadata[key] || [])];
    list.splice(index, 1);
    set(key, list);
  };

  const [tempInputs, setTempInputs] = useState<Record<string, string>>({});

  const renderListField = (label: string, fieldKey: string, placeholder: string) => (
    <div className="space-y-1.5" key={fieldKey}>
      <label className="text-xs font-bold text-foreground/70">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {(metadata[fieldKey] || []).map((item: string, i: number) => (
          <span key={i} className="bg-primary/15 text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium">
            {item}
            <button onClick={() => removeFromList(fieldKey, i)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
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
          type="button"
          onClick={() => { addToList(fieldKey, tempInputs[fieldKey] || ""); setTempInputs({ ...tempInputs, [fieldKey]: "" }); }}
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
        type="button"
        onClick={() => set(fieldKey, !metadata[fieldKey])}
        className={`w-10 h-5 rounded-full transition-colors relative ${metadata[fieldKey] ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${metadata[fieldKey] ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );

  const renderTextField = (label: string, fieldKey: string, placeholder: string) => (
    <ManagedTextField
      key={fieldKey}
      label={label}
      value={metadata[fieldKey] || ""}
      placeholder={placeholder}
      onCommit={(value) => set(fieldKey, value)}
    />
  );

  const renderBeverageToggle = (categoryFields: React.ReactNode) => (
    <>
      <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-2">
        {renderToggle("🥤 Este produto é uma bebida?", "is_beverage")}
        {metadata.is_beverage && (
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 space-y-3 mt-2">
            {renderTextField("Volume", "drink_volume", "Ex: 350ml, 500ml, 1L...")}
            {renderToggle("Servir gelado?", "serve_cold")}
          </div>
        )}
      </div>
      {!metadata.is_beverage && categoryFields}
    </>
  );

  const FieldBox = ({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) => (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
      <div className="text-primary text-xs font-bold">{emoji} {title}</div>
      {children}
    </div>
  );

  switch (category) {
    case "pizzas":
      return renderBeverageToggle(<></>);

    case "lanches":
      return renderBeverageToggle(
        <FieldBox emoji="🍔" title="Detalhes do Lanche">
          {renderToggle("Produto é um combo?", "is_combo")}
          {metadata.is_combo && renderListField("Itens do Combo", "combo_items", "Ex: Hambúrguer, Batata M, Refri 500ml...")}
          {renderTextField("Peso (opcional)", "patty_weight", "Ex: 150g, 200g...")}
        </FieldBox>
      );

    case "farmacias":
      return (
        <FieldBox emoji="💊" title="Detalhes do Produto">
          {renderToggle("Receita obrigatória?", "requires_prescription")}
          {renderTextField("Dosagem / Volume", "dosage", "Ex: 500mg, 200ml...")}
          {renderTextField("Fabricante / Marca", "manufacturer", "Ex: EMS, Medley, Nivea...")}
          {renderTextField("Qtd na embalagem", "pack_quantity", "Ex: 20 comprimidos, 100ml...")}
          {renderToggle("Produto genérico?", "is_generic")}
        </FieldBox>
      );

    case "sobremesas":
    case "docerias":
      return renderBeverageToggle(
        <FieldBox emoji="🍰" title="Detalhes do Doce">
          {renderListField("Sabores disponíveis", "flavors", "Ex: Chocolate, Morango, Baunilha...")}
          {renderTextField("Tamanho / Peso", "size_weight", "Ex: 300g, 500ml, fatia...")}
          {renderToggle("Vende por unidade?", "sells_unit")}
        </FieldBox>
      );

    case "japonesa":
      return renderBeverageToggle(
        <FieldBox emoji="🍣" title="Detalhes do Prato">
          {renderTextField("Quantidade de peças", "pieces_count", "Ex: 4, 8, 10, 20...")}
          {renderListField("Proteínas", "proteins", "Ex: Salmão, Atum, Camarão...")}
          {renderToggle("Serve p/ compartilhar?", "shareable")}
        </FieldBox>
      );

    case "cafeteria":
      return renderBeverageToggle(
        <FieldBox emoji="☕" title="Detalhes do Produto">
          {renderListField("Sabores disponíveis", "flavors", "Ex: Chocolate, Red Velvet...")}
          {renderToggle("Pode aquecer?", "can_heat")}
        </FieldBox>
      );

    case "churrasco":
      return renderBeverageToggle(
        <FieldBox emoji="🥩" title="Detalhes do Churrasco">
          {renderTextField("Peso / Porção", "portion_weight", "Ex: 300g, 500g, 1kg...")}
          {renderListField("Ponto da carne", "meat_doneness", "Ex: Mal passado, Ao ponto...")}
          {metadata.is_combo && renderListField("Itens do Kit", "combo_items", "Ex: 500g Picanha, Farofa...")}
          {renderToggle("Produto é um combo/kit?", "is_combo")}
          {renderToggle("Serve p/ compartilhar?", "shareable")}
        </FieldBox>
      );

    case "adegas":
      return (
        <FieldBox emoji="🍷" title="Detalhes do Produto">
          {renderTextField("Volume", "volume", "Ex: 350ml, 750ml, 1L...")}
          {renderTextField("Marca", "brand", "Ex: Heineken, Absolut...")}
          {renderTextField("Teor alcoólico", "alcohol_content", "Ex: 4.5%, 13%, 40%...")}
          {renderToggle("Servir gelado?", "serve_cold")}
        </FieldBox>
      );

    case "saudavel":
      return renderBeverageToggle(
        <FieldBox emoji="🥗" title="Detalhes do Produto">
          {renderTextField("Calorias", "calories", "Ex: 350 kcal")}
          {renderTextField("Proteína (g)", "protein_grams", "Ex: 35g")}
          {renderTextField("Peso / Tamanho", "size_weight", "Ex: 400g, 500ml...")}
          {renderToggle("Vegano?", "is_vegan")}
          {renderToggle("Sem glúten?", "is_gluten_free")}
          {renderToggle("Sem lactose?", "is_lactose_free")}
        </FieldBox>
      );

    case "restaurante":
      return renderBeverageToggle(
        <FieldBox emoji="🍽️" title="Detalhes do Prato">
          {renderTextField("Porção / Tamanho", "portion_size", "Ex: Individual, Família, 500g...")}
          {renderToggle("Marmita?", "is_marmita")}
          {renderToggle("Serve p/ compartilhar?", "shareable")}
          {renderToggle("Produto é um combo/kit?", "is_combo")}
          {metadata.is_combo && renderListField("Itens do Combo", "combo_items", "Ex: Arroz, Feijão, Bife...")}
        </FieldBox>
      );

    default:
      return null;
  }
};

export default CategoryProductFields;
