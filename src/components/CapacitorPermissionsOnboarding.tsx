import { useEffect, useState } from "react";
import { Bell, Star, Store, Check } from "lucide-react";
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
      {/* Header */}
      <div className="pt-[max(env(safe-area-inset-top),16px)] pb-4 text-center">
        <span className="text-[13px] font-bold tracking-[0.18em] text-foreground/80">BEM-VINDO</span>
      </div>

      {/* Illustration + content */}
      <div className="flex-1 flex flex-col items-center px-6 pt-6">
        {step === "notifications" ? (
          <NotificationsIllustration partner={isPartnerCapacitorApp()} />
        ) : step === "location" ? (
          <LocationIllustration partner={isPartnerCapacitorApp()} />
        ) : (
          <div className="w-28 h-28 rounded-3xl bg-emerald-500/10 flex items-center justify-center mt-8 animate-in zoom-in duration-500">
            <Check className="h-14 w-14 text-emerald-500" />
          </div>
        )}

        <div className="mt-10 text-center max-w-sm">
          {step === "notifications" && (
            <>
              <h1 className="text-[26px] leading-tight font-extrabold text-foreground">
                Permitir notificações
              </h1>
              <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">
                {isPartnerCapacitorApp()
                  ? "Para receber novos pedidos e avisos importantes da sua loja"
                  : "Para acompanhar seus pedidos e receber novidades"}
              </p>
            </>
          )}
          {step === "location" && (
            <>
              <h1 className="text-[26px] leading-tight font-extrabold text-foreground">
                Permitir localização
              </h1>
              <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">
                {isPartnerCapacitorApp()
                  ? "Para calcular rotas e taxas de entrega com precisão"
                  : "Para descobrir lojas que entregam na sua região"}
              </p>
            </>
          )}
          {step === "done" && (
            <>
              <h1 className="text-[26px] leading-tight font-extrabold text-foreground">
                Tudo pronto!
              </h1>
              <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">
                {isPartnerCapacitorApp()
                  ? "Você já pode começar a gerenciar sua loja."
                  : "Você já pode começar a fazer seus pedidos."}
              </p>
            </>
          )}
        </div>
      </div>

      {step !== "done" && (
        <div className="px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">
          {step === "notifications" ? (
            <button
              onClick={handleNotificationsAccept}
              disabled={busy}
              className="w-full bg-primary text-primary-foreground font-bold py-[18px] rounded-2xl text-[16px] active:scale-[0.98] transition-transform disabled:opacity-60 shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.5)]"
            >
              {busy ? "Aguarde..." : "Continuar"}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleSkip}
                disabled={busy}
                className="w-full bg-background border border-border text-primary font-bold py-[18px] rounded-2xl text-[16px] active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                Pular
              </button>
              <button
                onClick={handleLocationAccept}
                disabled={busy}
                className="w-full bg-primary text-primary-foreground font-bold py-[18px] rounded-2xl text-[16px] active:scale-[0.98] transition-transform disabled:opacity-60 shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.5)]"
              >
                {busy ? "..." : "Permitir"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Illustrations (iFood-style: skeleton card + floating real card) ─── */

const SkeletonCard = ({ children }: { children?: React.ReactNode }) => (
  <div className="w-full max-w-[300px] rounded-3xl border border-border/60 bg-card px-5 pt-6 pb-10 mx-auto">
    {children}
  </div>
);

const SkelLine = ({ w = "70%", tone = "muted" }: { w?: string; tone?: "muted" | "primary" }) => (
  <div
    className="h-2.5 rounded-full"
    style={{
      width: w,
      background: tone === "primary" ? "hsl(var(--primary) / 0.18)" : "hsl(var(--accent))",
    }}
  />
);

const NotificationsIllustration = ({ partner }: { partner: boolean }) => (
  <div className="relative w-full max-w-[340px] mt-2">
    <SkeletonCard>
      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-accent" />
            <div className="flex-1 space-y-1.5">
              <SkelLine w={i % 2 ? "82%" : "60%"} />
            </div>
          </div>
        ))}
      </div>
    </SkeletonCard>

    {/* Floating notification */}
    <div className="absolute left-2 right-2 -bottom-2 rounded-2xl bg-card border border-border shadow-[0_12px_30px_-12px_rgba(0,0,0,0.25)] px-4 py-3 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <Bell className="h-5 w-5 text-primary-foreground" fill="currentColor" />
        </div>
        <span className="flex-1 text-[13px] font-bold tracking-wider text-foreground">
          ITASUPER
        </span>
        <span className="text-[12px] text-muted-foreground">agora</span>
      </div>
      <p className="mt-1.5 text-[14px] text-foreground/90 font-medium">
        {partner ? "Você recebeu um novo pedido!" : "Seu pedido saiu para entrega!"}
      </p>
    </div>
  </div>
);

const LocationIllustration = ({ partner }: { partner: boolean }) => (
  <div className="relative w-full max-w-[340px] mt-2">
    <SkeletonCard>
      <div className="space-y-5">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-accent shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <SkelLine w="78%" />
              <SkelLine w={i ? "52%" : "62%"} tone="primary" />
            </div>
            <Star className="h-4 w-4 text-amber-400 mt-1" fill="currentColor" />
          </div>
        ))}
      </div>
    </SkeletonCard>

    {/* Floating store card */}
    <div className="absolute left-2 right-2 -bottom-4 rounded-2xl bg-card border border-border shadow-[0_12px_30px_-12px_rgba(0,0,0,0.25)] px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-500">
      <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
        <Store className="h-6 w-6 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[15px] text-foreground truncate">
            {partner ? "Sua Loja" : "Hamburgueria"}
          </span>
          <span className="flex items-center gap-0.5 text-[13px] font-semibold text-amber-500 shrink-0">
            <Star className="h-3.5 w-3.5" fill="currentColor" /> 4,8
          </span>
        </div>
        <p className="text-[12.5px] text-muted-foreground truncate">
          Lanches • 30-40 min
        </p>
        <span className="mt-1 inline-block text-[11px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
          Entrega grátis
        </span>
      </div>
    </div>
  </div>
);

export default CapacitorPermissionsOnboarding;
