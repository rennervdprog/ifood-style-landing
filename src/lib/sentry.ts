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
    tracesSampleRate: 1.0, 
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
