import React, { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, supabase } from "@/integrations/supabase/client";
// Firebase Web SDK (~150KB) + GoNative helpers ficam fora do bundle crítico.
// São carregados via dynamic import apenas quando NÃO estamos em Capacitor
// (no APK nativo push é @capacitor/push-notifications, Firebase Web nunca roda).
import { registerCapacitorPush, isCapacitorNative, reclaimStoredToken, resetPushRegistrationState } from "@/lib/capacitorNative";
import { clearStoredPushState } from "@/lib/pushSession";
import { setUser as setSentryUser } from "@/lib/sentry";
import { queryClient } from "@/lib/queryClient";
import { USER_ROUTING_QUERY_KEY } from "@/hooks/useUserRouting";
import { toast } from "sonner";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Chaves legadas do sistema antigo "Lembrar-me" — mantidas apenas para limpeza.
const REMEMBER_FLAG = "itasuper_remember";
const REMEMBER_UNTIL = "itasuper_remember_until";
const SESSION_ALIVE_KEY = "itasuper_session_alive";
const REFRESH_INTERVAL = 30 * 60_000; // 30 min — refresh proativo do token

/**
 * Limpa artefatos do antigo sistema de expiração "Lembrar-me".
 * A partir da v1.10.399 a sessão é perpétua para todos os perfis: usuário só
 * sai por clique explícito em "Sair" ou por troca de senha.
 */
