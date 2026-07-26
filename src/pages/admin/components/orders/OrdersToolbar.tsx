import { useState } from "react";
import { Search, XCircle, Calendar, Store as StoreIcon, TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/utils";

export type PeriodKey = "today" | "yesterday" | "7d" | "all";
export type SourceKey = "all" | "delivery" | "pdv" | "manual";

interface Props {
  period: PeriodKey;
  setPeriod: (p: PeriodKey) => void;
  sourceFilter: SourceKey;
  setSourceFilter: (s: SourceKey) => void;
  search: string;
  setSearch: (s: string) => void;
  periodSummary: {
    count: number;
    total: number;
    deliveryCount: number;
    deliveryTotal: number;
    pdvCount: number;
    pdvTotal: number;
    manualCount: number;
    manualTotal: number;
  };
  showSearch: boolean;
}

const PERIODS: { id: PeriodKey; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "all", label: "Tudo" },
];

const SOURCES: { id: SourceKey; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "delivery", label: "Delivery" },
  { id: "pdv", label: "PDV" },
  { id: "manual", label: "Manual" },
];

export default function OrdersToolbar({
  period, setPeriod, sourceFilter, setSourceFilter, search, setSearch, periodSummary, showSearch,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const periodLabel = period === "today" ? "Hoje" : period === "yesterday" ? "Ontem" : period === "7d" ? "Últimos 7 dias" : "Total";

  return (
    <div className="px-4 pt-3 pb-2 max-w-6xl mx-auto">
      {/* Card hero: faturamento + breakdown */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-card to-card border border-border p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>{periodLabel}</span>
              <span>·</span>
              <span>{periodSummary.count} pedido{periodSummary.count === 1 ? "" : "s"}</span>
            </div>
            <p className="text-2xl md:text-3xl font-black text-foreground leading-tight mt-0.5">{formatBRL(periodSummary.total)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            {periodSummary.deliveryCount > 0 && (
              <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                Delivery <span className="font-black text-foreground">{periodSummary.deliveryCount}</span> · {formatBRL(periodSummary.deliveryTotal)}
              </span>
            )}
            {periodSummary.pdvCount > 0 && (
              <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                PDV <span className="font-black text-foreground">{periodSummary.pdvCount}</span> · {formatBRL(periodSummary.pdvTotal)}
              </span>
            )}
            {periodSummary.manualCount > 0 && (
              <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                Manual <span className="font-black text-foreground">{periodSummary.manualCount}</span> · {formatBRL(periodSummary.manualTotal)}
              </span>
            )}
          </div>
        </div>

        {/* Filtros em linha única */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                  period === p.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-1 shrink-0" />
            <StoreIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSourceFilter(s.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                  sourceFilter === s.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {showSearch && (
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className={`p-1.5 rounded-lg transition-all shrink-0 ${
                searchOpen || search ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
              aria-label="Buscar pedidos"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {showSearch && (searchOpen || search) && (
          <div className="relative mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ID, cliente, telefone ou entregador..."
              className="w-full pl-10 pr-9 py-2 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}