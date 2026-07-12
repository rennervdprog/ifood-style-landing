import { Pause, Play, PackageX, Package, ArrowRightLeft, Trash2, Loader2, X, Copy } from "lucide-react";

interface BulkActionBarProps {
  count: number;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onOutOfStock: () => void;
  onRestock: () => void;
  onMove: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * Barra sticky de ações em massa — fica visível na base no mobile e no topo no desktop.
 */
export const BulkActionBar = ({
  count,
  busy,
  onPause,
  onResume,
  onOutOfStock,
  onRestock,
  onMove,
  onDuplicate,
  onDelete,
  onClear,
}: BulkActionBarProps) => {
  return (
    <div
      className="fixed left-4 right-4 lg:sticky lg:top-4 lg:left-auto lg:right-auto lg:bottom-auto z-30 bg-primary text-primary-foreground rounded-2xl p-3 shadow-xl border border-primary/40 flex items-center justify-between gap-2 flex-wrap animate-in slide-in-from-bottom-4 lg:slide-in-from-top-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold">
          {count} selecionado{count > 1 ? "s" : ""}
        </span>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <BulkBtn onClick={onPause} icon={<Pause className="h-3.5 w-3.5" />} label="Pausar" disabled={busy} />
        <BulkBtn onClick={onResume} icon={<Play className="h-3.5 w-3.5" />} label="Ativar" disabled={busy} />
        <BulkBtn onClick={onOutOfStock} icon={<PackageX className="h-3.5 w-3.5" />} label="Esgotar" disabled={busy} destructive />
        <BulkBtn onClick={onRestock} icon={<Package className="h-3.5 w-3.5" />} label="Repor" disabled={busy} />
        <BulkBtn onClick={onMove} icon={<ArrowRightLeft className="h-3.5 w-3.5" />} label="Mover" disabled={busy} />
        <BulkBtn onClick={onDuplicate} icon={<Copy className="h-3.5 w-3.5" />} label="Duplicar" disabled={busy} />
        <BulkBtn onClick={onDelete} icon={<Trash2 className="h-3.5 w-3.5" />} label="Excluir" disabled={busy} destructive />
        <button
          onClick={onClear}
          className="p-1.5 rounded-lg hover:bg-primary-foreground/15 transition-colors"
          aria-label="Limpar seleção"
          title="Limpar seleção"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const BulkBtn = ({
  onClick,
  icon,
  label,
  disabled,
  destructive,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`${
      destructive ? "bg-destructive/80 hover:bg-destructive" : "bg-primary-foreground/15 hover:bg-primary-foreground/25"
    } px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 disabled:opacity-50 transition-colors`}
  >
    {icon}
    <span className="hidden sm:inline">{label}</span>
  </button>
);

export default BulkActionBar;