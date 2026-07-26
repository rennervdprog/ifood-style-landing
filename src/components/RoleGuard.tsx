import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isPartnerCapacitorApp } from "@/lib/capacitorAppMode";
import { useUserRouting } from "@/hooks/useUserRouting";
import { AppIcon } from "@/components/ui/app-icon";
import { Shield } from "lucide-react";

interface RoleGuardProps {
  allowedRoles: string[];
  redirectTo: string;
  children: React.ReactNode;
  requireApproval?: boolean;
}

const RoleGuard = ({ allowedRoles, redirectTo, children, requireApproval = false }: RoleGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const routing = useUserRouting();
  const [slow, setSlow] = useState(false);
  const allowedRolesKey = allowedRoles.join(",");
  const checking = routing.loading;

  useEffect(() => {
    if (!authLoading && !checking) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, [authLoading, checking]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(isPartnerCapacitorApp() ? "/portal-parceiro" : "/auth", { replace: true });
      return;
    }
    if (routing.loading) return;

    // Admin bypass — pode acessar qualquer rota protegida.
    if (routing.isAdmin) return;

    const role = routing.role;
    if (!role) {
      if (allowedRoles.includes("cliente")) return; // fallback cliente permitido
      toast.error("Acesso negado. Redirecionando...");
      navigate(routing.homeRoute || redirectTo, { replace: true });
      return;
    }

    if (!allowedRoles.includes(role)) {
      toast.error("Acesso negado. Redirecionando...");
      navigate(routing.homeRoute || redirectTo, { replace: true });
    }
    // requireApproval mantido na API por compat — auto-aprovação ativa.
    void requireApproval;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, allowedRolesKey, redirectTo, requireApproval, routing.loading, routing.role, routing.isAdmin, routing.homeRoute]);

  const authorized = (() => {
    if (!user || routing.loading) return false;
    if (routing.isAdmin) return true;
    if (!routing.role) return allowedRoles.includes("cliente");
    return allowedRoles.includes(routing.role);
  })();

  if (authLoading || checking) {
    // Sem spinner aqui: o Suspense global só mostra spinner após 180ms.
    // Só renderiza fallback se estiver demorando muito (rede ruim).
    if (!slow) return null;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground max-w-xs">
          Está demorando mais que o normal. Verifique sua conexão e tente novamente.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl text-sm"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-5">
          <AppIcon name="Shield" className="h-10 w-10 text-amber-500" />
        </div>
        <h1 className="text-xl font-black text-foreground mb-2">Cadastro em Análise 🔍</h1>
        <p className="text-sm text-muted-foreground max-w-xs mb-3">
          Recebemos seus dados com sucesso! Em até <span className="font-bold text-foreground">24 horas</span> o administrador do ItaSuper liberará seu acesso.
        </p>
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 max-w-xs mb-6">
          <p className="text-xs text-muted-foreground">
            📲 Entraremos em contato via <span className="font-bold text-foreground">WhatsApp</span> assim que seu cadastro for aprovado.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.location.reload()} className="bg-primary text-primary-foreground font-bold px-5 py-3 rounded-xl text-sm">
            Verificar Status
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RoleGuard;
