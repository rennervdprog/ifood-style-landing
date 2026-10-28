import type { ElementType } from "react";
import { cn } from "@/lib/utils";

interface SuperAdminMetricCardTesteProps {
  icon: ElementType;
  label: string;
  value: string;
  sublabel?: string;
  sublabel2?: string;
  highlight?: boolean;
  alert?: boolean;
  onClick?: () => void;
}

/**
 * Card de métrica redesenhado (Fase 3 — só na versão Teste).
 * Mesmo padrão do MetricCardTeste do /admin-teste: ícone num quadrado
 * arredondado com fundo colorido, valor grande, rótulo em caixa alta.
 * Sem emoji no lugar de ícone. O original (MetricCard, em
 * ./admin/components/FinanceTab) continua intacto.
 */
export default function SuperAdminMetricCardTeste({
  icon: Icon,
  label,
  value,
  sublabel,
  sublabel2,
  highlight,
  alert,
  onClick,
}: SuperAdminMetricCardTesteProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
      className={cn(
        "rounded-2xl border bg-card p-4",
        highlight && "border-primary/40 bg-primary/5",
        alert && "border-destructive/40 bg-destructive/5",
        onClick && "cursor-pointer transition-all hover:shadow-md active:scale-[0.98]",
      )}
    >
      <div className="flex flex-col gap-3">
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center",
            alert ? "bg-destructive/10" : highlight ? "bg-primary/10" : "bg-muted/60",
          )}
        >
          <Icon
            className={cn(
              "h-6 w-6",
              alert ? "text-destructive" : highlight ? "text-primary" : "text-muted-foreground",
            )}
          />
        </div>
        <div className="min-w-0">
          <p className={cn("text-xl font-black tabular-nums text-foreground leading-none", alert && "text-destructive")}>
            {value}
          </p>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-2">{label}</p>
          {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
          {sublabel2 && <p className="text-xs text-muted-foreground">{sublabel2}</p>}
        </div>
      </div>
    </div>
  );
}
