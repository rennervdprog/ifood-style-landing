import { useEffect, useState } from "react";
import { Bell, MapPin, Check } from "lucide-react";
import { isCapacitorNative, registerCapacitorPush, requestLocationPermission } from "@/lib/capacitorNative";
import { isPartnerCapacitorApp } from "@/lib/capacitorAppMode";

const STORAGE_KEY = "cap-permissions-onboarding-v4";

type Step = "notifications" | "location" | "done";

/**
 * Native-only onboarding shown once on first app launch (Capacitor).
 * Shows two friendly screens explaining WHY we need notifications and location,
 * and only triggers the OS permission dialog after the user taps "Entendi".
 */
const CapacitorPermissionsOnboarding = () => {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<Step>("notifications");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isCapacitorNative()) return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen) return;
    } catch {
      return;
    }
    // Small delay so splash/first paint settles
    const t = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(t);
  }, []);

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {}
    setShow(false);
  };

  const handleNotificationsAccept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await registerCapacitorPush();
    } catch (e) {
      console.warn("[PermOnboarding] notifications error:", e);
    } finally {
      setBusy(false);
      setStep("location");
    }
  };

  const handleLocationAccept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await requestLocationPermission();
    } catch (e) {
      console.warn("[PermOnboarding] location error:", e);
    } finally {
      setBusy(false);
      setStep("done");
      setTimeout(finish, 1200);
    }
  };

  const handleSkip = () => {
    if (step === "notifications") {
      setStep("location");
    } else if (step === "location") {
      setStep("done");
      setTimeout(finish, 1000);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pt-12">
        <div className={`h-1.5 rounded-full transition-all ${step === "notifications" ? "w-8 bg-primary" : "w-1.5 bg-muted"}`} />
        <div className={`h-1.5 rounded-full transition-all ${step === "location" ? "w-8 bg-primary" : "w-1.5 bg-muted"}`} />
        <div className={`h-1.5 rounded-full transition-all ${step === "done" ? "w-8 bg-primary" : "w-1.5 bg-muted"}`} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        {step === "notifications" && (
          <>
            <div className="w-28 h-28 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 animate-in zoom-in duration-500">
              <Bell className="h-14 w-14 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">Receba avisos do seu pedido</h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-sm">
              Ative as notificações para saber quando seu pedido for <strong className="text-foreground">confirmado</strong>, estiver <strong className="text-foreground">pronto</strong> ou <strong className="text-foreground">a caminho</strong>.
            </p>
            <p className="text-sm text-muted-foreground mt-4 max-w-sm">
              Sem isso, você pode perder atualizações importantes da sua entrega.
            </p>
          </>
        )}

        {step === "location" && (
          <>
            <div className="w-28 h-28 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 animate-in zoom-in duration-500">
              <MapPin className="h-14 w-14 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">Entrega no endereço certo</h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-sm">
              Usamos sua localização para <strong className="text-foreground">calcular a taxa de entrega</strong> e ajudar o entregador a chegar no <strong className="text-foreground">local exato</strong>.
            </p>
            <p className="text-sm text-muted-foreground mt-4 max-w-sm">
              Sua localização é usada apenas durante o pedido.
            </p>
          </>
        )}

        {step === "done" && (
          <>
            <div className="w-28 h-28 rounded-3xl bg-emerald-500/10 flex items-center justify-center mb-8 animate-in zoom-in duration-500">
              <Check className="h-14 w-14 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">Tudo pronto!</h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-sm">
              Você já pode começar a fazer seus pedidos.
            </p>
          </>
        )}
      </div>

      {step !== "done" && (
        <div className="px-6 pb-10 pt-4 space-y-3">
          <button
            onClick={step === "notifications" ? handleNotificationsAccept : handleLocationAccept}
            disabled={busy}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl text-base active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {busy ? "Aguarde..." : "Entendi, permitir"}
          </button>
          <button
            onClick={handleSkip}
            disabled={busy}
            className="w-full text-muted-foreground font-medium py-3 text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            Agora não
          </button>
        </div>
      )}
    </div>
  );
};

export default CapacitorPermissionsOnboarding;
