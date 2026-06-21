import * as React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface GlanceCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
  trend?: "up" | "down" | null;
  onClick?: () => void;
  highlight?: boolean;
}

export const GlanceCard = ({
  icon: Icon,
  label,
  value,
  subValue,
  color = "text-primary",
  trend,
  onClick,
  highlight,
}: GlanceCardProps) => {
  // Mapa explícito para evitar gerar classes inválidas/sólidas (ex.: bg-muted-foreground)
  const bgColor = (() => {
    if (color.includes("primary")) return "bg-primary/10";
    if (color.includes("destructive")) return "bg-destructive/10";
    if (color.includes("muted-foreground")) return "bg-muted";
    if (color.includes("foreground")) return "bg-muted";
    const m = color.match(/text-([a-z]+)-500/);
    if (m) return `bg-${m[1]}-500/15`;
    return "bg-muted";
  })();

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-3xl p-5 flex flex-col gap-3 transition-all duration-300 ${
        onClick ? "cursor-pointer hover:-translate-y-1 active:scale-[0.97]" : ""
      } ${
        highlight
          ? "bg-gradient-to-br from-primary/15 via-primary/5 to-background border-2 border-primary/30 shadow-xl shadow-primary/10"
          : "bg-card/50 backdrop-blur-sm border border-border/50 hover:bg-card hover:border-border hover:shadow-xl hover:shadow-foreground/5"
      }`}
    >
      {highlight && (
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors" />
      )}

      <div className="flex items-center justify-between">
        <div
          className={`w-12 h-12 rounded-2xl ${bgColor} flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
        >
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
              trend === "up" ? "text-emerald-500 bg-emerald-500/15" : "text-red-500 bg-red-500/15"
            }`}
          >
            {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend === "up" ? "Cresceu" : "Caiu"}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <p className="text-3xl font-black text-foreground tracking-tighter leading-none">{value}</p>
          {highlight && (
            <span className="relative flex h-2 w-2 mb-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          )}
        </div>
        <p className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest mt-2">{label}</p>
        {subValue && (
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-1 w-1 rounded-full bg-border" />
            <p className="text-[10px] text-muted-foreground/70 font-medium">{subValue}</p>
          </div>
        )}
      </div>
    </div>
  );
};
