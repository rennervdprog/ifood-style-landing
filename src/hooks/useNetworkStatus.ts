/**
 * useNetworkStatus
 * Detecta status de rede usando @capacitor/network
 * Fallback para navigator.onLine em web
 */
import { useEffect, useState, useCallback } from "react";

interface NetworkStatus {
  connected: boolean;
  connectionType: "wifi" | "cellular" | "none" | "unknown";
  isWeak: boolean; // 2G/edge = fraco
}

// Tentar importar Capacitor Network (só disponível no app nativo)
let CapacitorNetwork: any = null;
try {
  CapacitorNetwork = (window as any).Capacitor?.isNativePlatform?.()
    ? require("@capacitor/network").Network
    : null;
} catch { /* web — usa navigator.onLine */ }

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    connected: navigator.onLine,
    connectionType: "unknown",
    isWeak: false,
  });

  const updateStatus = useCallback((info: any) => {
    const type = info.connectionType || "unknown";
    setStatus({
      connected: info.connected !== false,
      connectionType: type,
      isWeak: ["2g", "slow-2g", "edge"].includes(type),
    });
  }, []);

  useEffect(() => {
    let listener: any = null;

    const init = async () => {
      if (CapacitorNetwork) {
        // App nativo — usar Capacitor Network
        try {
          const current = await CapacitorNetwork.getStatus();
          updateStatus(current);
          listener = await CapacitorNetwork.addListener("networkStatusChange", updateStatus);
        } catch (e) {
          console.warn("[useNetworkStatus] Capacitor Network error:", e);
        }
      } else {
        // Web — usar navigator.onLine + connection API
        const handleOnline = () => setStatus(s => ({ ...s, connected: true }));
        const handleOffline = () => setStatus(s => ({ ...s, connected: false, connectionType: "none" }));
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Network Information API (Chrome)
        const conn = (navigator as any).connection;
        if (conn) {
          updateStatus({ connected: navigator.onLine, connectionType: conn.effectiveType || "unknown" });
          conn.addEventListener("change", () => {
            updateStatus({ connected: navigator.onLine, connectionType: conn.effectiveType });
          });
        }

        return () => {
          window.removeEventListener("online", handleOnline);
          window.removeEventListener("offline", handleOffline);
        };
      }
    };

    init();

    return () => {
      if (listener?.remove) listener.remove();
    };
  }, [updateStatus]);

  return status;
}
