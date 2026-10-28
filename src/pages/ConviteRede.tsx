/**
 * ConviteRede — página de aceite do convite de gerente de subloja
 * (Fase 2, plano 28/10/2026, 4.3).
 *
 * Rota pública /convite-rede/:code. O código é o segredo: quem tem o link
 * vê de qual loja/rede é o convite (get_network_invite) mesmo sem login.
 * Para aceitar, precisa entrar com a conta do e-mail convidado — o banco
 * confere (accept_network_invite). Sem login, a página mostra o convite
 * e o botão para entrar.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parseInviteActionResult } from "@/lib/networkUnits";
import { toast } from "sonner";
import { Building2, Store, Loader2, CheckCircle2, XCircle, Clock, LogIn } from "lucide-react";

interface InviteDetails {
  code: string;
  email: string;
  status: string;
  expires_at: string;
  store_id: string;
  store_name: string;
  store_city: string | null;
  network_id: string;
  network_name: string;
}

const ConviteRede = () => {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [declined, setDeclined] = useState(false);

  const { data: invite, isLoading } = useQuery({
    queryKey: ["network-invite", code],
    queryFn: async (): Promise<InviteDetails | null> => {
      const { data, error } = await (supabase as any).rpc("get_network_invite", { _code: code });
      if (error) throw error;
      return data as InviteDetails | null;
    },
    enabled: !!code,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("accept_network_invite", { _code: code });
      if (error) throw error;
      // Bugfix Fase 2: vencido devolve {ok:false, error} (não exceção),
      // para o status 'expired' persistir no banco.
      const result = parseInviteActionResult(data);
      if (!result.ok) throw new Error(result.error || "Erro ao aceitar convite.");
      return result.storeId;
    },
    onSuccess: () => {
      toast.success("Convite aceito! Você agora é gerente desta subloja.");
      navigate("/admin");
    },
    onError: (err: any) => {
      // Recarrega o convite: se venceu, a página passa a mostrar "venceu".
      void queryClient.invalidateQueries({ queryKey: ["network-invite", code] });
      toast.error(err.message || "Erro ao aceitar convite.");
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("decline_network_invite", { _code: code });
      if (error) throw error;
      // Bugfix Fase 2: vencido devolve {ok:false, error} (não exceção).
      const result = parseInviteActionResult(data);
      if (!result.ok) throw new Error(result.error || "Erro ao recusar convite.");
    },
    onSuccess: () => {
      setDeclined(true);
      toast.success("Convite recusado.");
    },
    onError: (err: any) => {
      void queryClient.invalidateQueries({ queryKey: ["network-invite", code] });
      toast.error(err.message || "Erro ao recusar convite.");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-black mb-2">Convite não encontrado</h2>
          <p className="text-sm text-muted-foreground">O link pode estar errado ou o convite foi removido. Peça um novo link ao dono da rede.</p>
        </div>
      </div>
    );
  }

  const expired = invite.status === "pending" && new Date(invite.expires_at).getTime() <= Date.now();
  const answered = invite.status !== "pending" || expired;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="text-center">
          <Building2 className="h-10 w-10 text-primary mx-auto mb-3" />
          <h2 className="text-lg font-black">Convite para gerenciar uma subloja</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {invite.network_name} te convidou para gerenciar:
          </p>
        </div>

        <div className="bg-muted/40 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm font-bold">{invite.store_name}</p>
          </div>
          {invite.store_city && (
            <p className="text-xs text-muted-foreground mt-1 ml-6">{invite.store_city}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2 ml-6">Convite para: <b>{invite.email}</b></p>
        </div>

        {answered ? (
          <div className="text-center py-2">
            {declined || invite.status === "declined" ? (
              <p className="text-sm font-bold text-muted-foreground">Este convite foi recusado.</p>
            ) : invite.status === "accepted" ? (
              <p className="text-sm font-bold text-green-600 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Este convite já foi aceito.
              </p>
            ) : (
              <p className="text-sm font-bold text-amber-600 flex items-center justify-center gap-1.5">
                <Clock className="h-4 w-4" /> Este convite venceu (vale 7 dias). Peça um novo ao dono da rede.
              </p>
            )}
          </div>
        ) : !user ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Para aceitar, entre com a conta do e-mail convidado ({invite.email}). Se ainda não tem conta, cadastre-se primeiro com esse e-mail.
            </p>
            <button
              onClick={() => navigate("/portal-parceiro")}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-black text-sm flex items-center justify-center gap-2"
            >
              <LogIn className="h-4 w-4" /> Entrar para aceitar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {acceptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Aceitar e virar gerente
            </button>
            <button
              onClick={() => declineMutation.mutate()}
              disabled={declineMutation.isPending}
              className="w-full bg-card border border-border rounded-xl py-3 font-bold text-sm disabled:opacity-50"
            >
              Recusar convite
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConviteRede;
