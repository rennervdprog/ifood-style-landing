import { Shield, Clock, Store, Bike, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import WhatsAppButton from "@/components/WhatsAppButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AdminApprovals = () => {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: pendingProfiles, isLoading } = useQuery({
    queryKey: ["admin-pending-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).filter((p: any) => p.role === "lojista" || p.role === "motoboy");
    },
  });

  const handleApprove = async (profile: any, approved: boolean) => {
    setSyncingId(profile.user_id);
    try {
      const { error } = await supabase.rpc("admin_approve_partner", {
        _profile_user_id: profile.user_id,
        _approved: approved,
      } as any);

      if (error) { toast.error(error.message); return; }

      if (approved) {
        try {
          const { data: freshProfile } = await supabase.from("profiles").select("*").eq("user_id", profile.user_id).single();
          await supabase.functions.invoke("sync-to-external", {
            body: { action: "sync_profile", data: { profile: { ...(freshProfile || profile), status: "approved" } } },
          });

          // Auto-create Asaas subaccount for lojistas
          if (profile.role === "lojista") {
            try {
              const { data: store } = await supabase
                .from("stores")
                .select("id, asaas_wallet_id")
                .eq("owner_id", profile.user_id)
                .single();
              
              if (store && !store.asaas_wallet_id) {
                const { data: subResult, error: subError } = await supabase.functions.invoke("asaas-subaccount", {
                  body: { store_id: store.id },
                });
                if (subError) {
                  console.warn("Asaas subaccount creation failed:", subError);
                  toast.info("Parceiro aprovado! Subconta Asaas pendente - crie manualmente.");
                } else {
                  console.log("Asaas subaccount created:", subResult);
                }
              }
            } catch (e) {
              console.warn("Auto subaccount creation error:", e);
            }
          }

          toast.success("Parceiro aprovado e sincronizado!");
        } catch { toast.success("Parceiro aprovado! (sincronização externa pendente)"); }
      } else {
        toast.success("Parceiro recusado.");
      }

      queryClient.invalidateQueries({ queryKey: ["admin-pending-profiles"] });
    } finally { setSyncingId(null); }
  };

  const handleDelete = async (profile: any) => {
    setDeletingId(profile.user_id);
    try {
      const { error } = await supabase.rpc("admin_delete_partner", { _profile_user_id: profile.user_id } as any);
      if (error) { toast.error(error.message); return; }
      toast.success(`${profile.role === "lojista" ? "Lojista" : "Entregador"} excluído com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["admin-pending-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-orders"] });
    } finally { setDeletingId(null); }
  };

  const pending = pendingProfiles?.filter((p: any) => !p.is_approved) || [];
  const approved = pendingProfiles?.filter((p: any) => p.is_approved) || [];

  const renderDeleteButton = (p: any) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          disabled={deletingId === p.user_id}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-bold active:scale-95 transition-transform min-h-[44px] disabled:opacity-50"
        >
          {deletingId === p.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            Excluir {p.role === "lojista" ? "Lojista" : "Entregador"}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Isso vai excluir <strong className="text-foreground">{p.full_name || "este parceiro"}</strong> e{" "}
            <strong className="text-destructive">TODOS os dados associados</strong> (pedidos finalizados, produtos, 
            ganhos, saques, lojas). Esta ação é irreversível.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-muted text-foreground border-border hover:bg-muted/80">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleDelete(p)}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Excluir Tudo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="space-y-4">
      {/* Pending */}
      <h3 className="text-sm font-bold text-yellow-600 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Pendentes ({pending.length})
      </h3>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : pending.length > 0 ? (
        <div className="space-y-2">
          {pending.map((p: any) => (
            <div key={p.id} className="bg-card rounded-xl p-4 border border-yellow-500/30">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {p.role === "lojista" ? (
                    <Store className="h-4 w-4 text-orange-500" />
                  ) : (
                   <Bike className="h-4 w-4 text-primary" />
                  )}
                  <div>
                    <p className="text-sm font-bold text-foreground">{p.full_name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.role === "lojista" ? "Lojista" : "Entregador"}
                      {p.document ? ` — ${p.document}` : ""}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-600 text-xs font-bold rounded-full">
                  Pendente
                </span>
              </div>
              {p.vehicle && (
                <p className="text-xs text-muted-foreground mb-2">🏍️ {p.vehicle}</p>
              )}
              <div className="flex gap-2">
                {(p as any).whatsapp_number && (
                  <WhatsAppButton
                    number={(p as any).whatsapp_number}
                    message={`Olá ${p.full_name || ""}! Aqui é o admin do ItaSuper. Sobre seu cadastro como ${p.role === "lojista" ? "lojista" : "entregador"}...`}
                    label="WhatsApp"
                    size="sm"
                  />
                )}
                <button
                  onClick={() => handleApprove(p, true)}
                  disabled={syncingId === p.user_id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-primary-foreground text-sm font-bold active:scale-95 transition-transform min-h-[44px] disabled:opacity-50"
                >
                  {syncingId === p.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  APROVAR
                </button>
                <button
                  onClick={() => handleApprove(p, false)}
                  disabled={syncingId === p.user_id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-bold active:scale-95 transition-transform min-h-[44px] disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  RECUSAR
                </button>
                {renderDeleteButton(p)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum cadastro pendente</p>
      )}

      {/* Approved */}
      {approved.length > 0 && (
        <>
          <h3 className="text-sm font-bold text-green-600 flex items-center gap-2 mt-6">
            <CheckCircle2 className="h-4 w-4" />
            Aprovados ({approved.length})
          </h3>
          <div className="space-y-2">
            {approved.map((p: any) => (
              <div key={p.id} className="bg-card rounded-xl p-3 flex items-center justify-between border border-border">
                <div className="flex items-center gap-2">
                  {p.role === "lojista" ? (
                    <Store className="h-4 w-4 text-orange-500" />
                  ) : (
                    <Bike className="h-4 w-4 text-primary" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">{p.role === "lojista" ? "Lojista" : "Entregador"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-600 text-xs font-bold rounded-full">
                    Ativo
                  </span>
                  {renderDeleteButton(p)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminApprovals;
