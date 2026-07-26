import { useState } from "react";
import { ChevronDown, ChevronUp, Wallet, Archive } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";

interface Props {
  openingAmount: number;
  vendasTotal: number;
  vendasCount: number;
  dinheiro: number;
  sangrias: number;
  suprimentos: number;
  saldoEsperado: number;
  /** Fase 3 — mostra botão "Abrir gaveta" quando o lojista tem gaveta ESC/POS. */
  drawerEnabled?: boolean;
}

/**
 * Card de sessão de caixa em tempo real (Fase 4).
 * Mostra abertura, vendas, sangrias, suprimentos e saldo esperado.
 * Colapsável para economizar espaço vertical no aside do PDV.
 */
export const PdvSessionCard = ({
  openingAmount, vendasTotal, vendasCount, dinheiro,
  sangrias, suprimentos, saldoEsperado, drawerEnabled,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const handleOpenDrawer = async () => {
    setDrawerBusy(true);
    try {
      const { openCashDrawer } = await import("@/lib/cashDrawer");
      const ok = await openCashDrawer();
      if (!ok) toast.error("Gaveta não respondeu. Verifique a conexão da impressora.");
    } finally { setDrawerBusy(false); }
  };
  return (
    <div className="border-b border-border bg-muted/30 shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        <Wallet className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Caixa</span>
        <span className="ml-auto text-[11px] font-bold text-foreground pdv-mono">{formatBRL(saldoEsperado)}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-1 text-[11px]">
          <Row label="Abertura" value={openingAmount} />
          <Row label={`Vendas (${vendasCount})`} value={vendasTotal} positive />
          <Row label="Dinheiro" value={dinheiro} muted />
          <Row label="Suprimentos" value={suprimentos} positive />
          <Row label="Sangrias" value={-sangrias} negative />
          <div className="border-t border-border/60 pt-1 mt-1 flex justify-between">
            <span className="font-bold text-foreground">Saldo esperado</span>
            <span className="font-black pdv-mono text-foreground">{formatBRL(saldoEsperado)}</span>
          </div>
          {drawerEnabled && (
            <button
              type="button"
              onClick={handleOpenDrawer}
              disabled={drawerBusy}
              className="w-full mt-2 h-8 rounded-lg bg-primary/10 text-primary text-[11px] font-black flex items-center justify-center gap-1.5 border border-primary/30 disabled:opacity-60"
            >
              <Archive className="h-3 w-3" /> {drawerBusy ? "Abrindo…" : "Abrir gaveta"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const Row = ({ label, value, positive, negative, muted }: {
  label: string; value: number;
  positive?: boolean; negative?: boolean; muted?: boolean;
}) => (
  <div className="flex justify-between">
    <span className={muted ? "text-muted-foreground" : "text-foreground/80"}>{label}</span>
    <span className={`pdv-mono font-semibold ${
      positive ? "text-emerald-600" : negative ? "text-red-600" : "text-foreground"
    }`}>{formatBRL(value)}</span>
  </div>
);
