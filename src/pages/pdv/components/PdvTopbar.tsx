import { ArrowLeft, Monitor, Keyboard, ArrowUpCircle, ArrowDownCircle, Lock, Loader2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatBRL } from "@/lib/utils";

interface Props {
  storeName?: string;
  operatorName?: string;
  turnoVendasCount: number;
  turnoVendido: number;
  ticketMedio: number;
  loading: boolean;
  onShowShortcuts: () => void;
  onSuprimento: () => void;
  onSangria: () => void;
  onFechar: () => void;
}

export const PdvTopbar = ({
  storeName, operatorName, turnoVendasCount, turnoVendido, ticketMedio,
  loading, onShowShortcuts, onSuprimento, onSangria, onFechar,
}: Props) => {
  const navigate = useNavigate();
  const initial = (operatorName || "").trim().charAt(0).toUpperCase() || "?";
  return (
    <header className="h-12 border-b border-border bg-card flex items-center px-3 gap-2 shrink-0">
      <button onClick={() => navigate("/admin")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="w-px h-5 bg-border" />
      <Monitor className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold text-foreground truncate">{storeName}</span>
        <span className="text-[10px] text-emerald-500 font-semibold ml-2 hidden sm:inline">
          ● {turnoVendasCount} vendas · <span className="pdv-mono">{formatBRL(turnoVendido)}</span>
          {ticketMedio > 0 && <span className="text-muted-foreground ml-1.5">· tkt <span className="pdv-mono">{formatBRL(ticketMedio)}</span></span>}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {operatorName && (
          <div
            title={`Operador: ${operatorName}`}
            className="hidden sm:flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-muted/40 border border-border"
          >
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">
              {initial}
            </span>
            <span className="text-[11px] font-bold text-foreground max-w-[120px] truncate">{operatorName}</span>
          </div>
        )}
        {operatorName && (
          <div title={operatorName} className="sm:hidden w-6 h-6 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">
            {initial}
          </div>
        )}
        <button
          onClick={onShowShortcuts}
          title="Atalhos de teclado"
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-muted-foreground bg-muted/50 hover:bg-muted transition-colors border border-border"
        >
          <Keyboard className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onSuprimento}
          title="Suprimento"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-blue-600 bg-blue-500/8 hover:bg-blue-500/15 transition-colors border border-blue-500/20"
        >
          <ArrowUpCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:block">Suprimento</span>
        </button>
        <button
          onClick={onSangria}
          title="Sangria"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-red-600 bg-red-500/8 hover:bg-red-500/15 transition-colors border border-red-500/20"
        >
          <ArrowDownCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:block">Sangria</span>
        </button>
        <button
          onClick={onFechar} disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors border border-border"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
          <span className="hidden sm:block">Fechar</span>
        </button>
      </div>
    </header>
  );
};