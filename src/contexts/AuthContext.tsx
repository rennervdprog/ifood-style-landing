import React, { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, supabase } from "@/integrations/supabase/client";
import { requestPushPermissionAndRegister, onForegroundMessage } from "@/lib/firebase";
import { registerGoNativePlayer } from "@/lib/gonative";
import { registerCapacitorPush, isCapacitorNative, reclaimStoredToken, resetPushRegistrationState } from "@/lib/capacitorNative";
import { clearStoredPushState } from "@/lib/pushSession";
import { getDeviceId } from "@/lib/deviceSession";
import { setUser as setSentryUser } from "@/lib/sentry";
import { toast } from "sonner";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEVICE_CHECK_INTERVAL = 60_000; // 60s (was 30s — less aggressive)

const REMEMBER_FLAG = "itasuper_remember";
const REMEMBER_UNTIL = "itasuper_remember_until";
const SESSION_ALIVE_KEY = "itasuper_session_alive";

/**
 * Enforce the user's "Lembrar-me" choice BEFORE restoring the session.
 * - remember=1 + expired → sign out (>2 months since login).
 * - remember=0 + no session-alive marker → tab/app was closed → sign out.
 * Returns true when the stored session was invalidated and must not be restored.
 */
const enforceRememberMe = async (): Promise<boolean> => {
  try {
    const remember = localStorage.getItem(REMEMBER_FLAG);
    const alive = sessionStorage.getItem(SESSION_ALIVE_KEY);
    const until = localStorage.getItem(REMEMBER_UNTIL);
    let shouldSignOut = false;
    if (remember === "1" && until && Date.now() > Number(until)) shouldSignOut = true;
    if (remember === "0" && !alive) shouldSignOut = true;
    if (shouldSignOut) {
      await supabase.auth.signOut();
      localStorage.removeItem(REMEMBER_FLAG);
      localStorage.removeItem(REMEMBER_UNTIL);
      return true;
    }
    // Mark this tab/app session as alive so reloads keep the user logged in.
    if (remember) sessionStorage.setItem(SESSION_ALIVE_KEY, "1");
    return false;
  } catch {
    return false;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const deviceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRestoredRef = useRef(false);
  const deviceCheckFailCountRef = useRef(0);

  // Register this device as the active one for the user
  const registerDevice = async () => {
    const deviceId = getDeviceId();
    try {
      await supabase.rpc("register_device_login", { _device_id: deviceId });
      console.log("[Auth] 📱 Device registered:", deviceId.slice(0, 8));
    } catch (e) {
      console.warn("[Auth] Failed to register device:", e);
    }
  };

  // Check if this device is still the active one; if not, sign out
  const checkDeviceStillActive = async () => {
    // Don't check if no session
    if (!currentUserIdRef.current) return;

    const deviceId = getDeviceId();
    try {
      const { data: isActive, error } = await supabase.rpc("check_device_active", {
        _device_id: deviceId,
      });
      if (error) {
        console.warn("[Auth] Device check error:", error);
        // Don't sign out on transient errors — increment fail count
        deviceCheckFailCountRef.current += 1;
        // Only act after 3 consecutive failures
        if (deviceCheckFailCountRef.current >= 3) {
          console.warn("[Auth] Multiple device check failures, but keeping session.");
        }
        return;
      }
      // Reset fail count on success
      deviceCheckFailCountRef.current = 0;

      if (isActive === false) {
        console.log("[Auth] 🚫 Device no longer active, signing out...");
        toast.error("Sua conta foi acessada em outro dispositivo. Você foi desconectado.");
        stopDeviceCheck();
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn("[Auth] Device check failed:", e);
    }
  };

  const startDeviceCheck = () => {
    stopDeviceCheck();
    deviceCheckRef.current = setInterval(checkDeviceStillActive, DEVICE_CHECK_INTERVAL);
  };

  const stopDeviceCheck = () => {
    if (deviceCheckRef.current) {
      clearInterval(deviceCheckRef.current);
      deviceCheckRef.current = null;
    }
  };

  useEffect(() => {
    // CRITICAL: Restore session from storage FIRST, then set up listener.
    // This prevents the race condition where onAuthStateChange fires 
    // INITIAL_SESSION before the stored session is fully hydrated.
    
    enforceRememberMe().then(() => supabase.auth.getSession()).then(({ data: { session: restoredSession } }) => {
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
        registerDevice().then(() => startDeviceCheck());
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
        stopDeviceCheck();
        if (!isCapacitorNative()) {
          clearStoredPushState();
        }
        if (isCapacitorNative()) {
          resetPushRegistrationState();
        }
      }

      // Register device on explicit sign in (not token refresh)
      if (event === "SIGNED_IN" && nextUserId) {
        registerDevice().then(() => startDeviceCheck());
      }

      // On token refresh, just ensure device check is running
      if (event === "TOKEN_REFRESHED" && nextUserId) {
        if (!deviceCheckRef.current) {
          startDeviceCheck();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      stopDeviceCheck();
    };
  }, []);

  // Also check on visibility change (tab focus) — but with debounce
  useEffect(() => {
    if (!session?.user) return;

    let lastCheck = 0;
    const DEBOUNCE_MS = 10_000; // Don't check more than once per 10s

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && session?.user) {
        const now = Date.now();
        if (now - lastCheck < DEBOUNCE_MS) return;
        lastCheck = now;
        checkDeviceStillActive();
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
      registerGoNativePlayer().catch(console.error);
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

      requestPushPermissionAndRegister().catch(console.error);
      syncCurrentPushDevice();

      onForegroundMessage((payload) => {
        const title = payload.notification?.title || "ItaSuper";
        const body = payload.notification?.body || "";
        const orderId = payload.data?.order_id;
        
        toast(title, {
          description: body,
          action: orderId
            ? {
                label: "Ver Pedido",
                onClick: () => {
                  window.location.href = `/pedidos`;
                },
              }
            : undefined,
        });

        if ("vibrate" in navigator) {
          navigator.vibrate([200, 100, 200]);
        }
      });
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
    stopDeviceCheck();
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