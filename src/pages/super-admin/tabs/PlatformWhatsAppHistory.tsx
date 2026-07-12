import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, Download } from "lucide-react";

type Row = {
  id: string;
  sent_at: string;
  phone: string;
  kind: string | null;
  category: string | null;
  status: string | null;
  store_id: string | null;
  store_name: string | null;
  preview: string | null;
  error: string | null;
  total_count: number;
};

const CATEGORIES = [
  { v: "all", l: "Todas categorias" },
  { v: "mensalidade", l: "Mensalidade" },
  { v: "repasse", l: "Repasse" },
  { v: "essencial", l: "Essencial" },
  { v: "boas-vindas", l: "Boas-vindas" },
  { v: "manual", l: "Manual" },
  { v: "teste", l: "Teste" },
  { v: "outros", l: "Outros" },
];
const STATUSES = [
  { v: "all", l: "Todos status" },
  { v: "sent", l: "Enviado" },
  { v: "error", l: "Erro" },
];

const maskPhone = (p: string) => {
  const d = (p || "").replace(/\D/g, "");
  if (d.length < 6) return d;
  return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, -4).replace(/(\d{5})$/, "$1")}-${d.slice(-4)}`;
};

const catBadge = (c: string | null) => {
  const map: Record<string, string> = {
    mensalidade: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    repasse: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    essencial: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
    "boas-vindas": "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    manual: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    teste: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    outros: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return map[c || "outros"] || map.outros;
};

export default function PlatformWhatsAppHistory() {
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const { data: stats } = useQuery({
    queryKey: ["pwa-stats"],
    queryFn: async () => {
      const { data } = await supabase.rpc("platform_wa_stats" as any);
      return (data as any) || {};
    },
    refetchInterval: 30_000,
  });

  const { data: rows, isFetching, refetch } = useQuery({
    queryKey: ["pwa-log", category, status, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_platform_wa_log" as any, {
        p_category: category === "all" ? null : category,
        p_status: status === "all" ? null : status,
        p_store_id: null,
        p_from: null,
        p_to: null,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  const total = rows?.[0]?.total_count ?? 0;
  const filtered = useMemo(() => {
    if (!q.trim()) return rows || [];
    const s = q.toLowerCase();
    return (rows || []).filter(
      (r) =>
        (r.store_name || "").toLowerCase().includes(s) ||
        (r.phone || "").includes(s.replace(/\D/g, "")) ||
        (r.preview || "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  const exportCsv = () => {
    const header = ["Data", "Loja", "Telefone", "Categoria", "Status", "Prévia", "Erro"];
    const lines = (filtered || []).map((r) => [
      new Date(r.sent_at).toLocaleString("pt-BR"),
      r.store_name || "",
      r.phone,
      r.category || "",
      r.status || "",
      (r.preview || "").replace(/[\r\n;]+/g, " "),
      (r.error || "").replace(/[\r\n;]+/g, " "),
    ]);
    const csv = [header, ...lines].map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `whatsapp-plataforma-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatCard label="Hoje" value={stats?.today ?? 0} />
        <StatCard label="7 dias" value={stats?.week ?? 0} />
        <StatCard label="30 dias" value={stats?.month ?? 0} />
        <StatCard label="Erros 7d" value={stats?.errors_7d ?? 0} tone={stats?.errors_7d ? "warn" : "ok"} />
      </div>

      <div className="rounded-xl border bg-card p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Buscar loja, número ou texto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <div className="text-xs text-muted-foreground">
            {total} registro{total === 1 ? "" : "s"} • página {page + 1} / {totalPages}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => refetch()}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered?.length}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card divide-y">
        {isFetching && !rows?.length && (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…</div>
        )}
        {!isFetching && !filtered.length && (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum envio encontrado.</div>
        )}
        {filtered.map((r) => (
          <div key={r.id} className="p-3 space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${catBadge(r.category)}`}>
                  {r.category || "outros"}
                </span>
                <span className="font-semibold truncate">{r.store_name || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                {r.status === "error"
                  ? <Badge variant="destructive" className="text-[10px]">erro</Badge>
                  : <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">enviado</Badge>}
                <span className="text-[10px] text-muted-foreground">
                  {new Date(r.sent_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-mono">{maskPhone(r.phone)} • {r.kind}</div>
            {r.preview && <div className="text-xs whitespace-pre-wrap line-clamp-3">{r.preview}</div>}
            {r.error && <div className="text-[11px] text-red-600 line-clamp-2">⚠ {r.error}</div>}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          ← Anterior
        </Button>
        <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Próxima →
        </Button>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = "ok" }: { label: string; value: number | string; tone?: "ok" | "warn" }) {
  const color = tone === "warn" && Number(value) > 0
    ? "text-red-600 dark:text-red-400"
    : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">{label}</div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
}