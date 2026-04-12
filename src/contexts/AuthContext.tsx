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

      // Account switch on same device — the new session must immediately re-claim this device.
      // Do not try to delete the previous user's rows client-side here because the session
      // has already changed and RLS may block deleting another user's registrations.
      if (previousUserId && previousUserId !== nextUserId) {
        if (isCapacitorNative()) {
          resetPushRegistrationState();
        }
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
        // Re-bind this physical device to the current user immediately after login/account switch.
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

    // Immediate sync removes any old account binding as fast as possible.
    syncCurrentPushDevice();

    // Small delay only for permission prompts so we don't block initial render.
    const timer = setTimeout(() => {
      if (isCapacitorNative()) {
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
