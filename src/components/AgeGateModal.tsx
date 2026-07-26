import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

const STORAGE_KEY = "age_gate_confirmed_v1";

interface Props {
  storeId: string;
  storeName: string;
  active: boolean; // só ativa para adegas
  onBlock?: () => void;
}

/**
 * Modal de confirmação de idade (18+) para lojas de adega.
 * Lembra a confirmação por loja via localStorage.
 * Se o usuário negar, dispara onBlock (navega para home).
 */
export default function AgeGateModal({ storeId, storeName, active, onBlock }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!active || !storeId) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      if (!map[storeId]) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [active, storeId]);

  if (!open) return null;

  const confirm = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      map[storeId] = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {}
    setOpen(false);
  };

  const deny = () => {
    setOpen(false);
    onBlock?.();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-full bg-amber-500/15 flex items-center justify-center mb-3">
            <AlertTriangle className="h-7 w-7 text-amber-500" />
          </div>
          <h2 className="text-lg font-black text-foreground">Conteúdo +18</h2>
          <p className="text-sm text-muted-foreground mt-2">
            <span className="font-semibold text-foreground">{storeName}</span> vende bebidas alcoólicas.
            A venda é proibida para menores de 18 anos.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Confirmando, você declara ter 18 anos ou mais.
          </p>
        </div>
        <div className="flex flex-col gap-2 mt-5">
          <button
            type="button"
            onClick={confirm}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold hover:opacity-90 active:scale-[0.98] transition"
          >
            Sou maior de 18 anos
          </button>
          <button
            type="button"
            onClick={deny}
            className="w-full text-muted-foreground py-2 text-xs hover:text-foreground transition"
          >
            Sair da loja
          </button>
        </div>
      </div>
    </div>
  );
}