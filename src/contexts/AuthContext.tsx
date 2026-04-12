import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { requestPushPermissionAndRegister, onForegroundMessage } from "@/lib/firebase";
import { registerGoNativePlayer } from "@/lib/gonative";
import { registerCapacitorPush, isCapacitorNative, reclaimStoredToken, resetPushRegistrationState } from "@/lib/capacitorNative";
import { clearStoredPushState } from "@/lib/pushSession";
import { toast } from "sonner";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const previousUserId = currentUserIdRef.current;
      const nextUserId = session?.user?.id ?? null;

      currentUserIdRef.current = nextUserId;
      setSession(session);
      setLoading(false);

      // Account switch on same device — cleanup old user's push tokens
      if (previousUserId && previousUserId !== nextUserId) {
        void cleanupPushTokens(previousUserId);
        // Reset Capacitor push state so the new user gets fresh registration
        if (isCapacitorNative()) {
          resetPushRegistrationState();
        }
        return;
      }

      if (event === "SIGNED_OUT" && previousUserId) {
        void cleanupPushTokens(previousUserId);
        clearStoredPushState();
        if (isCapacitorNative()) {
          resetPushRegistrationState();
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      currentUserIdRef.current = session?.user?.id ?? null;
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Register push notifications when user logs in
  useEffect(() => {
    if (!session?.user) return;

    const syncCurrentPushDevice = () => {
      if (isCapacitorNative()) {
        // Always re-claim stored token first (instant), then re-register
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

      // Small delay to not block initial render
      const timer = setTimeout(() => {
        if (isCapacitorNative()) {
          // On Capacitor, request permission on first login and always re-claim
          registerCapacitorPush({ requestPermission: true }).catch(console.error);
          return;
        }

        requestPushPermissionAndRegister().catch(console.error);
        syncCurrentPushDevice();

        // Firebase web foreground messages — only on web
        onForegroundMessage((payload) => {
          const title = payload.notification?.title || "ItaSuper";
          const body = payload.notification?.body || "";
          const orderId = payload.data?.order_id;
          
          toast(title, {
            description: body,
            action: orderId
              ? {
                  label: "Abrir Chat",
                  onClick: () => {
                    window.location.href = `/pedidos?chat=${orderId}`;
                  },
                }
              : undefined,
          });

          if ("vibrate" in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
        });
      }, 2000);

    // Only retry on visibility change, no polling interval
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

  const signOut = async () => {
    const userId = currentUserIdRef.current || session?.user?.id || undefined;
    await cleanupPushTokens(userId);
    clearStoredPushState();
    if (isCapacitorNative()) {
      resetPushRegistrationState();
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
