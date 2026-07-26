import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  loginWithBiometrics,
  disableBiometricLogin,
} from "@/lib/biometricAuth";
import { isCapacitorNative } from "@/lib/capacitorNative";

interface Props {
  onSuccess?: () => void;
}

/**
 * Shown only on Capacitor when the user has previously opted in to
 * biometric login. Reads stored credentials and signs the user in.
 */
const BiometricLoginButton = ({ onSuccess }: Props) => {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isCapacitorNative()) return;
      if (!isBiometricEnabled()) return;
      const available = await isBiometricAvailable();
      if (!cancelled) setShow(available);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const creds = await loginWithBiometrics();
      if (!creds) {
        setBusy(false);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (error) {
        // Credential no longer valid (password changed) — clear and ask to login again
        await disableBiometricLogin();
        toast.error("Sua senha mudou. Faça login com e-mail e senha.");
        setShow(false);
        return;
      }
      toast.success("Bem-vindo de volta!");
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível entrar com biometria.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-primary/5 text-primary font-semibold active:scale-[0.98] transition-all disabled:opacity-60"
    >
      <Fingerprint className="h-5 w-5" />
      {busy ? "Verificando..." : "Entrar com biometria"}
    </button>
  );
};

export default BiometricLoginButton;
