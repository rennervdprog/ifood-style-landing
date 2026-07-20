import { ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";

// Slugs mapeados 1:1 ao enum pdv_movements.reason_category (Fase 1 item 5).
const REASONS: Record<"sangria" | "suprimento", { slug: string; label: string }[]> = {
  sangria: [
    { slug: "cofre", label: "Cofre" },
    { slug: "despesa", label: "Despesa" },
    { slug: "fornecedor", label: "Pagto fornecedor" },
    { slug: "retirada_dono", label: "Retirada dono" },
    { slug: "outro", label: "Outro" },
  ],
  suprimento: [
    { slug: "troco_inicial", label: "Troco inicial" },
    { slug: "reforco_troco", label: "Reforço de troco" },
    { slug: "deposito", label: "Depósito" },
    { slug: "outro", label: "Outro" },
  ],
};

interface Props {
  type: "sangria" | "suprimento";
  movValue: string;
  setMovValue: (v: string) => void;
  movDesc: string;
  setMovDesc: (v: string) => void;
  movReason: string;
  setMovReason: (v: string) => void;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const PdvMovementDialog = ({
  type, movValue, setMovValue, movDesc, setMovDesc,
  movReason, setMovReason, loading, onCancel, onConfirm,
}: Props) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    onClick={() => { if (!loading) onCancel(); }}
  >
    <div
      className="bg-card rounded-2xl border border-border w-full max-w-xs p-5 space-y-4 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3">
        {type === "sangria"
          ? <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center"><ArrowDownCircle className="h-5 w-5 text-red-500" /></div>
          : <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><ArrowUpCircle className="h-5 w-5 text-blue-500" /></div>
        }
        <div>
          <h3 className="font-black text-base capitalize">{type}</h3>
          <p className="text-[11px] text-muted-foreground">
            {type === "sangria" ? "Retirada de dinheiro do caixa" : "Entrada de dinheiro no caixa"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-muted-foreground">Valor (R$)</label>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
            <input
              type="text" inputMode="decimal" placeholder="0,00"
              autoFocus
              value={movValue} onChange={e => setMovValue(e.target.value.replace(/[^0-9.,]/g, ""))}
              className="w-full pl-9 pr-3 py-3 bg-muted/40 rounded-xl text-xl font-black text-center focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/50"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground">Motivo *</label>
          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            {REASONS[type].map((r) => (
              <button
                key={r.slug}
                type="button"
                onClick={() => setMovReason(r.slug)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors border ${
                  movReason === r.slug
                    ? type === "sangria"
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-blue-500 text-white border-blue-500"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground">
            Observação (opcional)
          </label>
          <input
            type="text"
            placeholder={type === "sangria" ? "Ex: Enviado ao cofre" : "Ex: Reforço de troco"}
            value={movDesc} onChange={e => setMovDesc(e.target.value)}
            className="w-full mt-1.5 px-3 py-2.5 bg-muted/40 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/50"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 h-11 rounded-xl bg-muted font-bold text-sm">Cancelar</button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 h-11 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 ${
            type === "sangria" ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
          } transition-colors`}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
        </button>
      </div>
    </div>
  </div>
);