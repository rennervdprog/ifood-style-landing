import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Store, Eye, Trash2, Loader2 } from "lucide-react";

const CATEGORIES = [
  { value: "lanches", label: "🍔 Lanches", emoji: "🍔" },
  { value: "pizzas", label: "🍕 Pizzas", emoji: "🍕" },
  { value: "restaurante", label: "🍽️ Restaurante", emoji: "🍽️" },
  { value: "adegas", label: "🍷 Adegas", emoji: "🍷" },
  { value: "japonesa", label: "🍣 Japonesa", emoji: "🍣" },
  { value: "saudavel", label: "🥗 Saudável", emoji: "🥗" },
  { value: "sobremesas", label: "🍨 Sobremesas", emoji: "🍨" },
  { value: "cafeteria", label: "☕ Cafeteria", emoji: "☕" },
  { value: "churrasco", label: "🥩 Churrasco", emoji: "🥩" },
  { value: "farmacias", label: "💊 Farmácias", emoji: "💊" },
  { value: "docerias", label: "🍰 Docerias", emoji: "🍰" },
  { value: "esfihas", label: "🥟 Esfihas", emoji: "🥟" },
];

const TestStoreCreator = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: testStores, refetch } = useQuery({
    queryKey: ["admin-test-stores", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, category, slug, created_at")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleCreate = async (
    cat: typeof CATEGORIES[0],
    planType?: string,
    storeType?: "food" | "apparel",
  ) => {
    setCreating(true);
    try {
      const { error } = await supabase.rpc("admin_create_test_store", {
        _name: `Teste ${storeType === "apparel" ? "Boutique " : planType === "pdv_only" ? "PDV " : ""}${cat.label.replace(/[^\w\s]/g, "").trim()}`,
        _category: cat.value as any,
        ...(planType ? { _plan_type: planType } : {}),
        ...(storeType ? { _store_type: storeType } : {}),
      } as any);
      if (error) throw error;
      toast.success(`Loja teste ${storeType === "apparel" ? "(Boutique) " : planType === "pdv_only" ? "(Somente PDV) " : ""}"${cat.label}" criada!`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-stores-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar loja teste.");
    }
    setCreating(false);
  };

  const handleDelete = async (storeId: string) => {
    setDeleting(storeId);
    try {
      const { error } = await supabase.rpc("admin_delete_store", { _store_id: storeId } as any);
      if (error) throw error;
      toast.success("Loja teste removida.");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-stores-list"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover.");
    }
    setDeleting(null);
  };

  const handleSimulate = (storeId: string) => {
    navigate(`/admin?storeId=${storeId}`);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Store className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-bold text-foreground">🧪 Lojas de Teste</h3>
      </div>
      <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
        ⚠️ Não configure subconta Asaas em lojas teste — o Asaas pode bloquear a conta principal por dados fictícios.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {CATEGORIES.map((cat) => {
          const exists = testStores?.some((s) => s.category === cat.value);
          return (
            <button
              key={cat.value}
              onClick={() => handleCreate(cat)}
              disabled={creating}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-bold transition-all active:scale-95 ${
                exists
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border bg-muted text-muted-foreground hover:border-primary/50"
              }`}
            >
              <span className="text-lg">{cat.emoji}</span>
              <span>{cat.label.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim()}</span>
              {exists && <span className="text-[10px] text-primary/70">✓ Criada</span>}
            </button>
          );
        })}
      </div>

      <div className="pt-3 border-t border-border space-y-2">
        <p className="text-xs font-bold text-foreground/70">🖥️ Plano Somente PDV (sem delivery/vitrine)</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={`pdv-${cat.value}`}
              onClick={() => handleCreate(cat, "pdv_only")}
              disabled={creating}
              className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-all active:scale-95 hover:border-emerald-500/70"
            >
              <span className="text-lg">{cat.emoji}</span>
              <span>PDV {cat.label.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-border space-y-2">
        <p className="text-xs font-bold text-foreground/70">👕 PDV Boutique (roupas — grade tamanho/cor)</p>
        <button
          onClick={() => handleCreate(
            { value: "restaurante" as any, label: "👕 Boutique", emoji: "👕" },
            "pdv_only",
            "apparel",
          )}
          disabled={creating}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-fuchsia-500/40 bg-fuchsia-500/5 text-fuchsia-700 dark:text-fuchsia-400 text-xs font-bold transition-all active:scale-95 hover:border-fuchsia-500/70"
        >
          <span className="text-lg">👕</span>
          <span>Criar loja teste — PDV Boutique (roupas)</span>
        </button>
      </div>

      {testStores && testStores.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-foreground/70">Suas lojas de teste:</p>
          {testStores.map((store) => {
            const cat = CATEGORIES.find((c) => c.value === store.category);
            return (
              <div key={store.id} className="flex items-center justify-between bg-muted/50 border border-border rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cat?.emoji || "🏪"}</span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{store.name}</p>
                    <p className="text-[10px] text-muted-foreground">{store.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSimulate(store.id)}
                    className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Abrir Painel
                  </button>
                  <button
                    onClick={() => handleDelete(store.id)}
                    disabled={deleting === store.id}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    {deleting === store.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TestStoreCreator;
