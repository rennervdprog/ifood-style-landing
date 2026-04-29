import { useEffect, useRef, useState, useCallback } from "react";
import { Bike, X, Volume2 } from "lucide-react";
import { isCapacitorNative, hapticFeedback } from "@/lib/capacitorNative";

interface DriverPersistentAlertProps {
  /** Number of available orders (not yet accepted) */
  availableCount: number;
  /** Whether driver currently has an active delivery */
  hasActiveDelivery: boolean;
  /** Whether driver is online */
  isOnline: boolean;
  /** Called when driver taps "Ver Entregas" */
  onReview: () => void;
}

const ALERT_SOUND_B64 =
  "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkYyEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTQ==";

 const RING_INTERVAL_MS = 4000; // ring every 4 seconds
 const VIBRATE_PATTERN = [300, 200, 300, 200, 600];

export default function DriverPersistentAlert({
  availableCount,
  hasActiveDelivery,
  isOnline,
  onReview,
}: DriverPersistentAlertProps) {
  const [dismissed, setDismissed] = useState(false);
  const [prevAvailableCount, setPrevAvailableCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ⚠️ NEVER alert when driver already has an active delivery or pending return.
  // This prevents sound/vibration/popup interruptions during ongoing deliveries.
  const shouldAlert = isOnline && availableCount > 0 && !hasActiveDelivery && !dismissed;

  // Reset dismissed only when a NEW order arrives AND driver is free
  useEffect(() => {
    if (availableCount > prevAvailableCount && availableCount > 0 && !hasActiveDelivery) {
      setDismissed(false);
    }
    setPrevAvailableCount(availableCount);
  }, [availableCount, prevAvailableCount, hasActiveDelivery]);

  // Force-stop ringing immediately if driver picks up a delivery mid-alert
  useEffect(() => {
    if (hasActiveDelivery && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      if (audioRef.current) {
        try { audioRef.current.pause(); audioRef.current.currentTime = 0; } catch {}
      }
      if ("vibrate" in navigator) navigator.vibrate(0);
    }
  }, [hasActiveDelivery]);

  // Reset dismissed when delivery finishes
  useEffect(() => {
    if (!hasActiveDelivery && availableCount > 0) {
      setDismissed(false);
    }
  }, [hasActiveDelivery, availableCount]);

  const ringOnce = useCallback(() => {
    // Sound
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(ALERT_SOUND_B64);
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}

    // Vibration (browser API)
    if ("vibrate" in navigator) {
      navigator.vibrate(VIBRATE_PATTERN);
    }

    // Capacitor haptics
    if (isCapacitorNative()) {
      hapticFeedback("heavy").catch(() => {});
      setTimeout(() => hapticFeedback("heavy").catch(() => {}), 300);
      setTimeout(() => hapticFeedback("heavy").catch(() => {}), 800);
    }
  }, []);

  // Persistent ringing loop
  useEffect(() => {
    if (shouldAlert) {
      ringOnce(); // immediate first ring
      intervalRef.current = setInterval(ringOnce, RING_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Stop vibration
      if ("vibrate" in navigator) navigator.vibrate(0);
    };
  }, [shouldAlert, ringOnce]);

  if (!shouldAlert) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="mx-4 w-full max-w-sm bg-card border-2 border-primary rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Pulsing background effect */}
        <div className="absolute inset-0 bg-primary/5 animate-pulse rounded-3xl" />

        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-muted flex items-center justify-center z-10"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="relative z-10 flex flex-col items-center text-center gap-4">
          {/* Animated icon */}
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-bounce">
            <Bike className="h-10 w-10 text-primary" />
          </div>

          {/* Sound indicator */}
          <div className="flex items-center gap-1.5 text-primary">
            <Volume2 className="h-4 w-4 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider">Alerta ativo</span>
          </div>

          <div>
            <h2 className="text-xl font-black text-foreground">
              {availableCount === 1 ? "Nova Entrega!" : `${availableCount} Entregas Disponíveis!`}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Toque para ver e aceitar
            </p>
          </div>

          <button
            onClick={() => {
              setDismissed(true);
              onReview();
            }}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-lg active:scale-95 transition-transform"
          >
            🏍️ Ver Entregas
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-muted-foreground underline"
          >
            Silenciar por agora
          </button>
        </div>
      </div>
    </div>
  );
}
