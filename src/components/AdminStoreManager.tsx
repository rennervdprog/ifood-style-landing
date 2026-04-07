import { useState } from "react";
import { Store, Trash2, CheckCircle2, Clock, XCircle, Filter, Wallet, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type StoreFilter = "all" | "pending" | "active" | "blocked";

const AdminStoreManager = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StoreFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState<string | null>(null);

  const { data: stores, isLoading } = useQuery({
    queryKey: ["admin-stores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = stores?.filter((s) => {
    if (filter === "pending") return s.status === "analise";
    if (filter === "active") return s.status === "ativo";
    if (filter === "blocked") return s.status === "bloqueado";
    return true;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("admin_delete_store", {
        _store_id: deleteTarget.id,
      } as any);
      if (error) throw error;
      toast.success("Loja removida do ItaSuper com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["admin-stores-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir loja.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "ativo":
        return (
          <span className="px-2 py-0.5 bg-green-500/20 text-green-600 text-xs font-bold rounded-full flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Ativa
          </span>
        );
      case "analise":
        return (
          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-600 text-xs font-bold rounded-full flex items-center gap-1">
            <Clock className="h-3 w-3" /> Pendente
          </span>
        );
      case "bloqueado":
        return (
          <span className="px-2 py-0.5 bg-red-500/20 text-red-600 text-xs font-bold rounded-full flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Bloqueada
          </span>
        );
      default:
        return null;
    }
  };

  const counts = {
    all: stores?.length || 0,
    pending: stores?.filter((s) => s.status === "analise").length || 0,
    active: stores?.filter((s) => s.status === "ativo").length || 0,
    blocked: stores?.filter((s) => s.status === "bloqueado").length || 0,
  };

  const filters: { key: StoreFilter; label: string }[] = [
    { key: "all", label: `Todas (${counts.all})` },
    { key: "pending", label: `Pendentes (${counts.pending})` },
    { key: "active", label: `Aprovadas (${counts.active})` },
    { key: "blocked", label: `Bloqueadas (${counts.blocked})` },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Store list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((store) => (
            <div
              key={store.id}
              className="bg-card rounded-xl p-4 flex items-center justify-between border border-border"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {store.image_url ? (
                  <img
                    src={store.image_url}
                    alt={store.name}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Store className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{store.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{store.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                {statusBadge(store.status)}
                {store.status === "ativo" && !store.asaas_wallet_id && (
                  <button
                    onClick={async () => {
                      setCreatingWallet(store.id);
                      try {
                        const { error } = await supabase.functions.invoke("asaas-subaccount", {
                          body: { store_id: store.id },
                        });
                        if (error) throw error;
                        toast.success(`Subconta Asaas criada para ${store.name}`);
                        queryClient.invalidateQueries({ queryKey: ["admin-stores-list"] });
                      } catch (err: any) {
                        toast.error(err.message || "Erro ao criar subconta");
                      } finally {
                        setCreatingWallet(null);
                      }
                    }}
                    disabled={creatingWallet === store.id}
                    className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Criar subconta Asaas (split)"
                  >
                    {creatingWallet === store.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  </button>
                )}
                {store.asaas_wallet_id && (
                  <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-bold rounded-full flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> Split
                  </span>
                )}
                <button
                  onClick={() => setDeleteTarget({ id: store.id, name: store.name })}
                  className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-95 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Excluir loja"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhuma loja encontrada com este filtro.
        </p>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Excluir Loja
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir <strong className="text-foreground">{deleteTarget?.name}</strong>?
              Esta ação é irreversível e removerá todos os produtos, cardápio e horários vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="bg-muted text-foreground border-border hover:bg-muted/80">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
            >
              {deleting ? "Excluindo..." : "Excluir Definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminStoreManager;
