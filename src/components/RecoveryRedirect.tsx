import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Supabase recovery e-mails redirect to the Site URL (root) with a hash like
 * `#access_token=...&type=recovery&...`. This component watches for that hash
 * anywhere in the app and forwards the user to /auth?mode=reset so they can
 * actually set a new password. The Supabase JS client auto-consumes the hash
 * to establish the session, so updateUser({ password }) works on the next step.
 */
const RecoveryRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const goToReset = () => {
      if (cancelled) return;
      // Limpa o hash/query do recovery antes de navegar para a tela de nova senha
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch {}
      navigate("/auth?mode=reset", { replace: true });
    };

    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const isRecoveryHash = hash.includes("type=recovery");
    const isRecoveryCode = /[?&]code=/.test(search) && /[?&]type=recovery/.test(search);

    // Caso PKCE: troca o code por sessão antes de redirecionar
    if (isRecoveryCode) {
      supabase.auth
        .exchangeCodeForSession(window.location.href)
        .catch(() => {})
        .finally(goToReset);
      return;
    }

    if (isRecoveryHash) {
      // Implicit flow: aguarda o supabase-js consumir o hash e disparar o evento
      // PASSWORD_RECOVERY antes de navegar (para não perder os tokens).
      const sub = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          sub.data.subscription.unsubscribe();
          goToReset();
        }
      });
      // Fallback: se em 1.5s o evento não veio, redireciona mesmo assim
      const t = setTimeout(() => {
        sub.data.subscription.unsubscribe();
        goToReset();
      }, 1500);
      return () => {
        cancelled = true;
        clearTimeout(t);
        sub.data.subscription.unsubscribe();
      };
    }

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return null;
};

export default RecoveryRedirect;