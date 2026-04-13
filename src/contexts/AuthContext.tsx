import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { requestPushPermissionAndRegister, onForegroundMessage } from "@/lib/firebase";
import { registerGoNativePlayer } from "@/lib/gonative";
import { registerCapacitorPush, isCapacitorNative, reclaimStoredToken, resetPushRegistrationState } from "@/lib/capacitorNative";
import { clearStoredPushState } from "@/lib/pushSession";
import { getDeviceId } from "@/lib/deviceSession";
import { toast } from "sonner";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEVICE_CHECK_INTERVAL = 30_000; // 30s

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const deviceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const deviceId = getDeviceId();
    try {
      const { data: isActive, error } = await supabase.rpc("check_device_active", {
        _device_id: deviceId,
      });
      if (error) {
        console.warn("[Auth] Device check error:", error);
        return;
      }
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const previousUserId = currentUserIdRef.current;
      const nextUserId = session?.user?.id ?? null;
      const nextEmail = session?.user?.email ?? "null";

      console.log(`[Auth] 🔍 onAuthStateChange: event=${event}, prev=${previousUserId?.slice(0,8) || "null"}, next=${nextUserId?.slice(0,8) || "null"} (${nextEmail})`);

      currentUserIdRef.current = nextUserId;
      setSession(session);
      setLoading(false);

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

      // Register device on sign in
      if (event === "SIGNED_IN" && nextUserId) {
        registerDevice().then(() => startDeviceCheck());
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      currentUserIdRef.current = session?.user?.id ?? null;
      setSession(session);
      setLoading(false);

      // If already logged in, register device and start checking
      if (session?.user) {
        registerDevice().then(() => startDeviceCheck());
      }
    });

    return () => {
      subscription.unsubscribe();
      stopDeviceCheck();
    };
  }, []);

  // Also check on visibility change (tab focus)
  useEffect(() => {
    if (!session?.user) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && session?.user) {
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
    stopDeviceCheck();
    if (!isCapacitorNative()) {
      await cleanupPushTokens(userId);
      clearStoredPushState();
    }
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
