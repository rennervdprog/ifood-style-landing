/**
 * Card-hero de status da conexão WhatsApp.
 * Mostra avatar, número mascarado, pill animado e CTA contextual.
 */
import { MessageCircle, QrCode, Loader2, AlertTriangle, Wifi, WifiOff } from "lucide-react";

interface Props {
  status: "connected" | "connecting" | "disconnected";
  storeName: string;
  connectedPhone?: string;
  expectedPhone?: string;
  phoneMismatch?: boolean;
  connectedAt?: string | null;
  onPrimaryAction: () => void;
  primaryLoading?: boolean;
}

// Formata número BR completo, sem máscara: +55 (14) 99999-4997
const formatPhone = (phone?: string) => {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  if (!d) return "";
  // Assume DDI 55 quando cabe
  const hasDDI = d.length >= 12 && d.startsWith("55");
  const rest = hasDDI ? d.slice(2) : d;
  const ddi = hasDDI ? "+55 " : d.length > 11 ? `+${d.slice(0, d.length - 11)} ` : "";
  if (rest.length === 11) return `${ddi}(${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`;
  if (rest.length === 10) return `${ddi}(${rest.slice(0, 2)}) ${rest.slice(2, 6)}-${rest.slice(6)}`;
  return `+${d}`;
};

const sinceLabel = (iso?: string | null) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "agora mesmo";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `há ${min}min`;
  const hours = Math.floor(ms / 3_600_000);
  const remMin = Math.floor((ms % 3_600_000) / 60_000);
  if (hours < 24) return remMin ? `há ${hours}h ${remMin}min` : `há ${hours}h`;
  const days = Math.floor(ms / 86_400_000);
  const remH = Math.floor((ms % 86_400_000) / 3_600_000);
  return remH ? `há ${days}d ${remH}h` : `há ${days} dia${days > 1 ? "s" : ""}`;
};

const absoluteWhen = (iso?: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

export default function WhatsAppStatusCard({
  status,
  storeName,
  connectedPhone,
  expectedPhone,
  phoneMismatch,
  connectedAt,
  onPrimaryAction,
  primaryLoading,
}: Props) {
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  const accent = isConnected
    ? "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30"
    : isConnecting
    ? "from-amber-500/15 to-amber-500/5 border-amber-500/30"
    : "from-muted/40 to-muted/10 border-border";

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${accent} p-4`}>
      <div className="flex items-center gap-3">
        <div
          className={`relative w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
            isConnected ? "bg-emerald-500" : isConnecting ? "bg-amber-500" : "bg-muted-foreground/30"
          }`}
        >
          <MessageCircle className="h-6 w-6 text-white" strokeWidth={2.4} />
          {isConnected && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-background" />
          )}
          {isConnecting && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-background animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                isConnected
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : isConnecting
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isConnected ? <Wifi className="h-2.5 w-2.5" /> : isConnecting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <WifiOff className="h-2.5 w-2.5" />}
              {isConnected ? "Conectado" : isConnecting ? "Aguardando QR" : "Desconectado"}
            </span>
          </div>
          <p className="text-sm font-bold text-foreground truncate mt-0.5">{storeName}</p>
          <p className="text-xs text-foreground/90 truncate font-medium">
            {isConnected && connectedPhone ? formatPhone(connectedPhone) : "Nenhum número conectado"}
          </p>
          {isConnected && connectedAt && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Conectado {sinceLabel(connectedAt)} · desde {absoluteWhen(connectedAt)}
            </p>
          )}
        </div>
      </div>

      {phoneMismatch && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-[11px] text-destructive leading-snug">
            Número conectado ({formatPhone(connectedPhone)}) é diferente do cadastrado na loja ({formatPhone(expectedPhone)}). Reconecte com o número correto.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onPrimaryAction}
        disabled={primaryLoading}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background py-2.5 text-xs font-bold disabled:opacity-60 hover:opacity-90 transition-opacity"
      >
        {primaryLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <QrCode className="h-3.5 w-3.5" />
        )}
        {isConnected ? "Reconectar outro número" : isConnecting ? "Recarregar QR Code" : "Gerar QR Code"}
      </button>
    </div>
  );
}