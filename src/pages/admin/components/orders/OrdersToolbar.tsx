import { Calendar, ChevronDown, Download, Search, XCircle } from "lucide-react";
import { formatBRL } from "@/lib/utils";

export type PeriodKey = "today" | "yesterday" | "7d" | "all";
export type SourceKey = "all" | "delivery" | "pdv" | "manual";

interface Props {
  period: PeriodKey;
  setPeriod: (period: PeriodKey) => void;
  sourceFilter: SourceKey;
  setSourceFilter: (source: SourceKey) => void;
  search: string;
  setSearch: (search: string) => void;
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
  { id: "all", label: "Todos" },
  { id: "delivery", label: "Delivery" },
  { id: "pdv", label: "PDV" },
  { id: "manual", label: "Manual" },
];

export default function OrdersToolbar({
  period,
  setPeriod,
  sourceFilter,
  setSourceFilter,
  search,
  setSearch,
  periodSummary,
  showSearch,
}: Props) {
  const periodLabel = PERIODS.find((item) => item.id === period)?.label || "Hoje";

  return (
    <header className="max-w-6xl mx-auto border-b border-border px-4 pb-4 pt-5 lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Operação / Pedidos</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground">Pedidos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe e avance cada pedido no momento certo.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as PeriodKey)}
              className="h-10 appearance-none rounded-lg border border-border bg-card py-2 pl-9 pr-9 text-xs font-bold text-foreground outline-none hover:bg-muted focus:border-primary"
              aria-label="Período dos pedidos"
            >
              {PERIODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <button
            type="button"
            onClick={() => {
              const rows = [
                ["Pedidos", "Faturamento", "Delivery", "PDV", "Manual"],
                [String(periodSummary.count), formatBRL(periodSummary.total), formatBRL(periodSummary.deliveryTotal), formatBRL(periodSummary.pdvTotal), formatBRL(periodSummary.manualTotal)],
              ];
              const blob = new Blob([rows.map((row) => row.join(";")).join("\n")], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `resumo-pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-bold text-foreground hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Exportar
          </button>
        </div>
      </div>

      <section className="mt-5 grid divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="py-3 sm:px-4">
          <p className="text-[11px] font-semibold text-muted-foreground">Pedidos em {periodLabel.toLowerCase()}</p>
          <p className="mt-1 text-xl font-black tabular-nums text-foreground">{periodSummary.count}</p>
        </div>
        <div className="py-3 sm:px-4">
          <p className="text-[11px] font-semibold text-muted-foreground">Faturamento no período</p>
          <p className="mt-1 text-xl font-black tabular-nums text-foreground">{formatBRL(periodSummary.total)}</p>
        </div>
        <div className="py-3 sm:px-4">
          <p className="text-[11px] font-semibold text-muted-foreground">Origem dos pedidos</p>
          <p className="mt-1 text-xs font-bold text-foreground">
            {periodSummary.deliveryCount} delivery · {periodSummary.pdvCount} PDV · {periodSummary.manualCount} manual
          </p>
        </div>
      </section>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex overflow-x-auto border border-border bg-card no-scrollbar">
          {SOURCES.map((source) => (
            <button
              key={source.id}
              onClick={() => setSourceFilter(source.id)}
              className={`whitespace-nowrap border-r border-border px-3 py-2 text-xs font-bold last:border-r-0 ${
                sourceFilter === source.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {source.label}
            </button>
          ))}
        </div>

        {showSearch && (
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar pedido, cliente, telefone ou bairro"
              className="h-10 w-full border border-border bg-card py-2 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Limpar busca">
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
