import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownCircle, ArrowUpCircle, Download, Search, ArrowUpDown,
  TrendingUp, TrendingDown, Wallet, Receipt, Calendar, Filter
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface Props {
  storeId: string;
  storeName?: string;
}

type FlowType = "income" | "expense";
type PeriodKey = "30d" | "current_month" | "last_month" | "all" | "custom";
type SortKey = "date" | "amount" | "description";
type SortDir = "asc" | "desc";

// Maps each transaction_kind to a UX-friendly description, flow type and status mapping
const KIND_INFO: Record<string, { label: string; flow: FlowType }> = {
  store_payout:       { label: "Repasse de venda PIX online",            flow: "income"  },
  commission_charge:  { label: "Comissão de venda física",               flow: "expense" },
  physical_fee:       { label: "Repasse físico (dinheiro/cartão/PIX)",   flow: "expense" },
  platform_fee:       { label: "Taxa da plataforma",                     flow: "expense" },
  delivery_fee:       { label: "Taxa de entrega",                        flow: "expense" },
  withdrawal:         { label: "Saque para conta bancária",              flow: "expense" },
  refund:             { label: "Reembolso ao cliente",                   flow: "expense" },
};

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  paid:      { label: "Pago",      cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  settled:   { label: "Liquidado", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  pending:   { label: "Pendente",  cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  failed:    { label: "Falhou",    cls: "bg-red-500/10 text-red-600 border-red-500/20" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
};

function resolvePeriod(period: PeriodKey, custom: { from?: Date; to?: Date }) {
  const now = new Date();
  switch (period) {
    case "30d":           return { from: subDays(now, 30), to: now };
    case "current_month": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last_month": {
      const ref = subMonths(now, 1);
      return { from: startOfMonth(ref), to: endOfMonth(ref) };
    }
    case "custom":        return { from: custom.from, to: custom.to };
    case "all":
    default:              return { from: undefined, to: undefined };
  }
}

export default function FinancialStatement({ storeId, storeName }: Props) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [custom, setCustom] = useState<{ from?: Date; to?: Date }>({});
  const [flow, setFlow] = useState<"all" | FlowType>("all");
  const [status, setStatus] = useState<"all" | "paid" | "pending" | "failed">("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: txs, isLoading } = useQuery({
    queryKey: ["financial-statement", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id, reference_code, amount, status, transaction_kind, created_at, settled_at, provider, metadata")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
    refetchInterval: 30000,
  });

  const range = useMemo(() => resolvePeriod(period, custom), [period, custom]);

  const filtered = useMemo(() => {
    const list = (txs || []).filter((t: any) => {
      // Mensalidade do plano é exibida na aba Planos (histórico de cobranças),
      // não polui o extrato financeiro operacional.
      if (t.transaction_kind === "monthly_fee") return false;
      const created = new Date(t.created_at);
      if (range.from && created < range.from) return false;
      if (range.to && created > range.to) return false;

      const info = KIND_INFO[t.transaction_kind];
      if (flow !== "all") {
        if (!info || info.flow !== flow) return false;
      }

      if (status === "paid"    && !["paid", "settled"].includes(t.status)) return false;
      if (status === "pending" && t.status !== "pending") return false;
      if (status === "failed"  && !["failed", "cancelled"].includes(t.status)) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const label = (info?.label || t.transaction_kind || "").toLowerCase();
        const ref = (t.reference_code || "").toLowerCase();
        if (!label.includes(q) && !ref.includes(q)) return false;
      }

      return true;
    });

    const sorted = [...list].sort((a: any, b: any) => {
      let cmp = 0;
      if (sortKey === "date") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortKey === "amount") cmp = Number(a.amount) - Number(b.amount);
      else if (sortKey === "description") {
        const la = KIND_INFO[a.transaction_kind]?.label || a.transaction_kind || "";
        const lb = KIND_INFO[b.transaction_kind]?.label || b.transaction_kind || "";
        cmp = la.localeCompare(lb, "pt-BR");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [txs, range, flow, status, search, sortKey, sortDir]);

  const totals = useMemo(() => {
    let income = 0, expense = 0, pending = 0;
    for (const t of filtered as any[]) {
      const info = KIND_INFO[t.transaction_kind];
      const isPaid = ["paid", "settled"].includes(t.status);
      const amount = Number(t.amount) || 0;
      if (t.status === "pending") pending += amount;
      if (!isPaid) continue;
      if (info?.flow === "income") income += amount;
      else if (info?.flow === "expense") expense += amount;
    }
    return { income, expense, balance: income - expense, pending, count: filtered.length };
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "description" ? "asc" : "desc"); }
  };

  const exportCSV = () => {
    if (!filtered.length) { toast.error("Nenhuma transação para exportar"); return; }
    const header = "Data,Descricao,Tipo,Valor,Status,Referencia\n";
    const rows = filtered.map((t: any) => {
      const info = KIND_INFO[t.transaction_kind];
      const sm = STATUS_INFO[t.status]?.label || t.status;
      const date = format(new Date(t.created_at), "dd/MM/yyyy HH:mm");
      const flowLbl = info?.flow === "income" ? "Receita" : info?.flow === "expense" ? "Despesa" : "—";
      return `"${date}","${info?.label || t.transaction_kind}","${flowLbl}","${Number(t.amount).toFixed(2)}","${sm}","${t.reference_code}"`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-${storeName || "loja"}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Extrato exportado");
  };

  return (
    <div className="space-y-4">
      {/* Totalizer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-primary" />
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Saldo</p>
            </div>
            <p className={cn("text-base sm:text-xl font-black tabular-nums", totals.balance >= 0 ? "text-foreground" : "text-destructive")}>
              {formatBRL(totals.balance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Receitas</p>
            </div>
            <p className="text-base sm:text-xl font-black text-emerald-600 tabular-nums">{formatBRL(totals.income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Despesas</p>
            </div>
            <p className="text-base sm:text-xl font-black text-destructive tabular-nums">{formatBRL(totals.expense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-amber-600" />
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Pendente</p>
            </div>
            <p className="text-base sm:text-xl font-black text-amber-600 tabular-nums">{formatBRL(totals.pending)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filtros
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="h-9 text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="current_month">Mês atual</SelectItem>
                <SelectItem value="last_month">Mês anterior</SelectItem>
                <SelectItem value="all">Todo o período</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={flow} onValueChange={(v) => setFlow(v as any)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="h-9 text-xs pl-8"
              />
            </div>
          </div>

          {period === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 justify-start text-xs font-normal">
                    <Calendar className="h-3.5 w-3.5 mr-2" />
                    {custom.from ? format(custom.from, "dd/MM/yyyy") : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker mode="single" selected={custom.from} onSelect={(d) => setCustom(c => ({ ...c, from: d || undefined }))} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 justify-start text-xs font-normal">
                    <Calendar className="h-3.5 w-3.5 mr-2" />
                    {custom.to ? format(custom.to, "dd/MM/yyyy") : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker mode="single" selected={custom.to} onSelect={(d) => setCustom(c => ({ ...c, to: d || undefined }))} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">{totals.count} {totals.count === 1 ? "transação" : "transações"}</p>
            <Button size="sm" variant="outline" onClick={exportCSV} className="h-8 text-xs">
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table (desktop) */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("date")}>
                  <span className="inline-flex items-center gap-1">Data <ArrowUpDown className="h-3 w-3 opacity-50" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("description")}>
                  <span className="inline-flex items-center gap-1">Descrição <ArrowUpDown className="h-3 w-3 opacity-50" /></span>
                </TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("amount")}>
                  <span className="inline-flex items-center gap-1">Valor <ArrowUpDown className="h-3 w-3 opacity-50" /></span>
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                  Nenhuma transação encontrada para os filtros selecionados.
                </TableCell></TableRow>
              )}
              {!isLoading && filtered.map((t: any) => {
                const info = KIND_INFO[t.transaction_kind];
                const sm = STATUS_INFO[t.status] || STATUS_INFO.pending;
                const isIncome = info?.flow === "income";
                return (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      <p className="text-[10px] text-muted-foreground">{format(new Date(t.created_at), "HH:mm")}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium">{info?.label || t.transaction_kind}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{t.reference_code}</p>
                    </TableCell>
                    <TableCell>
                      {info ? (
                        <Badge variant="outline" className={isIncome ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}>
                          {isIncome ? <ArrowDownCircle className="h-3 w-3 mr-1" /> : <ArrowUpCircle className="h-3 w-3 mr-1" />}
                          {isIncome ? "Receita" : "Despesa"}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className={cn("text-right font-bold tabular-nums whitespace-nowrap", isIncome ? "text-emerald-600" : "text-destructive")}>
                      {isIncome ? "+" : "−"} {formatBRL(Number(t.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sm.cls}>{sm.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cards (mobile) */}
      <div className="md:hidden space-y-2">
        {isLoading && <p className="text-center text-sm text-muted-foreground py-8">Carregando…</p>}
        {!isLoading && filtered.length === 0 && (
          <Card><CardContent className="py-10 text-center">
            <Receipt className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Nenhuma transação encontrada.</p>
          </CardContent></Card>
        )}
        {!isLoading && filtered.map((t: any) => {
          const info = KIND_INFO[t.transaction_kind];
          const sm = STATUS_INFO[t.status] || STATUS_INFO.pending;
          const isIncome = info?.flow === "income";
          return (
            <Card key={t.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{info?.label || t.transaction_kind}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(t.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-sm font-black tabular-nums whitespace-nowrap", isIncome ? "text-emerald-600" : "text-destructive")}>
                      {isIncome ? "+" : "−"} {formatBRL(Number(t.amount))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {info && (
                    <Badge variant="outline" className={cn("text-[10px] h-5", isIncome ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20")}>
                      {isIncome ? "Receita" : "Despesa"}
                    </Badge>
                  )}
                  <Badge variant="outline" className={cn("text-[10px] h-5", sm.cls)}>{sm.label}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}