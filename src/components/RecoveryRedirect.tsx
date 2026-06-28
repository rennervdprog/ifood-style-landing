import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

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
    const check = () => {
      const hash = window.location.hash || "";
      if (hash.includes("type=recovery")) {
        navigate("/auth?mode=reset", { replace: true });
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [navigate]);

  return null;
};

export default RecoveryRedirect;