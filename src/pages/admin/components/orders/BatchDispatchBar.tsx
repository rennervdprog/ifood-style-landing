import { Truck, Loader2 } from "lucide-react";

interface Props {
  selectedCount: number;
  batchDispatching: boolean;
  onSelectAll: () => void;
  onDispatch: () => void;
}

export default function BatchDispatchBar({ selectedCount, batchDispatching, onSelectAll, onDispatch }: Props) {
  return (
    <div className="px-4 pt-3 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 bg-muted border border-border rounded-xl p-3">
        <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground">Agrupar pedidos para entrega</p>
          <p className="text-[10px] text-muted-foreground">Selecione os pedidos prontos e envie todos de uma vez</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onSelectAll}
            className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors"
          >
            Todos
          </button>
          {selectedCount > 0 && (
            <button
              onClick={onDispatch}
              disabled={batchDispatching}
              className="flex items-center gap-1 text-xs font-black text-primary-foreground bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {batchDispatching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
              Enviar {selectedCount}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}