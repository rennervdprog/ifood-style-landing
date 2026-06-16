import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { isPartnerCapacitorApp } from "@/lib/capacitorAppMode";

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
  const [slow, setSlow] = useState(false);

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

    const checkRole = async () => {
      // Admin can access ANY screen
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (adminRole) {
        setAuthorized(true);
        setChecking(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_approved")
        .eq("user_id", user.id)
        .maybeSingle();

      let resolvedRole = (profile as any)?.role as string | undefined;
      let resolvedApproved = Boolean((profile as any)?.is_approved);

      if (!resolvedRole && allowedRoles.includes("lojista")) {
        const { data: ownedStore } = await supabase
          .from("stores")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (ownedStore) {
          resolvedRole = "lojista";
        }
      }

      // Fallback: detectar matriz pela rede
      if (!resolvedRole && allowedRoles.includes("lojista_matriz")) {
        const { data: network } = await (supabase as any)
          .from("store_networks" as any)
          .select("id, is_approved")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (network) {
          resolvedRole = "lojista_matriz";
          resolvedApproved = Boolean((network as any).is_approved);
        }
      }

      // Fallback: detectar unidade pela vinculação
      if (!resolvedRole && allowedRoles.includes("lojista_unidade")) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("unit_store_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if ((prof as any)?.unit_store_id) {
          resolvedRole = "lojista_unidade";
          resolvedApproved = true; // unidades já vêm aprovadas
        }
      }

      if (!resolvedRole && allowedRoles.includes("motoboy")) {
        const { data: driver } = await supabase
          .from("drivers")
          .select("user_id, is_active")
          .eq("user_id", user.id)
          .maybeSingle();

        if (driver) {
          resolvedRole = "motoboy";
          resolvedApproved = Boolean((driver as any).is_active);
        } else {
          // Check if user is a store-linked driver
          const { data: storeDriver } = await supabase
            .from("store_drivers")
            .select("id")
            .eq("driver_user_id", user.id)
            .limit(1)
            .maybeSingle();

          if (storeDriver) {
            resolvedRole = "motoboy";
            resolvedApproved = true; // Store drivers are approved by the store owner
          }
        }
      }

      if (!resolvedRole) {
        if (allowedRoles.includes("cliente")) {
          setAuthorized(true);
        } else {
          toast.error("Acesso negado. Redirecionando...");
          navigate(redirectTo, { replace: true });
        }
        setChecking(false);
        return;
      }

      const role = resolvedRole;
      
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

      if (requireApproval && !resolvedApproved) {
        setAuthorized(false);
        setChecking(false);
        return;
      }

      setAuthorized(true);
      setChecking(false);
    };

    checkRole();
  }, [user?.id, authLoading, allowedRoles, redirectTo, navigate, requireApproval]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        {slow && (
          <>
            <p className="text-sm text-muted-foreground max-w-xs">
              Está demorando mais que o normal. Verifique sua conexão e tente novamente.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl text-sm"
            >
              Tentar novamente
            </button>
          </>
        )}
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-5">
          <Shield className="h-10 w-10 text-amber-500" />
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
