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
            <Beef className="h-4 w-4" /> 🍔 Detalhes do Lanche
          </div>
          {renderToggle("Produto é um combo?", "is_combo")}
          {metadata.is_combo && renderListField("Itens do Combo", "combo_items", "Ex: Hambúrguer, Batata M, Refri 500ml...")}
          {renderTextField("Peso (opcional)", "patty_weight", "Ex: 150g, 200g...")}
        </div>
      );

    case "farmacias":
      return (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            <Pill className="h-4 w-4" /> 💊 Campos de Farmácia
          </div>
          {renderSelect("Tipo de Produto", "pharma_type", [
            "Medicamento Genérico",
            "Medicamento de Marca",
            "Medicamento de Referência",
            "Antigripal / Resfriado",
            "Analgésico / Anti-inflamatório",
            "Antibiótico",
            "Anti-alérgico",
            "Antiácido / Digestivo",
            "Vitamina / Suplemento",
            "Protetor Solar",
            "Shampoo / Condicionador",
            "Creme / Hidratante",
            "Desodorante",
            "Escova / Pasta de Dente",
            "Absorvente / Fralda",
            "Preservativo",
            "Curativo / Band-Aid",
            "Termômetro / Acessório",
            "Álcool / Antisséptico",
            "Colírio",
            "Pomada",
            "Spray Nasal",
            "Xarope",
            "Chá Medicinal",
            "Fitoterapia / Natural",
            "Cosmético",
            "Higiene Pessoal",
            "Outro"
          ])}
          {metadata.pharma_type === "Outro" && renderTextField("Tipo Personalizado", "pharma_custom_type", "Ex: Produto ortopédico...")}
          {(metadata.pharma_type?.includes("Medicamento") || metadata.pharma_type?.includes("Antibiótico") || metadata.pharma_type?.includes("Anti-") || metadata.pharma_type === "Analgésico / Anti-inflamatório" || metadata.pharma_type === "Antigripal / Resfriado" || metadata.pharma_type === "Colírio" || metadata.pharma_type === "Pomada" || metadata.pharma_type === "Spray Nasal" || metadata.pharma_type === "Xarope") && (
            <>
              {renderToggle("Receita Obrigatória?", "requires_prescription")}
              {renderTextField("Miligramagem / Dosagem", "dosage", "Ex: 500mg, 20ml...")}
              {renderTextField("Princípio Ativo", "active_ingredient", "Ex: Paracetamol, Ibuprofeno...")}
              {renderTextField("Laboratório / Fabricante", "manufacturer", "Ex: EMS, Medley, Eurofarma...")}
              {renderToggle("Produto Genérico?", "is_generic")}
              {renderSelect("Forma Farmacêutica", "pharma_form", ["Comprimido", "Cápsula", "Drágea", "Gotas", "Xarope", "Pomada", "Creme", "Gel", "Spray", "Solução", "Suspensão", "Supositório", "Injetável", "Outro"])}
              {renderTextField("Quantidade na Embalagem", "pack_quantity", "Ex: 20 comprimidos, 100ml...")}
            </>
          )}
          {(metadata.pharma_type === "Vitamina / Suplemento" || metadata.pharma_type === "Fitoterapia / Natural" || metadata.pharma_type === "Chá Medicinal") && (
            <>
              {renderTextField("Dosagem / Concentração", "dosage", "Ex: 1000mg, 500mg...")}
              {renderTextField("Quantidade na Embalagem", "pack_quantity", "Ex: 30 cápsulas, 60 comprimidos...")}
              {renderTextField("Fabricante", "manufacturer", "Ex: Catarinense, Herbarium...")}
            </>
          )}
          {(metadata.pharma_type === "Protetor Solar" || metadata.pharma_type === "Creme / Hidratante" || metadata.pharma_type === "Cosmético") && (
            <>
              {renderTextField("Volume / Peso", "cosmetic_volume", "Ex: 50ml, 120g...")}
              {renderTextField("FPS (se protetor solar)", "spf", "Ex: 30, 50, 70...")}
              {renderTextField("Marca", "manufacturer", "Ex: La Roche-Posay, Nivea...")}
            </>
          )}
          {(metadata.pharma_type === "Shampoo / Condicionador" || metadata.pharma_type === "Desodorante" || metadata.pharma_type === "Escova / Pasta de Dente" || metadata.pharma_type === "Higiene Pessoal") && (
            <>
              {renderTextField("Volume / Peso", "cosmetic_volume", "Ex: 200ml, 90g...")}
              {renderTextField("Marca", "manufacturer", "Ex: Dove, Colgate, Oral-B...")}
            </>
          )}
          {(metadata.pharma_type === "Absorvente / Fralda") && (
            <>
              {renderTextField("Quantidade na Embalagem", "pack_quantity", "Ex: 8 unidades, 20 fraldas...")}
              {renderSelect("Tamanho", "diaper_size", ["P", "M", "G", "XG", "XXG", "Noturno", "Único"])}
              {renderTextField("Marca", "manufacturer", "Ex: Always, Pampers, Huggies...")}
            </>
          )}
        </div>
      );

    case "sobremesas":
    case "docerias":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            <IceCream className="h-4 w-4" /> 🍰 Campos de Doces / Sobremesas
          </div>
          {renderSelect("Tipo de Produto", "dessert_type", [
            "Sorvete (casquinha)",
            "Sorvete (copo)",
            "Sorvete (pote)",
            "Açaí",
            "Picolé",
            "Milkshake",
            "Bolo (inteiro)",
            "Bolo (fatia)",
            "Torta Doce",
            "Pudim",
            "Mousse",
            "Brigadeiro",
            "Beijinho",
            "Trufa",
            "Brownie",
            "Cookie",
            "Cupcake",
            "Palha Italiana",
            "Pavê / Pavlova",
            "Churros",
            "Crepe Doce",
            "Waffle Doce",
            "Bombom / Chocolate",
            "Doce de Leite",
            "Cocada",
            "Pé de Moleque",
            "Bala / Jujuba",
            "Gelatina",
            "Creme",
            "Cheesecake",
            "Petit Gâteau",
            "Outro"
          ])}
          {metadata.dessert_type === "Outro" && renderTextField("Tipo Personalizado", "dessert_custom_type", "Ex: Rabanada, Sonho...")}
          {(metadata.dessert_type?.includes("Sorvete") || metadata.dessert_type === "Açaí" || metadata.dessert_type === "Milkshake" || metadata.dessert_type === "Picolé") && (
            <>
              {renderListField("Sabores Disponíveis", "flavors", "Ex: Chocolate, Morango, Baunilha...")}
              {renderSelect("Tamanho", "dessert_size", ["P", "M", "G", "300ml", "500ml", "750ml", "1L"])}
              {metadata.dessert_type === "Açaí" && renderListField("Acompanhamentos", "acai_toppings", "Ex: Granola, Banana, Leite em pó, Paçoca...")}
            </>
          )}
          {(metadata.dessert_type?.includes("Bolo") || metadata.dessert_type === "Torta Doce" || metadata.dessert_type === "Cheesecake" || metadata.dessert_type === "Pavê / Pavlova") && (
            <>
              {renderListField("Sabores Disponíveis", "flavors", "Ex: Chocolate, Morango, Red Velvet...")}
              {renderToggle("Vende fatia?", "sells_slice")}
              {renderToggle("Vende inteiro?", "sells_whole")}
              {renderTextField("Peso / Tamanho", "size_weight", "Ex: 1,5kg, serve 15 fatias...")}
            </>
          )}
          {(metadata.dessert_type === "Brigadeiro" || metadata.dessert_type === "Beijinho" || metadata.dessert_type === "Trufa" || metadata.dessert_type === "Bombom / Chocolate" || metadata.dessert_type === "Palha Italiana" || metadata.dessert_type === "Cocada" || metadata.dessert_type === "Pé de Moleque" || metadata.dessert_type === "Bala / Jujuba") && (
            <>
              {renderListField("Sabores Disponíveis", "flavors", "Ex: Tradicional, Gourmet, Pistache...")}
              {renderSelect("Venda por", "sell_by", ["Unidade", "Cento", "Dúzia", "Caixa", "Pacote"])}
              {renderTextField("Quantidade", "unit_quantity", "Ex: 1, 12, 100...")}
            </>
          )}
          {(metadata.dessert_type === "Pudim" || metadata.dessert_type === "Mousse" || metadata.dessert_type === "Gelatina" || metadata.dessert_type === "Creme" || metadata.dessert_type === "Petit Gâteau") && (
            <>
              {renderListField("Sabores Disponíveis", "flavors", "Ex: Leite Condensado, Chocolate, Maracujá...")}
              {renderTextField("Tamanho / Peso", "size_weight", "Ex: 200ml, 300g...")}
            </>
          )}
          {(metadata.dessert_type === "Brownie" || metadata.dessert_type === "Cookie" || metadata.dessert_type === "Cupcake" || metadata.dessert_type === "Churros" || metadata.dessert_type === "Crepe Doce" || metadata.dessert_type === "Waffle Doce") && (
            <>
              {renderListField("Sabores / Coberturas", "flavors", "Ex: Chocolate, Doce de leite, Nutella...")}
              {renderTextField("Peso / Tamanho", "size_weight", "Ex: 80g, 120g...")}
            </>
          )}
        </div>
      );

    case "japonesa":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            🍣 Campos de Comida Japonesa
          </div>
          {renderSelect("Tipo de Produto", "japanese_type", [
            "Sushi (Niguiri)",
            "Sushi (Uramaki)",
            "Sashimi",
            "Hot Roll",
            "Temaki",
            "Combinado / Combo",
            "Gunkan",
            "Harumaki (Rolinho Primavera)",
            "Guioza / Gyoza",
            "Tempurá",
            "Yakisoba",
            "Yakimeshi",
            "Lamen / Ramen",
            "Missoshiru",
            "Sunomono",
            "Shimeji",
            "Salmão Grelhado",
            "Prato Quente",
            "Sobremesa Japonesa",
            "Outro"
          ])}
          {metadata.japanese_type === "Outro" && renderTextField("Tipo Personalizado", "japanese_custom_type", "Ex: Donburi, Okonomiyaki...")}
          {(metadata.japanese_type?.includes("Sushi") || metadata.japanese_type === "Sashimi" || metadata.japanese_type === "Hot Roll" || metadata.japanese_type === "Temaki" || metadata.japanese_type === "Gunkan") && (
            <>
              {renderTextField("Quantidade de Peças", "pieces_count", "Ex: 4, 8, 10...")}
              {renderListField("Proteínas", "proteins", "Ex: Salmão, Atum, Camarão, Polvo, Kani...")}
            </>
          )}
          {metadata.japanese_type === "Combinado / Combo" && (
            <>
              {renderTextField("Quantidade Total de Peças", "pieces_count", "Ex: 20, 30, 40...")}
              {renderListField("Itens do Combo", "combo_items", "Ex: 8 Hot Roll, 4 Niguiri Salmão, 4 Uramaki...")}
              {renderToggle("Serve para compartilhar?", "shareable")}
            </>
          )}
          {(metadata.japanese_type === "Yakisoba" || metadata.japanese_type === "Yakimeshi" || metadata.japanese_type === "Lamen / Ramen") && (
            <>
              {renderListField("Proteínas", "proteins", "Ex: Frango, Carne, Camarão, Vegetariano...")}
              {renderSelect("Tamanho", "portion_size", ["P", "M", "G", "Individual", "Para 2 pessoas"])}
            </>
          )}
          {(metadata.japanese_type === "Tempurá" || metadata.japanese_type === "Harumaki (Rolinho Primavera)" || metadata.japanese_type === "Guioza / Gyoza") && (
            <>
              {renderTextField("Quantidade de Peças", "pieces_count", "Ex: 4, 6, 8...")}
              {renderListField("Recheios", "fillings", "Ex: Legumes, Camarão, Queijo...")}
            </>
          )}
          {metadata.japanese_type === "Sobremesa Japonesa" && (
            <>
              {renderListField("Sabores", "flavors", "Ex: Matcha, Morango, Red Bean...")}
            </>
          )}
          {renderToggle("Serve para compartilhar?", "shareable")}
        </div>
      );

    case "cafeteria":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            ☕ Campos de Cafeteria
          </div>
          {renderSelect("Tipo de Produto", "cafe_product_type", [
            "Café / Bebida Quente",
            "Suco / Bebida Fria",
            "Bolo / Fatia",
            "Pão de Queijo",
            "Salgado Assado",
            "Salgado Frito",
            "Croissant",
            "Cookie / Biscoito",
            "Torta (fatia)",
            "Sanduíche / Wrap",
            "Tapioca",
            "Açaí / Bowl",
            "Waffle / Panqueca",
            "Muffin / Cupcake",
            "Coxinha / Empada",
            "Pão na Chapa",
            "Omelete",
            "Granola / Iogurte",
            "Salada de Frutas",
            "Outro"
          ])}
          {metadata.cafe_product_type === "Outro" && renderTextField("Tipo Personalizado", "cafe_custom_type", "Ex: Crepe, Tapioca especial...")}
          {(metadata.cafe_product_type === "Café / Bebida Quente" || metadata.cafe_product_type === "Suco / Bebida Fria") && (
            <>
              {renderListField("Tamanhos", "drink_sizes", "Ex: P, M, G...")}
              {renderListField("Tipos de Leite", "milk_options", "Ex: Integral, Desnatado, Vegetal...")}
              {renderToggle("Pode ser gelado?", "can_be_iced")}
            </>
          )}
          {(metadata.cafe_product_type === "Bolo / Fatia" || metadata.cafe_product_type === "Torta (fatia)") && (
            <>
              {renderListField("Sabores Disponíveis", "flavors", "Ex: Chocolate, Cenoura, Red Velvet...")}
              {renderToggle("Vende fatia?", "sells_slice")}
              {renderToggle("Vende inteiro?", "sells_whole")}
            </>
          )}
          {renderToggle("Pode aquecer?", "can_heat")}
        </div>
      );

    case "churrasco":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            🥩 Campos de Churrasco
          </div>
          {renderSelect("Tipo de Produto", "churrasco_type", [
            "Picanha",
            "Costela",
            "Maminha",
            "Fraldinha",
            "Alcatra",
            "Contra-Filé",
            "Linguiça",
            "Linguiça Toscana",
            "Coração de Frango",
            "Frango (coxa/sobrecoxa)",
            "Cupim",
            "Bife de Chorizo",
            "Medalhão",
            "Espeto de Carne",
            "Espeto de Frango",
            "Espeto Misto",
            "Espeto de Queijo Coalho",
            "Costela no Bafo",
            "Porção de Carne",
            "Farofa",
            "Vinagrete",
            "Arroz / Feijão Tropeiro",
            "Mandioca Frita / Cozida",
            "Pão de Alho",
            "Salada",
            "Combo / Kit Churrasco",
            "Outro"
          ])}
          {metadata.churrasco_type === "Outro" && renderTextField("Tipo Personalizado", "churrasco_custom_type", "Ex: Cordeiro, Prime Rib...")}
          {(metadata.churrasco_type?.includes("Picanha") || metadata.churrasco_type?.includes("Costela") || metadata.churrasco_type?.includes("Maminha") || metadata.churrasco_type?.includes("Fraldinha") || metadata.churrasco_type?.includes("Alcatra") || metadata.churrasco_type?.includes("Contra-Filé") || metadata.churrasco_type?.includes("Cupim") || metadata.churrasco_type?.includes("Medalhão") || metadata.churrasco_type?.includes("Chorizo") || metadata.churrasco_type === "Porção de Carne") && (
            <>
              {renderListField("Ponto da Carne", "meat_doneness", "Ex: Mal passado, Ao ponto, Bem passado...")}
              {renderTextField("Peso / Porção", "portion_weight", "Ex: 300g, 500g, 1kg...")}
            </>
          )}
          {(metadata.churrasco_type?.includes("Espeto")) && (
            <>
              {renderTextField("Quantidade de Espetos", "skewer_count", "Ex: 1, 3, 5...")}
              {renderTextField("Peso por Espeto", "portion_weight", "Ex: 100g, 150g...")}
            </>
          )}
          {metadata.churrasco_type === "Combo / Kit Churrasco" && (
            <>
              {renderListField("Itens do Kit", "combo_items", "Ex: 500g Picanha, 300g Linguiça, Farofa, Vinagrete...")}
              {renderTextField("Serve quantas pessoas?", "serves_people", "Ex: 2-3 pessoas, 4-5 pessoas...")}
            </>
          )}
          {renderToggle("Serve para compartilhar?", "shareable")}
        </div>
      );

    case "adegas":
      return (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            🍷 Campos de Adega
          </div>
          {renderSelect("Tipo de Produto", "adega_type", [
            "Cerveja (lata)",
            "Cerveja (long neck)",
            "Cerveja (garrafa 600ml)",
            "Cerveja (litrão)",
            "Cerveja Artesanal",
            "Chopp",
            "Vinho Tinto",
            "Vinho Branco",
            "Vinho Rosé",
            "Espumante / Champagne",
            "Whisky",
            "Vodka",
            "Gin",
            "Rum",
            "Tequila",
            "Cachaça",
            "Licor",
            "Conhaque / Brandy",
            "Sake",
            "Drink Pronto",
            "Refrigerante",
            "Suco",
            "Água Mineral",
            "Água com Gás",
            "Energético",
            "Gelo",
            "Carvão",
            "Petisco / Snack",
            "Cigarro",
            "Outro"
          ])}
          {metadata.adega_type === "Outro" && renderTextField("Tipo Personalizado", "adega_custom_type", "Ex: Sidra, Absinto...")}
          {renderTextField("Volume", "volume", "Ex: 350ml, 750ml, 1L...")}
          {(metadata.adega_type?.includes("Cerveja") || metadata.adega_type?.includes("Vinho") || metadata.adega_type?.includes("Whisky") || metadata.adega_type?.includes("Vodka") || metadata.adega_type?.includes("Gin") || metadata.adega_type?.includes("Rum") || metadata.adega_type?.includes("Tequila") || metadata.adega_type?.includes("Cachaça") || metadata.adega_type?.includes("Licor") || metadata.adega_type?.includes("Espumante") || metadata.adega_type?.includes("Chopp") || metadata.adega_type?.includes("Conhaque") || metadata.adega_type?.includes("Sake") || metadata.adega_type?.includes("Drink")) && (
            <>
              {renderTextField("Teor Alcoólico", "alcohol_content", "Ex: 4.5%, 13%, 40%...")}
              {renderTextField("Marca", "brand", "Ex: Heineken, Absolut, Johnnie Walker...")}
            </>
          )}
          {(metadata.adega_type?.includes("Vinho") || metadata.adega_type?.includes("Espumante")) && (
            <>
              {renderTextField("País / Região", "wine_region", "Ex: Chile, Argentina, Serra Gaúcha...")}
              {renderTextField("Uva / Safra", "wine_grape", "Ex: Cabernet Sauvignon 2020...")}
              {renderSelect("Tipo de Corpo", "wine_body", ["Leve", "Médio", "Encorpado"])}
            </>
          )}
          {metadata.adega_type?.includes("Cerveja Artesanal") && (
            <>
              {renderTextField("Estilo", "beer_style", "Ex: IPA, Stout, Pilsen, Weiss...")}
              {renderTextField("Cervejaria", "brewery", "Ex: Colorado, DaDo Bier...")}
            </>
          )}
          {renderToggle("Servir gelado?", "serve_cold")}
        </div>
      );

    case "saudavel":
      return withBeverageToggle(
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-primary text-xs font-bold">
            🥗 Campos de Alimentação Saudável
          </div>
          {renderSelect("Tipo de Produto", "saudavel_type", [
            "Marmita Fit",
            "Salada",
            "Bowl / Poké",
            "Wrap / Sanduíche Natural",
            "Sopa / Caldo",
            "Suco Detox / Verde",
            "Smoothie / Vitamina",
            "Açaí Fitness",
            "Tapioca Fit",
            "Crepioca",
            "Omelete / Ovos",
            "Panqueca de Banana",
            "Granola / Overnight Oats",
            "Iogurte Natural / Kefir",
            "Snack Proteico",
            "Barra de Cereal / Proteína",
            "Brownie / Cookie Fit",
            "Pasta de Amendoim",
            "Mix de Castanhas",
            "Whey / Suplemento (porção)",
            "Outro"
          ])}
          {metadata.saudavel_type === "Outro" && renderTextField("Tipo Personalizado", "saudavel_custom_type", "Ex: Buddha Bowl...")}
          {(metadata.saudavel_type === "Marmita Fit") && (
            <>
              {renderListField("Proteína", "proteins", "Ex: Frango grelhado, Patinho moído, Tilápia...")}
              {renderListField("Acompanhamentos", "side_dishes", "Ex: Arroz integral, Batata doce, Brócolis...")}
              {renderTextField("Calorias", "calories", "Ex: 350 kcal")}
              {renderTextField("Proteína (g)", "protein_grams", "Ex: 35g")}
              {renderTextField("Peso Total", "size_weight", "Ex: 400g, 500g...")}
            </>
          )}
          {(metadata.saudavel_type === "Salada" || metadata.saudavel_type === "Bowl / Poké") && (
            <>
              {renderListField("Ingredientes Principais", "main_ingredients", "Ex: Quinoa, Salmão, Abacate, Edamame...")}
              {renderListField("Molhos Disponíveis", "sauce_options", "Ex: Shoyu, Tahine, Limão...")}
              {renderTextField("Tamanho / Peso", "size_weight", "Ex: 300g, 450g...")}
            </>
          )}
          {(metadata.saudavel_type === "Suco Detox / Verde" || metadata.saudavel_type === "Smoothie / Vitamina") && (
            <>
              {renderListField("Ingredientes", "main_ingredients", "Ex: Couve, Gengibre, Limão, Maçã...")}
              {renderSelect("Tamanho", "drink_size", ["300ml", "400ml", "500ml"])}
            </>
          )}
          {(metadata.saudavel_type === "Snack Proteico" || metadata.saudavel_type === "Barra de Cereal / Proteína" || metadata.saudavel_type === "Brownie / Cookie Fit" || metadata.saudavel_type === "Pasta de Amendoim" || metadata.saudavel_type === "Mix de Castanhas") && (
            <>
              {renderTextField("Peso", "size_weight", "Ex: 40g, 100g, 500g...")}
              {renderTextField("Proteína (g)", "protein_grams", "Ex: 20g")}
            </>
          )}
          {renderTextField("Calorias", "calories", "Ex: 350 kcal")}
          {renderToggle("Vegano?", "is_vegan")}
          {renderToggle("Sem Glúten?", "is_gluten_free")}
          {renderToggle("Sem Lactose?", "is_lactose_free")}
          {renderToggle("Orgânico?", "is_organic")}
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
    const selectedFlavorData = availableFlavors.filter(f => current.includes(f.id));
    let minPrice = 0;
    if (selectedFlavorData.length > 0) {
      const allPrices = selectedFlavorData.flatMap(f => Object.values(f.prices).filter(p => p > 0));
      minPrice = allPrices.length > 0 ? Math.min(...allPrices) / 100 : 0;
    }
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
