import { Calendar, ChevronDown, Download, FileText, Search, XCircle } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import {
  paymentLabel,
  type OrdersExtraFilters,
} from "./ordersReport";

export type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "custom" | "all";
export type SourceKey = "all" | "delivery" | "pdv" | "manual" | "whatsapp";

export interface OrdersPeriodSummary {
  count: number;
  total: number;
  deliveryCount: number;
  deliveryTotal: number;
  pdvCount: number;
  pdvTotal: number;
  manualCount: number;
  manualTotal: number;
  whatsappCount?: number;
  whatsappTotal?: number;
  ticketMedio?: number;
  cancelledCount?: number;
}

interface Props {
  period: PeriodKey;
  setPeriod: (period: PeriodKey) => void;
  sourceFilter: SourceKey;
  setSourceFilter: (source: SourceKey) => void;
  search: string;
  setSearch: (search: string) => void;
  periodSummary: OrdersPeriodSummary;
  showSearch: boolean;
  // Relatórios (Fase A) — opcionais: sem eles, a toolbar se comporta como antes.
  customRange?: { from: string; to: string };
  onCustomRangeChange?: (range: { from: string; to: string }) => void;
  extraFilters?: OrdersExtraFilters;
  onExtraFiltersChange?: (filters: OrdersExtraFilters) => void;
  paymentOptions?: string[];
  neighborhoodOptions?: string[];
  productOptions?: string[];
  exportCsv?: string | null;
  onGenerateReport?: () => void;
}

const PERIODS: { id: PeriodKey; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "custom", label: "Personalizado" },
  { id: "all", label: "Tudo" },
];

const SOURCES: { id: SourceKey; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "delivery", label: "Delivery" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "pdv", label: "PDV" },
  { id: "manual", label: "Manual" },
];

const selectCls =
  "h-9 appearance-none rounded-lg border border-border bg-card py-1.5 pl-3 pr-8 text-xs font-bold text-foreground outline-none hover:bg-muted focus:border-primary";
const inputCls =
  "h-9 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground focus:border-primary";

