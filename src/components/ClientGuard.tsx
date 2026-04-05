import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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
