/**
 * NetworkStatusBanner
 * Banner visível no topo do app do motoboy indicando status da conexão
 */
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { getQueue } from "@/lib/offlineDeliveryQueue";
import { Wifi, WifiOff, Signal } from "lucide-react";

export default function NetworkStatusBanner() {
  const { connected, connectionType, isWeak } = useNetworkStatus();
  const queueCount = getQueue().length;

  // Online e sinal bom — não mostrar nada
  if (connected && !isWeak && queueCount === 0) return null;

  if (!connected) {
    return (
      <div className="w-full bg-red-600 text-white px-4 py-2.5 flex items-center gap-2.5 z-50">
        <WifiOff className="h-4 w-4 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-black leading-tight">Sem conexão com a internet</p>
          <p className="text-[11px] opacity-90">
            {queueCount > 0
              ? `${queueCount} confirmação${queueCount > 1 ? "ões" : ""} salva${queueCount > 1 ? "s" : ""} — será${queueCount > 1 ? "ão" : ""} enviada${queueCount > 1 ? "s" : ""} quando o sinal voltar`
              : "Você ainda pode confirmar entregas — o PIN será salvo e enviado automaticamente"
            }
          </p>
        </div>
      </div>
    );
  }

  if (isWeak) {
    return (
      <div className="w-full bg-amber-500 text-white px-4 py-2 flex items-center gap-2.5 z-50">
        <Signal className="h-4 w-4 shrink-0" />
        <p className="text-xs font-semibold">
          Sinal fraco ({connectionType}) — confirmações podem demorar
        </p>
      </div>
    );
  }

  // Online mas tem itens na fila sincronizando
  if (queueCount > 0) {
    return (
      <div className="w-full bg-emerald-600 text-white px-4 py-2 flex items-center gap-2.5 z-50">
        <Wifi className="h-4 w-4 shrink-0 animate-pulse" />
        <p className="text-xs font-semibold">
          Sincronizando {queueCount} confirmação{queueCount > 1 ? "ões" : ""} salva{queueCount > 1 ? "s" : ""}...
        </p>
      </div>
    );
  }

  return null;
}
