import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { requestPushPermissionAndRegister, onForegroundMessage } from "@/lib/firebase";
import { registerGoNativePlayer } from "@/lib/gonative";
import { registerCapacitorPush, isCapacitorNative } from "@/lib/capacitorNative";
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Register push notifications when user logs in
  useEffect(() => {
    if (!session?.user) return;

    const registerNativePush = () => {
      registerGoNativePlayer().catch(console.error);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        registerNativePush();
      }
    };

    // Small delay to not block initial render
    const timer = setTimeout(() => {
      // Capacitor native push (takes priority)
      if (isCapacitorNative()) {
        registerCapacitorPush().catch(console.error);
        // Do NOT initialize Firebase web messaging on native — it crashes the app
      } else {
        requestPushPermissionAndRegister().catch(console.error);
        registerNativePush();

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
      }
    }, 2000);

    // Only retry on visibility change, no polling interval
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session?.user?.id]);

  const signOut = async () => {
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
