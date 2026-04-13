import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getStoreAppSlug } from "@/components/StoreAppGuard";

interface ClientGuardProps {
  children: React.ReactNode;
}

/**
 * Redirects lojistas and motoboys away from client pages
 * to their respective dashboards.
 */
const ClientGuard = ({ children }: ClientGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setChecked(true);
      return;
    }

    const checkRole = async () => {
      // If inside a white-label store app, don't redirect to partner dashboards
      const isStoreApp = !!getStoreAppSlug();
      if (isStoreApp) {
        setChecked(true);
        return;
      }

      // Admin can access any page, skip redirect
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (adminRole) {
        setChecked(true);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        const role = (profile as any).role as string;
        if (role === "lojista") {
          navigate("/admin", { replace: true });
          return;
        }
        if (role === "motoboy") {
          navigate("/entregador", { replace: true });
          return;
        }
      }
      setChecked(true);
    };

    checkRole();
  }, [user, authLoading, navigate]);

  if (authLoading || !checked) return null;

  return <>{children}</>;
};

export default ClientGuard;
