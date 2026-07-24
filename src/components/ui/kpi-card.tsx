import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export type KpiTone = "emerald" | "blue" | "amber" | "primary" | "rose" | "violet";

const TONES: Record<KpiTone, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  primary: "bg-primary/10 text-primary",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

export interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: KpiTone;
  sub?: string;
  highlight?: boolean;
  className?: string;
}

/**
 * KpiCard compartilhado — use em vez de reimplementar cartão de KPI ad-hoc.
 * Visual unificado, ícone tonalizado + label uppercase + valor grande + sub opcional.
 */
export function KpiCard({ icon: Icon, label, value, tone = "primary", sub, highlight, className = "" }: KpiCardProps) {
  return (
    <Card
      className={`p-3 flex items-center gap-3 rounded-2xl ${
        highlight ? "border-amber-400 bg-amber-50/40 dark:bg-amber-950/20" : ""
      } ${className}`}
    >
      <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold leading-tight truncate">{String(value)}</p>
        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </Card>
  );
}

export default KpiCard;