import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, Circle } from "lucide-react";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";

interface PizzaBorderManagerProps {
  storeId: string;
}

interface Border {
  id: string;
  store_id: string;
  name: string;
  price: number;
  sort_order: number;
  is_available: boolean;
}

const PizzaBorderManager = ({ storeId }: PizzaBorderManagerProps) => {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const { data: borders = [], isLoading } = useQuery({
    queryKey: ["pizza-borders", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pizza_borders")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as Border[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["pizza-borders", storeId] });

  // Auto-create "Borda Tradicional" if the list is empty
  useEffect(() => {
    const createDefaultBorder = async () => {
      if (!isLoading && borders.length === 0 && storeId) {
        const { error } = await supabase.from("pizza_borders").insert({
          store_id: storeId,
          name: "Borda Tradicional",
          price: 0,
          sort_order: 0,
          is_available: true
        });
        if (!error) invalidate();
      }
    };
    createDefaultBorder();
  }, [borders.length, isLoading, storeId]);

  const addBorder = async () => {
    if (!newName.trim()) return;
    const price = parseFloat(newPrice.replace(",", ".")) || 0;
    const { error } = await supabase.from("pizza_borders").insert({
      store_id: storeId,
      name: newName.trim(),
      price,
      sort_order: borders.length,
    });
    if (error) { toast.error("Erro ao adicionar borda"); return; }
    toast.success("Borda adicionada!");
    setNewName("");
    setNewPrice("");
    setShowAdd(false);
    invalidate();
  };

  const deleteBorder = async (id: string) => {
    const { error } = await supabase.from("pizza_borders").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Borda excluída!");
    invalidate();
  };

  const toggleAvailable = async (border: Border) => {
    const { error } = await supabase
      .from("pizza_borders")
      .update({ is_available: !border.is_available })
      .eq("id", border.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    invalidate();
  };

  const saveEdit = async (id: string) => {
    const price = parseFloat(editPrice.replace(",", ".")) || 0;
    const { error } = await supabase
      .from("pizza_borders")
      .update({ name: editName.trim(), price })
      .eq("id", id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Borda atualizada!");
    setEditingId(null);
    invalidate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Circle className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-bold text-foreground/80 uppercase tracking-wider">Bordas de Pizza</h2>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-primary/20 text-primary px-3 py-2 rounded-xl text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" /> Nova Borda
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Configure as opções de borda que seus clientes podem escolher ao montar a pizza.
      </p>

      {showAdd && (
        <div className="bg-card border border-primary/20 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-primary">Nova Borda</h3>
          <input
            type="text"
            placeholder="Nome da borda (ex: Catupiry)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-muted text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
            autoFocus
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Preço (ex: 5.00)"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            className="w-full bg-muted text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
          />
          <div className="flex gap-2">
            <button onClick={addBorder} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-bold">
              <Save className="h-4 w-4 inline mr-1" /> Salvar
            </button>
            <button onClick={() => { setShowAdd(false); setNewName(""); setNewPrice(""); }} className="px-4 py-2 text-muted-foreground text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-14 bg-muted rounded-xl" />
          ))}
        </div>
      ) : borders.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center space-y-2">
          <Circle className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground font-medium">Nenhuma borda cadastrada</p>
          <p className="text-xs text-muted-foreground">Adicione bordas para seus clientes escolherem</p>
        </div>
      ) : (
        <div className="space-y-2">
          {borders.map(border => (
            <div
              key={border.id}
              className={`bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 ${
                !border.is_available ? "opacity-50" : ""
              }`}
            >
              {editingId === border.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 bg-muted text-foreground px-2 py-1 rounded text-sm border border-primary focus:outline-none"
                    autoFocus
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-24 bg-muted text-foreground px-2 py-1 rounded text-sm border border-primary focus:outline-none"
                  />
                  <button onClick={() => saveEdit(border.id)} className="text-primary">
                    <Save className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{border.name}</p>
                    <p className="text-xs text-primary font-black">
                      {border.price > 0 ? `+ ${formatBRL(border.price)}` : "Grátis"}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleAvailable(border)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      border.is_available
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {border.is_available ? "Ativo" : "Inativo"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(border.id);
                      setEditName(border.name);
                      setEditPrice(border.price.toString());
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteBorder(border.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        💡 A "Borda Tradicional" com preço R$ 0,00 é a opção padrão gratuita
      </p>
    </div>
  );
};

export default PizzaBorderManager;
