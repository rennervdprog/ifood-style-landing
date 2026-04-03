import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    const checkRole = async () => {
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (allowedRoles.includes("admin") && adminRole) {
        setAuthorized(true);
        setChecking(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_approved")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        if (allowedRoles.includes("cliente")) {
          setAuthorized(true);
        } else {
          toast.error("Acesso negado. Redirecionando...");
          navigate(redirectTo, { replace: true });
        }
        setChecking(false);
        return;
      }

      const role = (profile as any).role as string;
      
      if (!allowedRoles.includes(role)) {
        toast.error("Acesso negado. Redirecionando...");
        if (role === "lojista") {
          navigate("/admin", { replace: true });
        } else if (role === "motoboy") {
          navigate("/entregador", { replace: true });
        } else {
          navigate(redirectTo, { replace: true });
        }
        setChecking(false);
        return;
      }

      if (requireApproval && !(profile as any).is_approved) {
        setAuthorized(false);
        setChecking(false);
        return;
      }

      setAuthorized(true);
      setChecking(false);
    };

    checkRole();
  }, [user, authLoading, allowedRoles, redirectTo, navigate, requireApproval]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <Shield className="h-16 w-16 text-yellow-500 mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Cadastro em Análise! 🛡️</h1>
        <p className="text-sm text-muted-foreground max-w-xs mb-2">
          Recebemos seus dados. Em até 24h o administrador do FoodIta liberará seu acesso.
        </p>
        <p className="text-xs text-muted-foreground">Entraremos em contato via WhatsApp.</p>
        <button onClick={() => navigate("/")} className="mt-6 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl">
          Voltar à Home
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export default RoleGuard;
