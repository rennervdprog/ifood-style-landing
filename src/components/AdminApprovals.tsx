import { Shield, Clock, Store, Bike, CheckCircle2, XCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import WhatsAppButton from "@/components/WhatsAppButton";

const AdminApprovals = () => {
  const queryClient = useQueryClient();

  const { data: pendingProfiles, isLoading } = useQuery({
    queryKey: ["admin-pending-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Filter by role client-side since the column type isn't in the generated types yet
      return (data || []).filter((p: any) => p.role === "lojista" || p.role === "motoboy");
    },
  });

  const handleApprove = async (userId: string, approved: boolean) => {
    const { error } = await supabase.rpc("admin_approve_partner", {
      _profile_user_id: userId,
      _approved: approved,
    } as any);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(approved ? "Parceiro aprovado!" : "Parceiro recusado.");
      queryClient.invalidateQueries({ queryKey: ["admin-pending-profiles"] });
    }
  };

  const pending = pendingProfiles?.filter((p: any) => !p.is_approved) || [];
  const approved = pendingProfiles?.filter((p: any) => p.is_approved) || [];

  return (
    <div className="space-y-4">
      {/* Pending */}
      <h3 className="text-sm font-bold text-yellow-400 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Pendentes ({pending.length})
      </h3>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : pending.length > 0 ? (
        <div className="space-y-2">
          {pending.map((p: any) => (
            <div key={p.id} className="bg-[#0F172A] rounded-xl p-4 border border-yellow-500/30">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {p.role === "lojista" ? (
                    <Store className="h-4 w-4 text-orange-400" />
                  ) : (
                    <Bike className="h-4 w-4 text-blue-400" />
                  )}
                  <div>
                    <p className="text-sm font-bold text-white">{p.full_name || "Sem nome"}</p>
                    <p className="text-xs text-gray-400">
                      {p.role === "lojista" ? "Lojista" : "Entregador"}
                      {p.document ? ` — ${p.document}` : ""}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full">
                  Pendente
                </span>
              </div>
              {p.vehicle && (
                <p className="text-xs text-gray-400 mb-2">🏍️ {p.vehicle}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(p.user_id, true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold active:scale-95 transition-transform"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  APROVAR
                </button>
                <button
                  onClick={() => handleApprove(p.user_id, false)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold active:scale-95 transition-transform"
                >
                  <XCircle className="h-4 w-4" />
                  RECUSAR
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center py-4">Nenhum cadastro pendente</p>
      )}

      {/* Approved */}
      {approved.length > 0 && (
        <>
          <h3 className="text-sm font-bold text-green-400 flex items-center gap-2 mt-6">
            <CheckCircle2 className="h-4 w-4" />
            Aprovados ({approved.length})
          </h3>
          <div className="space-y-2">
            {approved.map((p: any) => (
              <div key={p.id} className="bg-[#0F172A] rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {p.role === "lojista" ? (
                    <Store className="h-4 w-4 text-orange-400" />
                  ) : (
                    <Bike className="h-4 w-4 text-blue-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{p.full_name}</p>
                    <p className="text-xs text-gray-500">{p.role === "lojista" ? "Lojista" : "Entregador"}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full">
                  Ativo
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminApprovals;
