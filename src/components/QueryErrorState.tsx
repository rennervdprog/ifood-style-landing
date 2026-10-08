/**
 * QueryErrorState
 * Estado de erro reutilizável para queries do React Query.
 * Visual neutro/âmbar (nunca verde de sucesso nem vermelho de alarme):
 * indica dados ausentes sem sugerir que "está tudo bem" ou que houve falha grave.
 */
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QueryErrorStateProps {
  title?: string;
  message?: string;
  onRetry: () => void;
  className?: string;
}

export default function QueryErrorState({
  title = "Não foi possível carregar os dados",
  message = "Verifique sua conexão e tente novamente.",
  onRetry,
  className,
}: QueryErrorStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200 bg-amber-50 p-4 text-center",
        "dark:border-amber-800/50 dark:bg-amber-950/40",
        className
      )}
    >
      <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
      <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{title}</p>
      <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-1">{message}</p>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetry}
        className="mt-3 h-8 text-[11px] border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/50"
      >
        Tentar novamente
      </Button>
    </div>
  );
}
