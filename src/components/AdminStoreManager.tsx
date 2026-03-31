import { useState } from "react";
import { Store, Trash2, CheckCircle2, Clock, XCircle, Filter } from "lucide-react";
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
      toast.success("Loja removida do FoodIta com sucesso.");
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
          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Ativa
          </span>
        );
      case "analise":
        return (
          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full flex items-center gap-1">
            <Clock className="h-3 w-3" /> Pendente
          </span>
        );
      case "bloqueado":
        return (
          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-full flex items-center gap-1">
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
        <Filter className="h-4 w-4 text-gray-400 shrink-0" />
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              filter === f.key
                ? "bg-yellow-500 text-gray-900"
                : "bg-[#1E293B] text-gray-400"
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
            <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((store) => (
            <div
              key={store.id}
              className="bg-[#0F172A] rounded-xl p-4 flex items-center justify-between border border-gray-800"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {store.image_url ? (
                  <img
                    src={store.image_url}
                    alt={store.name}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center shrink-0">
                    <Store className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{store.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{store.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                {statusBadge(store.status)}
                <button
                  onClick={() => setDeleteTarget({ id: store.id, name: store.name })}
                  className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Excluir loja"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center py-8">
          Nenhuma loja encontrada com este filtro.
        </p>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-[#1E293B] border-gray-700 text-white max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Excluir Loja
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Tem certeza que deseja excluir <strong className="text-white">{deleteTarget?.name}</strong>?
              Esta ação é irreversível e removerá todos os produtos, cardápio e horários vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white font-bold"
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
