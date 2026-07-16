import { useState } from "react";
import { ArrowLeft, Loader2, Monitor, Unlock, User, KeyRound, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";
import { usePdvOperator } from "@/hooks/usePdvOperator";
import { PdvOperatorLoginDialog } from "@/components/pdv/PdvOperatorLoginDialog";

interface Props {
  storeName?: string;
  storeId?: string;
  openingAmount: string;
  setOpeningAmount: (v: string) => void;
  onOpen: () => void;
  loading: boolean;
}

export const PdvAberturaScreen = ({ storeName, storeId, openingAmount, setOpeningAmount, onOpen, loading }: Props) => {
  const navigate = useNavigate();
  const { operator, setOperator } = usePdvOperator(storeId);
  const [pinOpen, setPinOpen] = useState(false);
  return (
    <div className="pdv-shell min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card">
        <button onClick={() => navigate("/admin")} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Monitor className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold">{storeName}</p>
          <p className="text-[10px] text-muted-foreground">PDV · Caixa fechado</p>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <form
          className="w-full max-w-xs space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!operator) { setPinOpen(true); return; }
            if (!loading) onOpen();
          }}
        >
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center mx-auto">
              <Unlock className="h-9 w-9 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground">Abrir Caixa</h2>
              <p className="text-sm text-muted-foreground mt-1">Informe o troco disponível para começar</p>
            </div>
          </div>

          {storeId && (
            <div className="bg-card rounded-2xl border border-border p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Operador</p>
                <p className="text-sm font-black truncate">{operator?.name || "Nenhum selecionado"}</p>
              </div>
              <button type="button" onClick={() => operator ? setOperator(null) : setPinOpen(true)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                {operator ? <LogOut className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
              </button>
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border p-5 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Dinheiro inicial (troco)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
                <input
                  type="text" inputMode="decimal"
                  autoFocus
                  value={openingAmount}
                  onChange={e => {
                    const n = parseBRLCentsInput(e.target.value);
                    setOpeningAmount(n > 0 ? formatBRLDisplay(n) : "");
                  }}
                  placeholder="0,00"
                  className="w-full pl-10 pr-4 py-4 bg-muted/40 rounded-xl text-2xl font-black text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">Deixe 0,00 se não tiver troco inicial</p>
            </div>

            <button
              type="submit" disabled={loading || !operator}
              className="w-full h-14 bg-primary text-primary-foreground font-black text-base rounded-2xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-lg shadow-primary/30 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Unlock className="h-5 w-5" />}
              {operator ? "Abrir Caixa" : "Selecione o operador"}
            </button>
          </div>
        </form>
      </div>

      {storeId && (
        <PdvOperatorLoginDialog
          open={pinOpen}
          storeId={storeId}
          onClose={() => setPinOpen(false)}
          onLogin={(op) => { setOperator(op); setPinOpen(false); }}
        />
      )}
    </div>
  );
};