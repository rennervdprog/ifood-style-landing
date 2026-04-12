import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isCapacitorNative, registerCapacitorPush } from "@/lib/capacitorNative";

const NotificationPrompt = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;

    // For Capacitor native, check push permission status
    if (isCapacitorNative()) {
      import("@capacitor/push-notifications").then(({ PushNotifications }) => {
        PushNotifications.checkPermissions().then((result) => {
          if (result.receive === "prompt" || result.receive === "prompt-with-rationale") {
            const dismissed = localStorage.getItem("notif-prompt-dismissed");
            if (dismissed && Date.now() - Number(dismissed) < 3 * 24 * 60 * 60 * 1000) return;
            setTimeout(() => setShow(true), 3000);
          }
        });
      });
      return;
    }

    // Web: check browser Notification API
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") return;
    if (Notification.permission === "denied") return;

    // Don't show in iframe/preview
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    const dismissed = localStorage.getItem("notif-prompt-dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 3 * 24 * 60 * 60 * 1000) return;

    const timer = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(timer);
  }, [user]);

  const handleEnable = async () => {
    console.log("[NotifPrompt] handleEnable called, isCapacitorNative:", isCapacitorNative());
    try {
      if (isCapacitorNative()) {
        console.log("[NotifPrompt] Calling registerCapacitorPush...");
        const token = await registerCapacitorPush();
        console.log("[NotifPrompt] registerCapacitorPush result:", token ? "got token" : "no token");
      } else {
        console.log("[NotifPrompt] Calling web requestPushPermissionAndRegister...");
        const { requestPushPermissionAndRegister } = await import("@/lib/firebase");
        await requestPushPermissionAndRegister();
      }
      setShow(false);
    } catch (error) {
      console.error("[NotifPrompt] handleEnable CRASHED:", error);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("notif-prompt-dismissed", String(Date.now()));
  };

  if (!show) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 bg-card border border-border rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-4">
      <button onClick={handleDismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-foreground">Ative as notificações!</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Saiba quando seu pedido está pronto ou a caminho.</p>
        </div>
        <button
          onClick={handleEnable}
          className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm whitespace-nowrap active:scale-95 transition-transform"
        >
          Ativar
        </button>
      </div>
    </div>
  );
};

export default NotificationPrompt;
