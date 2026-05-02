import { useState, useCallback } from "react";

/**
 * 🎨 Hook customizado para substituir window.confirm() nativo.
 *
 * Por que usar?
 * - confirm() nativo trava a thread principal
 * - UX ruim em mobile (especialmente em Capacitor Android)
 * - Não permite estilização ou tradução
 *
 * Uso:
 *   const { confirm, ConfirmDialog } = useConfirmDialog();
 *
 *   const handleDelete = async () => {
 *     const ok = await confirm({
 *       title: "Excluir cupom?",
 *       description: "Esta ação não pode ser desfeita.",
 *       confirmText: "Excluir",
 *       variant: "destructive",
 *     });
 *     if (ok) deleteMutation.mutate();
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleDelete}>Excluir</button>
 *       <ConfirmDialog />
 *     </>
 *   );
 */

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    if (state) {
      state.resolve(result);
      setState(null);
    }
  }, [state]);

  const ConfirmDialog = useCallback(() => {
    if (!state) return null;

    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
        onClick={() => handleClose(false)}
      >
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <h3 className="text-lg font-bold text-foreground">{state.title}</h3>
            {state.description && (
              <p className="text-sm text-muted-foreground mt-2">{state.description}</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => handleClose(false)}
              className="flex-1 py-2.5 rounded-xl bg-muted text-foreground font-bold text-sm active:scale-[0.98] transition-transform"
            >
              {state.cancelText || "Cancelar"}
            </button>
            <button
              onClick={() => handleClose(true)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform ${
                state.variant === "destructive"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {state.confirmText || "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    );
  }, [state, handleClose]);

  return { confirm, ConfirmDialog };
}
