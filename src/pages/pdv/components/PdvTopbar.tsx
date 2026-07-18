import { ArrowLeft, Monitor, Keyboard, ArrowUpCircle, ArrowDownCircle, Lock, Loader2, User, Wifi, WifiOff, RefreshCw, Menu, LogOut, CreditCard, LifeBuoy, UserCircle, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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
  /** Fase 3 — vendas na fila offline aguardando sync. */
  outboxCount?: number;
  outboxFlushing?: boolean;
  onSyncOutbox?: () => void;
  /** Quando true, esconde o "voltar ao painel" e mostra menu enxuto (Perfil/Plano/Sair). */
  isPdvOnly?: boolean;
  /** Quando fornecido (PDV Only), o item "Meu Plano" do menu troca para a aba interna
   *  em vez de navegar para /perfil?tab=plano. */
  onOpenMeuPlano?: () => void;
}

export const PdvTopbar = ({
  storeName, operatorName, turnoVendasCount, turnoVendido, ticketMedio,
  loading, onShowShortcuts, onSuprimento, onSangria, onFechar,
  outboxCount = 0, outboxFlushing = false, onSyncOutbox, isPdvOnly = false,
  onOpenMeuPlano,
}: Props) => {
  const navigate = useNavigate();
  const initial = (operatorName || "").trim().charAt(0).toUpperCase() || "?";
  // Indicador de sincronização — Fase 7
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return (
    <header className="h-12 border-b border-border bg-card flex items-center px-3 gap-2 shrink-0">
      {isPdvOnly ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Menu">
              <Menu className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{storeName || "Menu"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/perfil")}>
              <UserCircle className="h-4 w-4 mr-2" /> Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/admin/cardapio")}>
              <BookOpen className="h-4 w-4 mr-2" /> Cardápio
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (onOpenMeuPlano) onOpenMeuPlano();
                else navigate("/perfil?tab=plano");
              }}
            >
              <CreditCard className="h-4 w-4 mr-2" /> Meu Plano
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open("https://wa.me/5511999999999", "_blank")}
            >
              <LifeBuoy className="h-4 w-4 mr-2" /> Suporte
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={async () => { await supabase.auth.signOut(); navigate("/", { replace: true }); }}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button onClick={() => navigate("/admin")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
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
        <div
          title={online ? "Online — sincronizado" : "Offline — sem conexão"}
          className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border ${
            online
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
              : "bg-red-500/10 border-red-500/30 text-red-600 animate-pulse"
          }`}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        </div>
        {outboxCount > 0 && (
          <button
            type="button"
            onClick={onSyncOutbox}
            disabled={outboxFlushing}
            title={`${outboxCount} venda(s) offline aguardando sincronização`}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-amber-700 bg-amber-500/10 hover:bg-amber-500/20 transition-colors border border-amber-500/30"
          >
            {outboxFlushing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            <span>Sincronizar ({outboxCount})</span>
          </button>
        )}
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