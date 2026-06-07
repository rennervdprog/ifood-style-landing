import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useBRLInput, formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CategoryProductFieldsProps {
  category: string;
  metadata: Record<string, any>;
  onChange: (metadata: Record<string, any>) => void;
  onNameChange?: (name: string) => void; // opcional — usado pelos templates de adega
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

interface PizzaSize { name: string; price: number }

const BRLPriceRowInput = ({ value, onCommit }: { value: number; onCommit: (v: number) => void }) => {
  const [display, setDisplay] = useState(value > 0 ? formatBRLDisplay(value) : "");
  const [isEditing, setIsEditing] = useState(false);

  // Sincroniza apenas quando não está editando para evitar pular o cursor
  useEffect(() => {
    if (!isEditing) {
      setDisplay(value > 0 ? formatBRLDisplay(value) : "");
    }
  }, [value, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Atualiza apenas o display local enquanto digita — NÃO propaga ao pai
    // (commit acontece no blur). Isso evita re-render em cascata do form
    // pai a cada tecla, que fecha o teclado no mobile.
    if (!raw.replace(/\D/g, "")) {
      setDisplay("");
      return;
    }
    const n = parseBRLCentsInput(raw);
    setDisplay(formatBRLDisplay(n));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onFocus={() => setIsEditing(true)}
      onBlur={() => {
        setIsEditing(false);
        const n = display ? parseBRLCentsInput(display) : 0;
        setDisplay(n > 0 ? formatBRLDisplay(n) : "");
        if (n !== value) onCommit(n);
      }}
      placeholder="0,00"
      className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none"
    />
  );
};

const PizzaSizesField = ({
  metadata,
  onChange,
}: {
  metadata: Record<string, any>;
  onChange: (metadata: Record<string, any>) => void;
}) => {
  const sizes: PizzaSize[] = Array.isArray(metadata.sizes) ? metadata.sizes : [];
  const [name, setName] = useState("");
  const price = useBRLInput(0);

  const update = (next: PizzaSize[]) => onChange({ ...metadata, sizes: next });

  const add = () => {
    const n = name.trim();
    const p = price.value;
    if (!n || !Number.isFinite(p) || p < 0) return;
    if (sizes.some(s => s.name.toLowerCase() === n.toLowerCase())) return;
    update([...sizes, { name: n, price: p }]);
    setName(""); price.reset(0);
  };

  const remove = (i: number) => update(sizes.filter((_, idx) => idx !== i));
  const editPrice = (i: number, p: number) => {
    if (!Number.isFinite(p) || p < 0) return;
    const next = [...sizes];
    next[i] = { ...next[i], price: p };
    update(next);
  };

  const presets = ["P", "M", "G", "Família", "Broto"].filter(p => !sizes.some(s => s.name === p));

  return (
    <div className="space-y-2">
      {sizes.length > 0 && (
        <div className="space-y-2">
          {sizes.map((s, i) => (
            <div key={`${s.name}-${i}`} className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card p-2 sm:p-3 shadow-sm transition-all hover:border-primary/30">
              <div className="flex h-8 w-10 sm:w-12 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-black uppercase tracking-wider text-primary flex-shrink-0">
                {s.name}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 rounded-lg border border-border bg-muted/50 px-2 sm:px-3 py-2 sm:py-2.5 focus-within:border-primary focus-within:bg-background transition-colors">
                <span className="text-xs font-bold text-muted-foreground/70">R$</span>
                <BRLPriceRowInput value={s.price} onCommit={(v) => editPrice(i, v)} />
              </div>
              <button 
                type="button" 
                onClick={() => remove(i)} 
                className="flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                aria-label="Remover tamanho"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setName(p)}
              className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted hover:border-primary/30"
            >
              + {p}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <input
          type="text"
          placeholder="Tamanho (ex: P, M, G)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-[120px] bg-muted text-foreground px-2.5 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none"
        />
        <div className="w-24 sm:w-28 flex items-center gap-1 bg-muted text-foreground px-2 py-1.5 rounded-lg text-xs border border-border focus-within:border-primary">
          <span className="text-muted-foreground">R$</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0,00"
            value={price.display}
            onChange={(e) => price.onChange(e.target.value)}
            onBlur={() => { if (price.value > 0) price.reset(price.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            className="flex-1 min-w-0 bg-transparent focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={add}
          className="bg-primary/20 text-primary px-2.5 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Se nenhum tamanho for cadastrado, o cliente verá apenas o preço base do produto.
      </p>
    </div>
  );
};

const CategoryProductFields = ({ category, metadata, onChange, onNameChange, storeId }: CategoryProductFieldsProps) => {
  const set = (key: string, value: any) => onChange({ ...metadata, [key]: value });

  // Lê configuração de "tamanho único" da loja (afeta apenas pizzaria)
  const { data: storeSettingsRow } = useQuery({
    queryKey: ["store-settings-for-category", storeId],
    enabled: !!storeId && category === "pizzas",
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("settings").eq("id", storeId!).single();
      return data;
    },
  });
  const pizzaSingleSize: boolean = !!(storeSettingsRow?.settings as any)?.pizza_single_size;

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

  const categoryFieldsMap: Record<string, React.ReactNode> = {
    pizzas: (
      <FieldBox emoji="🍕" title="Tamanhos da Pizza">
        {pizzaSingleSize ? (
          <p className="text-[11px] text-muted-foreground -mt-1">
            Sua pizzaria está configurada para <b>um único tamanho</b>. O cliente verá apenas o preço base do produto.
            Para vender pizza em vários tamanhos, desative essa opção em <b>Bordas/Sabores → Regras de Combinação</b>.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Defina os tamanhos disponíveis (ex: P, M, G, Família) com o preço de cada um.
              Aparecem para o cliente ao escolher 1 sabor e no modal meio-a-meio.
            </p>
            <PizzaSizesField metadata={metadata} onChange={onChange} />
          </>
        )}
      </FieldBox>
    ),
    esfihas: (
      <FieldBox emoji="🫓" title="Detalhes da Esfiha">
        {renderListField("Tipo de massa", "dough_types", "Ex: Aberta, Fechada...")}
        {renderTextField("Quantidade (pacote)", "pack_quantity", "Ex: 10 unidades, 20 unidades...")}
        {renderToggle("Serve p/ compartilhar?", "shareable")}
        {renderToggle("Produto é um combo?", "is_combo")}
        {metadata.is_combo && renderListField("Itens do Combo", "combo_items", "Ex: 10 esfihas + Refri...")}
      </FieldBox>
    ),
    lanches: (
      <FieldBox emoji="🍔" title="Detalhes do Lanche">
        {renderListField("Tipos de pão disponíveis", "bread_types", "Ex: Brioche, Tradicional, Australiano, Ciabatta...")}
        {renderToggle("Produto é um combo?", "is_combo")}
        {metadata.is_combo && renderListField("Itens do Combo", "combo_items", "Ex: Hambúrguer, Batata M, Refri 500ml...")}
        {renderTextField("Peso (opcional)", "patty_weight", "Ex: 150g, 200g...")}
      </FieldBox>
    ),
    farmacias: (
      <FieldBox emoji="💊" title="Detalhes do Produto">
        {renderToggle("Receita obrigatória?", "requires_prescription")}
        {renderTextField("Dosagem / Volume", "dosage", "Ex: 500mg, 200ml...")}
        {renderTextField("Fabricante / Marca", "manufacturer", "Ex: EMS, Medley, Nivea...")}
        {renderTextField("Qtd na embalagem", "pack_quantity", "Ex: 20 comprimidos, 100ml...")}
        {renderToggle("Produto genérico?", "is_generic")}
      </FieldBox>
    ),
    sobremesas: (
      <FieldBox emoji="🍰" title="Detalhes do Doce">
        {renderListField("Sabores disponíveis", "flavors", "Ex: Chocolate, Morango, Baunilha...")}
        {renderTextField("Tamanho / Peso", "size_weight", "Ex: 300g, 500ml, fatia...")}
        {renderToggle("Vende por unidade?", "sells_unit")}
      </FieldBox>
    ),
    japonesa: (
      <FieldBox emoji="🍣" title="Detalhes do Prato">
        {renderTextField("Quantidade de peças", "pieces_count", "Ex: 4, 8, 10, 20...")}
        {renderListField("Proteínas", "proteins", "Ex: Salmão, Atum, Camarão...")}
        {renderToggle("Serve p/ compartilhar?", "shareable")}
      </FieldBox>
    ),
    cafeteria: (
      <FieldBox emoji="☕" title="Detalhes do Produto">
        {renderListField("Sabores disponíveis", "flavors", "Ex: Chocolate, Red Velvet...")}
        {renderToggle("Pode aquecer?", "can_heat")}
      </FieldBox>
    ),
    churrasco: (
      <FieldBox emoji="🥩" title="Detalhes do Churrasco">
        {renderTextField("Peso / Porção", "portion_weight", "Ex: 300g, 500g, 1kg...")}
        {renderListField("Ponto da carne", "meat_doneness", "Ex: Mal passado, Ao ponto...")}
        {metadata.is_combo && renderListField("Itens do Kit", "combo_items", "Ex: 500g Picanha, Farofa...")}
        {renderToggle("Produto é um combo/kit?", "is_combo")}
        {renderToggle("Serve p/ compartilhar?", "shareable")}
      </FieldBox>
    ),
    adegas: (
      <FieldBox emoji="🍷" title="Detalhes do Produto">

        {/* ── Templates rápidos ─────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-foreground/70">⚡ Preencher rapidamente</label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "🍺 Heineken 600ml",  name: "Heineken 600ml",   data: { drink_type: "Cerveja",     packaging: "Garrafa",   volume: "600ml", alcohol_content: "5%",  brand: "Heineken",  serve_cold: true, temp_option: "cold" } },
              { label: "🍺 Heineken Lata",    name: "Heineken Lata",    data: { drink_type: "Cerveja",     packaging: "Lata",      volume: "350ml", alcohol_content: "5%",  brand: "Heineken",  serve_cold: true, temp_option: "cold" } },
              { label: "🍺 Budweiser Lata",   name: "Budweiser Lata",   data: { drink_type: "Cerveja",     packaging: "Lata",      volume: "350ml", alcohol_content: "5%",  brand: "Budweiser", serve_cold: true, temp_option: "cold" } },
              { label: "🍺 Brahma Lata",      name: "Brahma Lata",      data: { drink_type: "Cerveja",     packaging: "Lata",      volume: "350ml", alcohol_content: "4.8%",brand: "Brahma",    serve_cold: true, temp_option: "cold" } },
              { label: "🍺 Corona Long Neck", name: "Corona Long Neck", data: { drink_type: "Cerveja",     packaging: "Long Neck", volume: "330ml", alcohol_content: "4.5%",brand: "Corona",    serve_cold: true, temp_option: "cold" } },
              { label: "🍺 Skol Lata",        name: "Skol Lata",        data: { drink_type: "Cerveja",     packaging: "Lata",      volume: "350ml", alcohol_content: "4.7%",brand: "Skol",      serve_cold: true, temp_option: "cold" } },
              { label: "🍷 Vinho Tinto",      name: "Vinho Tinto",      data: { drink_type: "Vinho",       packaging: "Garrafa",   volume: "750ml", alcohol_content: "13%", brand: "",          serve_cold: false, temp_option: "ambient" } },
              { label: "🥂 Vinho Branco",     name: "Vinho Branco",     data: { drink_type: "Vinho",       packaging: "Garrafa",   volume: "750ml", alcohol_content: "12%", brand: "",          serve_cold: true, temp_option: "cold" } },
              { label: "🥃 Vodka",            name: "Vodka",            data: { drink_type: "Destilado",   packaging: "Garrafa",   volume: "750ml", alcohol_content: "40%", brand: "",          serve_cold: false, temp_option: "ambient" } },
              { label: "🥃 Whisky",           name: "Whisky",           data: { drink_type: "Destilado",   packaging: "Garrafa",   volume: "750ml", alcohol_content: "40%", brand: "",          serve_cold: false, temp_option: "ambient" } },
              { label: "⚡ Red Bull",          name: "Red Bull 250ml",   data: { drink_type: "Energético",  packaging: "Lata",      volume: "250ml", alcohol_content: "",    brand: "Red Bull",  serve_cold: true, temp_option: "cold" } },
              { label: "⚡ Monster",           name: "Monster 473ml",    data: { drink_type: "Energético",  packaging: "Lata",      volume: "473ml", alcohol_content: "",    brand: "Monster",   serve_cold: true, temp_option: "cold" } },
              { label: "🥤 Coca-Cola Lata",   name: "Coca-Cola Lata",   data: { drink_type: "Refrigerante",packaging: "Lata",      volume: "350ml", alcohol_content: "",    brand: "Coca-Cola", serve_cold: true, temp_option: "cold" } },
              { label: "💧 Água Mineral",     name: "Água Mineral",     data: { drink_type: "Água",        packaging: "Garrafa",   volume: "500ml", alcohol_content: "",    brand: "",          serve_cold: true, temp_option: "cold" } },
            ].map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  onChange({ ...metadata, ...t.data });
                  if (onNameChange && t.name) onNameChange(t.name);
                }}
                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted hover:border-primary/30 active:scale-95 transition-all whitespace-nowrap"
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Clique para preencher os campos automaticamente. Ajuste o preço após.</p>
        </div>

        <div className="border-t border-border/40 pt-3 space-y-3">
          {/* Tipo de bebida */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground/70">Tipo de Bebida</label>
            <div className="flex flex-wrap gap-1.5">
              {["Cerveja","Vinho","Destilado","Energético","Refrigerante","Água","Outro"].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("drink_type", t)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                    metadata.drink_type === t
                      ? "bg-primary/10 border-primary/30 text-primary font-bold"
                      : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "Cerveja" ? "🍺" : t === "Vinho" ? "🍷" : t === "Destilado" ? "🥃" :
                   t === "Energético" ? "⚡" : t === "Refrigerante" ? "🥤" : t === "Água" ? "💧" : "🧃"} {t}
                </button>
              ))}
            </div>
          </div>

          {/* Embalagem */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground/70">Embalagem</label>
            <div className="flex flex-wrap gap-1.5">
              {["Lata","Long Neck","Garrafa","Pack","Caixinha","Barril","Outro"].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("packaging", p)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                    metadata.packaging === p
                      ? "bg-primary/10 border-primary/30 text-primary font-bold"
                      : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Pack — quantidade */}
          {(metadata.packaging === "Pack") && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/70">Quantidade no Pack</label>
              <div className="flex flex-wrap gap-1.5">
                {["6","8","12","15","24","30"].map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => set("pack_qty", q)}
                    className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                      metadata.pack_qty === q
                        ? "bg-primary/10 border-primary/30 text-primary font-bold"
                        : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {q} un
                  </button>
                ))}
              </div>
            </div>
          )}

          {renderTextField("Volume", "volume", "Ex: 350ml, 600ml, 1L...")}
          {renderTextField("Marca", "brand", "Ex: Heineken, Absolut, Velho Barreiro...")}
          {metadata.drink_type && !["Água","Refrigerante","Energético"].includes(metadata.drink_type) &&
            renderTextField("Teor alcoólico", "alcohol_content", "Ex: 4.5%, 13%, 40%...")}
          {/* Temperatura de serviço */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground/70">Temperatura de serviço</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: "cold",    label: "❄️ Gelado",         desc: "Sempre gelado" },
                { value: "ambient", label: "🌡️ Temp. ambiente", desc: "Natural/sem gelo" },
                { value: "both",    label: "❄️🔥 Os dois",       desc: "Cliente escolhe" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ ...metadata,
                    temp_option: opt.value,
                    serve_cold: opt.value === "cold" || opt.value === "both",
                  })}
                  className={`flex-1 min-w-[90px] text-xs px-2.5 py-2 rounded-xl border transition-all text-center ${
                    metadata.temp_option === opt.value ||
                    (!metadata.temp_option && opt.value === "cold" && metadata.serve_cold)
                      ? "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-400 font-bold"
                      : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className="text-[9px] opacity-60 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </FieldBox>
    ),
    saudavel: (
      <FieldBox emoji="🥗" title="Detalhes do Produto">
        {renderTextField("Peso / Tamanho", "size_weight", "Ex: 400g, 500ml...")}
        {renderTextField("Calorias", "calories", "Ex: 350 kcal")}
        {renderTextField("Proteínas (g)", "protein_grams", "Ex: 35g")}
        {renderTextField("Carboidratos (g)", "carbs_grams", "Ex: 40g")}
        {renderToggle("Vegano?", "is_vegan")}
        {renderToggle("Vegetariano?", "is_vegetarian")}
        {renderToggle("Sem glúten?", "is_gluten_free")}
        {renderToggle("Sem lactose?", "is_lactose_free")}
        {renderToggle("Low carb?", "is_low_carb")}
      </FieldBox>
    ),
    restaurante: (
      <FieldBox emoji="🍽️" title="Detalhes do Prato">
        {renderTextField("Porção / Tamanho", "portion_size", "Ex: Individual, Família, 500g...")}
        {renderTextField("Acompanhamentos inclusos", "sides", "Ex: Arroz, feijão, salada...")}
        {renderToggle("Serve p/ compartilhar?", "shareable")}
        {renderToggle("Sem glúten?", "is_gluten_free")}
        {renderToggle("Sem lactose?", "is_lactose_free")}
        {renderToggle("Produto é um combo/kit?", "is_combo")}
        {metadata.is_combo && renderListField("Itens do Combo", "combo_items", "Ex: Prato, Suco, Sobremesa...")}
      </FieldBox>
    ),
  };

  // docerias usa os mesmos campos de sobremesas
  const normalizedCategory = category === "docerias" ? "sobremesas" : category;
  const categoryFields = categoryFieldsMap[normalizedCategory];

  // Adegas: tudo já é bebida — não exibir o toggle redundante
  if (category === "adegas") {
    return <>{categoryFields}</>;
  }

  // Se a categoria não estiver mapeada, ainda assim mostramos o toggle de bebida
  return renderBeverageToggle(categoryFields ?? null);
};

export default CategoryProductFields;