const clearLegacyRememberMeArtifacts = () => {
  try {
    localStorage.removeItem(REMEMBER_FLAG);
    localStorage.removeItem(REMEMBER_UNTIL);
    sessionStorage.removeItem(SESSION_ALIVE_KEY);
  } catch {}
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRestoredRef = useRef(false);
  // Multi-device liberado — sessões simultâneas permitidas em todos os perfis.
  // Nenhum device tracking / kick-out.

  // Refresh proativo do JWT enquanto o app está visível
  const startProactiveRefresh = () => {
    if (refreshIntervalRef.current) return;
    refreshIntervalRef.current = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      supabase.auth.refreshSession().catch((e) => {
        console.warn("[Auth] proactive refreshSession failed:", e);
      });
    }, REFRESH_INTERVAL);
  };
  const stopProactiveRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  useEffect(() => {
    // CRITICAL: Restore session from storage FIRST, then set up listener.
    // This prevents the race condition where onAuthStateChange fires 
    // INITIAL_SESSION before the stored session is fully hydrated.
    clearLegacyRememberMeArtifacts();

    supabase.auth.getSession().then(async ({ data: { session: restoredSession }, error }) => {
      // Se o token salvo estiver corrompido (bad_jwt de projeto antigo), limpa e segue.
      if (error) {
        const msg = (error.message || "").toLowerCase();
        const isFatal =
          msg.includes("bad_jwt") ||
          msg.includes("invalid_grant") ||
          msg.includes("refresh_token_not_found") ||
          msg.includes("invalid refresh token");
        if (isFatal) {
          console.warn("[Auth] getSession fatal error, clearing local session:", error.message);
          try { await supabase.auth.signOut({ scope: "local" as any }); } catch {}
        } else {
          // Erro transitório (rede, timeout, 5xx) — NÃO desloga.
          console.warn("[Auth] getSession transient error, keeping session:", error.message);
        }
      }
      console.log("[Auth] 🔄 Session restored from storage:", restoredSession?.user?.email ?? "none");
      try {
        (supabase.realtime as any).setAuth?.(restoredSession?.access_token ?? SUPABASE_ANON_KEY);
      } catch {}
      currentUserIdRef.current = restoredSession?.user?.id ?? null;
      setSession(restoredSession);
      setLoading(false);
      sessionRestoredRef.current = true;

      if (restoredSession?.user) {
        setSentryUser({ id: restoredSession.user.id, email: restoredSession.user.email });
        startProactiveRefresh();
      }
    });

    // Set up listener AFTER getSession to handle subsequent auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      const previousUserId = currentUserIdRef.current;
      const nextUserId = newSession?.user?.id ?? null;
      const nextEmail = newSession?.user?.email ?? "null";

      console.log(`[Auth] 🔍 onAuthStateChange: event=${event}, prev=${previousUserId?.slice(0,8) || "null"}, next=${nextUserId?.slice(0,8) || "null"} (${nextEmail})`);

      // Skip INITIAL_SESSION if we already restored — getSession handles it
      if (event === "INITIAL_SESSION" && sessionRestoredRef.current) {
        console.log("[Auth] ⏭️ Skipping INITIAL_SESSION (already restored via getSession)");
        // Still update session in case token was refreshed
        if (newSession) {
          try {
            (supabase.realtime as any).setAuth?.(newSession.access_token ?? SUPABASE_ANON_KEY);
          } catch {}
          setSession(newSession);
          currentUserIdRef.current = nextUserId;
        }
        return;
      }

      try {
        (supabase.realtime as any).setAuth?.(newSession?.access_token ?? SUPABASE_ANON_KEY);
      } catch {}
      currentUserIdRef.current = nextUserId;
      setSession(newSession);
      setLoading(false);

      if (newSession?.user) {
        setSentryUser({ id: newSession.user.id, email: newSession.user.email });
      } else {
        setSentryUser(null);
      }

      if (previousUserId && previousUserId !== nextUserId) {
        if (isCapacitorNative()) {
          resetPushRegistrationState();
        }
      }

      if (event === "SIGNED_OUT" && previousUserId) {
        stopProactiveRefresh();
        try {
          localStorage.removeItem(`itasuper:userRole:${previousUserId}`);
          localStorage.removeItem(`itasuper:userPlan:${previousUserId}`);
        } catch {}
        try { queryClient.removeQueries({ queryKey: [USER_ROUTING_QUERY_KEY] }); } catch {}
        if (!isCapacitorNative()) {
          clearStoredPushState();
        }
        if (isCapacitorNative()) {
          resetPushRegistrationState();
        }
      }

      // Register device on explicit sign in (not token refresh)
      if (event === "SIGNED_IN" && nextUserId) {
        try { queryClient.invalidateQueries({ queryKey: [USER_ROUTING_QUERY_KEY, nextUserId] }); } catch {}
        startProactiveRefresh();
      }

    });

    return () => {
      subscription.unsubscribe();
      stopProactiveRefresh();
    };
  }, []);

  // 📱 Capacitor App resume: `visibilitychange` não dispara de forma
  // confiável no Android nativo. Escutar `App.resume` garante refresh do JWT
  // quando o usuário volta ao app depois de horas/dias em background.
  // Se o refresh falhar por rede, NÃO desloga — reagenda retry (5s, 15s, 45s).
  useEffect(() => {
    if (!isCapacitorNative()) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let sub: { remove: () => void } | null = null;

    const tryRefresh = async (attempt = 0) => {
      if (cancelled) return;
      try {
        const { error } = await supabase.auth.refreshSession();
        if (error) throw error;
      } catch (e: any) {
        const msg = (e?.message || "").toLowerCase();
        const isFatal =
          msg.includes("bad_jwt") ||
          msg.includes("invalid_grant") ||
          msg.includes("refresh_token_not_found") ||
          msg.includes("invalid refresh token");
        if (isFatal) {
          console.warn("[Auth] resume refresh fatal:", e?.message);
          return; // Supabase JS já vai emitir SIGNED_OUT
        }
        // Transiente — retry backoff 5s, 15s, 45s
        const delays = [5_000, 15_000, 45_000];
        if (attempt < delays.length) {
          retryTimer = setTimeout(() => tryRefresh(attempt + 1), delays[attempt]);
        }
      }
    };

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("resume", () => tryRefresh(0));
        if (cancelled) { handle.remove(); return; }
        sub = handle;
      } catch (e) {
        console.warn("[Auth] failed to attach App.resume listener:", e);
      }
    })();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (sub) { try { sub.remove(); } catch {} }
    };
  }, []);

  // Also check on visibility change (tab focus) — but with debounce
  useEffect(() => {
    if (!session?.user) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && session?.user) {
        // Ao voltar do background, força um refresh do JWT para evitar
        // que a próxima query use um token já expirado.
        supabase.auth.refreshSession().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [session?.user?.id]);

  // Register push notifications when user logs in
  useEffect(() => {
    if (!session?.user) return;

    const syncCurrentPushDevice = () => {
      if (isCapacitorNative()) {
        reclaimStoredToken().catch(console.error);
        registerCapacitorPush({ requestPermission: false }).catch(console.error);
        return;
      }
      import("@/lib/gonative")
        .then(({ registerGoNativePlayer }) => registerGoNativePlayer().catch(console.error))
        .catch(console.error);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncCurrentPushDevice();
      }
    };

    syncCurrentPushDevice();

    const timer = setTimeout(() => {
      if (isCapacitorNative()) {
        registerCapacitorPush({ requestPermission: true }).catch(console.error);
        return;
      }

      // Web: importar Firebase sob demanda, nunca no boot do APK.
      import("@/lib/firebase").then(({ requestPushPermissionAndRegister, onForegroundMessage }) => {
        requestPushPermissionAndRegister().catch(console.error);
        syncCurrentPushDevice();
        onForegroundMessage((payload) => {
          const title = payload.notification?.title || "ItaSuper";
          const body = payload.notification?.body || "";
          const orderId = payload.data?.order_id;
          toast(title, {
            description: body,
            action: orderId
              ? { label: "Ver Pedido", onClick: () => { window.location.href = `/pedidos`; } }
              : undefined,
          });
          if ("vibrate" in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
        });
      }).catch(console.error);
    }, isCapacitorNative() ? 300 : 2000);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session?.user?.id]);

  const cleanupPushTokens = async (userIdOverride?: string) => {
    try {
      const userId = userIdOverride || currentUserIdRef.current || session?.user?.id;
      if (userId) {
        await Promise.all([
          supabase.from("fcm_tokens").delete().eq("user_id", userId),
          supabase.from("onesignal_players").delete().eq("user_id", userId),
        ]);
      }
    } catch (e) {
      console.warn("[Auth] Failed to clean push registrations:", e);
    }
  };

  const signOut = useCallback(async () => {
    const userId = currentUserIdRef.current || session?.user?.id || undefined;
    if (!isCapacitorNative()) {
      await cleanupPushTokens(userId);
      clearStoredPushState();
    }
    if (isCapacitorNative()) {
      resetPushRegistrationState();
    }
    await supabase.auth.signOut();
    try {
      localStorage.removeItem(REMEMBER_FLAG);
      localStorage.removeItem(REMEMBER_UNTIL);
      sessionStorage.removeItem(SESSION_ALIVE_KEY);
    } catch {}
  }, [session?.user?.id]);

  const contextValue = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
    signOut,
  }), [session, loading, signOut]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};