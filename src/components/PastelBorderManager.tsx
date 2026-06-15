import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, Circle } from "lucide-react";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

interface PastelBorderManagerProps {
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

const PastelBorderManager = ({ storeId }: PastelBorderManagerProps) => {
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const { data: store } = useQuery({
    queryKey: ["store-for-pastel-compl", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("settings").eq("id", storeId).single();
      return data;
    },
  });
  const settings = (store?.settings || {}) as Record<string, any>;
  const pastelConfig = (settings.pastel_config || {}) as Record<string, any>;
  const maxComplements: number = Number(pastelConfig.max_complements) || 3;

  const setMaxComplements = async (n: number) => {
    const newSettings = { ...settings, pastel_config: { ...pastelConfig, max_complements: n } };
    const { error } = await supabase.from("stores").update({ settings: newSettings as any }).eq("id", storeId);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success(`Cliente pode escolher até ${n} complemento${n > 1 ? "s" : ""}`);
    queryClient.invalidateQueries({ queryKey: ["store-for-pastel-compl", storeId] });
  };

  const { data: borders = [], isLoading } = useQuery({
    queryKey: ["pastel-borders", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pastel_borders")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as Border[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["pastel-borders", storeId] });

  // Auto-create "Borda Simples" if the list is empty
  useEffect(() => {
    const createDefaultBorder = async () => {
      if (!isLoading && borders.length === 0 && storeId) {
        const { error } = await (supabase as any).from("pastel_borders").insert({
          store_id: storeId,
          name: "Borda Simples",
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
    const { error } = await (supabase as any).from("pastel_borders").insert({
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
    const { error } = await (supabase as any).from("pastel_borders").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Borda excluída!");
    invalidate();
  };

  const toggleAvailable = async (border: Border) => {
    const { error } = await (supabase as any).from("pastel_borders")
      .update({ is_available: !border.is_available })
      .eq("id", border.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    invalidate();
  };

  const saveEdit = async (id: string) => {
    const price = parseFloat(editPrice.replace(",", ".")) || 0;
    const { error } = await (supabase as any).from("pastel_borders")
      .update({ name: editName.trim(), price })
      .eq("id", id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Borda atualizada!");
    setEditingId(null);
    invalidate();
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Circle className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-bold text-foreground/80 uppercase tracking-wider">Complementos de Pastel</h2>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-primary/20 text-primary px-3 py-2 rounded-xl text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" /> Novo Complemento
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Configure os complementos (até 3 por pastel) que seus clientes podem adicionar. Deixe o preço em R$ 0,00 para complementos grátis.
      </p>

      {showAdd && (
        <div className="bg-card border border-primary/20 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-primary">Novo Complemento</h3>
          <input
            type="text"
            placeholder="Nome do complemento (ex: Orégano)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-muted text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
            autoFocus
          />
          <div className="w-full flex items-center gap-1.5 bg-muted text-foreground px-3 py-2 rounded-lg text-sm border border-border focus-within:border-primary">
            <span className="text-muted-foreground font-bold">R$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={newPrice ? formatBRLDisplay(parseBRLCentsInput(newPrice)) : ""}
              onChange={(e) => {
                const n = parseBRLCentsInput(e.target.value);
                setNewPrice(n > 0 ? n.toFixed(2) : "");
              }}
              className="flex-1 min-w-0 bg-transparent focus:outline-none"
            />
          </div>
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
          <p className="text-sm text-muted-foreground font-medium">Nenhum complemento cadastrado</p>
          <p className="text-xs text-muted-foreground">Adicione complementos para seus clientes escolherem</p>
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
                  <div className="w-24 flex items-center gap-1 bg-muted text-foreground px-2 py-1 rounded text-sm border border-primary focus-within:ring-1 focus-within:ring-primary">
                    <span className="text-muted-foreground font-bold">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editPrice ? formatBRLDisplay(parseBRLCentsInput(editPrice)) : ""}
                      onChange={(e) => {
                        const n = parseBRLCentsInput(e.target.value);
                        setEditPrice(n > 0 ? n.toFixed(2) : "");
                      }}
                      className="flex-1 min-w-0 bg-transparent focus:outline-none"
                    />
                  </div>
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
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Excluir borda?",
                        description: `Tem certeza que deseja excluir "${border.name}"? Esta ação não pode ser desfeita.`,
                        confirmText: "Excluir",
                        variant: "destructive",
                      });
                      if (ok) deleteBorder(border.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        💡 Cliente pode escolher até 3 complementos por pastel
      </p>
    </div>
  );
};

export default PastelBorderManager;
