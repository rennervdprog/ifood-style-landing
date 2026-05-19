import { Loader2, Power, PowerOff } from "lucide-react";

interface DriverOnlineToggleProps {
  isOnline: boolean;
  toggling: boolean;
  onToggle: () => void;
}

export const DriverOnlineToggle = ({ isOnline, toggling, onToggle }: DriverOnlineToggleProps) => {
  return (
    <button
      onClick={onToggle}
      disabled={toggling}
      aria-pressed={isOnline}
      aria-label={isOnline ? "Ficar offline" : "Ficar online"}
      className={`relative w-full overflow-hidden flex items-center justify-between px-5 py-5 rounded-3xl border-2 transition-all active:scale-[0.985] disabled:opacity-60 ${
        isOnline ? "bg-success border-success shadow-xl shadow-success/30" : "bg-card border-border"
      }`}
    >
      {isOnline && (
        <span className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 bg-success-foreground/15 rounded-full blur-2xl" />
      )}
      <div className="relative flex items-center gap-3.5 min-w-0">
        <div
          className={`relative flex items-center justify-center w-11 h-11 rounded-2xl shrink-0 ${
            isOnline ? "bg-success-foreground/20" : "bg-muted"
          }`}
        >
          {toggling ? (
            <Loader2
              className={`h-5 w-5 animate-spin ${
                isOnline ? "text-success-foreground" : "text-muted-foreground"
              }`}
            />
          ) : isOnline ? (
            <Power className="h-5 w-5 text-success-foreground" strokeWidth={2.6} />
          ) : (
            <PowerOff className="h-5 w-5 text-muted-foreground" strokeWidth={2.4} />
          )}
          {isOnline && !toggling && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success-foreground border-2 border-success animate-pulse" />
          )}
        </div>
        <div className="text-left min-w-0">
          <p
            className={`text-lg font-black leading-tight tracking-tight ${
              isOnline ? "text-success-foreground" : "text-foreground"
            }`}
          >
            {isOnline ? "Você está Online" : "Você está Offline"}
          </p>
          <p
            className={`text-[11px] font-semibold leading-tight mt-0.5 ${
              isOnline ? "text-success-foreground/80" : "text-muted-foreground"
            }`}
          >
            {isOnline ? "Recebendo pedidos · toque para pausar" : "Toque para começar a receber"}
          </p>
        </div>
      </div>
      <div
        className={`relative flex items-center shrink-0 w-[56px] h-8 rounded-full p-1 transition-colors duration-200 ${
          isOnline ? "bg-success-foreground/25 justify-end" : "bg-muted justify-start"
        }`}
      >
        <span className="block w-6 h-6 rounded-full bg-card shadow-md transition-all duration-200" />
      </div>
    </button>
  );
};
