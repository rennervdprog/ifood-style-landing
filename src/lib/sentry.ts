import * as Sentry from "@sentry/react";

export const initSentry = () => {
  const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

  if (!SENTRY_DSN) {
    console.warn("[Sentry] DSN não encontrado. O monitoramento de erros está desativado.");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: import.meta.env.MODE === "production" ? 0.2 : 1.0, // 20% em prod — economiza cota
    tracePropagationTargets: ["localhost", /^https:\/\/qkjhguziuchqsbxzruea\.supabase\.co/],
    replaysSessionSampleRate: 0.1, 
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
  });

  console.log("[Sentry] Monitoramento de erros inicializado.");
};

export const setUser = (user: { id: string; email?: string } | null) => {
  Sentry.setUser(user);
};

export const logError = (error: any, context?: Record<string, any>) => {
  console.error("[Log] Error captured:", error, context);
  Sentry.captureException(error, { extra: context });
};

export const logMessage = (message: string, level: Sentry.SeverityLevel = "info") => {
  Sentry.captureMessage(message, level);
};

// ── Web Vitals (Fase 6 do Plano de Performance) ──────────────────────────
// Envia LCP, INP, CLS, FCP, TTFB para o Sentry como medidas de performance
// Permite monitorar p75 por rota no dashboard do Sentry
export const initWebVitals = () => {
  // Só roda no browser, nunca bloqueia o carregamento inicial
  if (typeof window === "undefined") return;
  if (typeof document === "undefined") return;
  // Esperar o documento estar pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initWebVitals(), { once: true });
    return;
  }
  // Importação dinâmica — não bloqueia o carregamento inicial
  import("web-vitals").then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
    const sendVital = (name: string, value: number, rating: string) => {
      Sentry.addBreadcrumb({
        category: "web-vitals",
        message: `${name}: ${Math.round(value)}ms (${rating})`,
        level: rating === "good" ? "info" : rating === "needs-improvement" ? "warning" : "error",
        data: { name, value: Math.round(value), rating, path: window.location.pathname },
      });
      // Enviar como transaction measurement para aparecer no Performance do Sentry
      const transaction = Sentry.getActiveSpan();
      if (transaction) {
        Sentry.setMeasurement(name.toLowerCase(), value, name === "CLS" ? "" : "millisecond");
      }
    };

    onLCP((m) => sendVital("LCP", m.value, m.rating));
    onINP((m) => sendVital("INP", m.value, m.rating));
    onCLS((m) => sendVital("CLS", m.value * 1000, m.rating)); // CLS é adimensional, normalizar
    onFCP((m) => sendVital("FCP", m.value, m.rating));
    onTTFB((m) => sendVital("TTFB", m.value, m.rating));
  }).catch(() => {
    // web-vitals não disponível — ignorar silenciosamente
  });
};