export default function OrdersToolbar({
  period,
  setPeriod,
  sourceFilter,
  setSourceFilter,
  search,
  setSearch,
  periodSummary,
  showSearch,
  customRange,
  onCustomRangeChange,
  extraFilters,
  onExtraFiltersChange,
  paymentOptions,
  neighborhoodOptions,
  productOptions,
  exportCsv,
  onGenerateReport,
}: Props) {
  const periodLabel = PERIODS.find((item) => item.id === period)?.label || "Hoje";
  const showReports = !!onExtraFiltersChange;

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (exportCsv != null) {
      downloadCsv(exportCsv, `relatorio-pedidos-${new Date().toISOString().slice(0, 10)}.csv`);
      return;
    }
    const rows = [
      ["Pedidos", "Faturamento", "Delivery", "PDV", "Manual"],
      [String(periodSummary.count), formatBRL(periodSummary.total), formatBRL(periodSummary.deliveryTotal), formatBRL(periodSummary.pdvTotal), formatBRL(periodSummary.manualTotal)],
    ];
    downloadCsv(rows.map((row) => row.join(";")).join("\n"), `resumo-pedidos-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const setExtra = (patch: Partial<OrdersExtraFilters>) => {
    if (extraFilters && onExtraFiltersChange) onExtraFiltersChange({ ...extraFilters, ...patch });
  };

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
          {period === "custom" && onCustomRangeChange && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customRange?.from || ""}
                onChange={(e) => onCustomRangeChange({ from: e.target.value, to: customRange?.to || "" })}
                className="h-10 rounded-lg border border-border bg-card px-2 text-xs font-bold text-foreground outline-none focus:border-primary"
                aria-label="Data inicial"
              />
              <span className="text-xs font-bold text-muted-foreground">até</span>
              <input
                type="date"
                value={customRange?.to || ""}
                onChange={(e) => onCustomRangeChange({ from: customRange?.from || "", to: e.target.value })}
                className="h-10 rounded-lg border border-border bg-card px-2 text-xs font-bold text-foreground outline-none focus:border-primary"
                aria-label="Data final"
              />
            </div>
          )}
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-bold text-foreground hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Exportar
          </button>
          {onGenerateReport && (
            <button
              type="button"
              onClick={onGenerateReport}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <FileText className="h-4 w-4" /> Relatório
            </button>
          )}
        </div>
      </div>

      <section className={`mt-5 grid divide-y divide-border border-y border-border sm:divide-x sm:divide-y-0 ${periodSummary.ticketMedio != null ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <div className="py-3 sm:px-4">
          <p className="text-[11px] font-semibold text-muted-foreground">Pedidos em {periodLabel.toLowerCase()}</p>
          <p className="mt-1 text-xl font-black tabular-nums text-foreground">{periodSummary.count}</p>
        </div>
        <div className="py-3 sm:px-4">
          <p className="text-[11px] font-semibold text-muted-foreground">Faturamento no período</p>
          <p className="mt-1 text-xl font-black tabular-nums text-foreground">{formatBRL(periodSummary.total)}</p>
        </div>
        {periodSummary.ticketMedio != null && (
          <div className="py-3 sm:px-4">
            <p className="text-[11px] font-semibold text-muted-foreground">Ticket médio</p>
            <p className="mt-1 text-xl font-black tabular-nums text-foreground">{formatBRL(periodSummary.ticketMedio)}</p>
          </div>
        )}
        <div className="py-3 sm:px-4">
          <p className="text-[11px] font-semibold text-muted-foreground">Origem dos pedidos</p>
          <p className="mt-1 text-xs font-bold text-foreground">
            {periodSummary.deliveryCount} delivery
            {periodSummary.whatsappCount != null && <> · {periodSummary.whatsappCount} WhatsApp</>}
            <> · {periodSummary.pdvCount} PDV · {periodSummary.manualCount} manual</>
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

      {showReports && extraFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={extraFilters.payment}
              onChange={(e) => setExtra({ payment: e.target.value })}
              className={selectCls}
              aria-label="Forma de pagamento"
            >
              <option value="">Pagamento: todas</option>
              {(paymentOptions || []).map((p) => (
                <option key={p} value={p}>{paymentLabel(p)}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="relative">
            <select
              value={extraFilters.fulfillment}
              onChange={(e) => setExtra({ fulfillment: e.target.value as OrdersExtraFilters["fulfillment"] })}
              className={selectCls}
              aria-label="Entrega ou retirada"
            >
              <option value="all">Entrega e retirada</option>
              <option value="delivery">Só entrega</option>
              <option value="pickup">Só retirada</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="relative">
            <select
              value={extraFilters.neighborhood}
              onChange={(e) => setExtra({ neighborhood: e.target.value })}
              className={selectCls}
              aria-label="Bairro"
            >
              <option value="">Bairro: todos</option>
              {(neighborhoodOptions || []).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="relative">
            <select
              value={extraFilters.product}
              onChange={(e) => setExtra({ product: e.target.value })}
              className={`${selectCls} max-w-[190px]`}
              aria-label="Produto"
            >
              <option value="">Produto: todos</option>
              {(productOptions || []).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            value={extraFilters.minValue}
            onChange={(e) => setExtra({ minValue: e.target.value })}
            placeholder="Valor mín (R$)"
            className={`${inputCls} w-[118px]`}
            aria-label="Valor mínimo"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={extraFilters.maxValue}
            onChange={(e) => setExtra({ maxValue: e.target.value })}
            placeholder="Valor máx (R$)"
            className={`${inputCls} w-[118px]`}
            aria-label="Valor máximo"
          />
          {(extraFilters.payment || extraFilters.neighborhood || extraFilters.product || extraFilters.minValue || extraFilters.maxValue || extraFilters.fulfillment !== "all") && (
            <button
              type="button"
              onClick={() => onExtraFiltersChange({ payment: "", fulfillment: "all", neighborhood: "", minValue: "", maxValue: "", product: "" })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              <XCircle className="h-4 w-4" /> Limpar filtros
            </button>
          )}
        </div>
      )}
    </header>
  );
}
