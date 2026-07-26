import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEBUG_STORE_IDS } from "@/lib/debugStoreLogger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Trash2, AlertTriangle, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { useState, Fragment } from "react";
import { toast } from "sonner";

interface DebugLog {
  id: string;
  store_id: string | null;
  function_name: string;
  direction: "request" | "response" | "error";
  status: number | null;
  duration_ms: number | null;
  payload: any;
  error: string | null;
  route: string | null;
  created_at: string;
}

const DirectionIcon = ({ d }: { d: DebugLog["direction"] }) => {
  if (d === "request") return <ArrowRight className="h-3.5 w-3.5 text-primary" />;
  if (d === "response") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  return <XCircle className="h-3.5 w-3.5 text-destructive" />;
};

const DebugLojaTab = () => {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>(DEBUG_STORE_IDS[0] ?? "all");

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["debug-store-logs", storeFilter],
    queryFn: async () => {
      let q = (supabase as any).from("debug_store_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (storeFilter !== "all") q = q.eq("store_id", storeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as DebugLog[];
    },
    refetchInterval: 15_000,
  });

  const clearOld = async () => {
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { error } = await (supabase as any).from("debug_store_logs").delete().lt("created_at", cutoff);
    if (error) toast.error("Erro ao limpar: " + error.message);
    else {
      toast.success("Logs antigos removidos (>24h)");
      qc.invalidateQueries({ queryKey: ["debug-store-logs"] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">Debug Loja — captura ativa</p>
            <p className="text-muted-foreground text-xs">
              Todas as chamadas de edge functions que envolvem lojas marcadas são registradas aqui e enviadas pro Sentry com a tag <code className="bg-muted px-1 rounded">debug_store</code>.
              Lojas ativas: <strong>{DEBUG_STORE_IDS.length}</strong>. Para adicionar/remover: <code className="bg-muted px-1 rounded">src/lib/debugStoreLogger.ts</code>.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
          className="bg-background border rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">Todas as lojas debug</option>
          {DEBUG_STORE_IDS.map((id) => (
            <option key={id} value={id}>{id.slice(0, 8)}…</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
        </Button>
        <Button size="sm" variant="outline" onClick={clearOld}>
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar &gt;24h
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold">
              <tr>
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Dir</th>
                <th className="px-3 py-2">Função</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">ms</th>
                <th className="px-3 py-2">Rota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : (logs ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sem logs ainda — dispare uma ação na loja monitorada.</td></tr>
              ) : logs!.map((l) => (
                <Fragment key={l.id}>
                  <tr
                    className={`hover:bg-muted/30 cursor-pointer ${l.direction === "error" ? "bg-destructive/5" : ""}`}
                    onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2"><DirectionIcon d={l.direction} /></td>
                    <td className="px-3 py-2 font-mono font-bold">{l.function_name}</td>
                    <td className="px-3 py-2">
                      {l.status ? (
                        <Badge variant={l.status >= 400 ? "destructive" : "outline"}>{l.status}</Badge>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{l.duration_ms ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]">{l.route ?? "—"}</td>
                  </tr>
                  {expandedId === l.id && (
                    <tr>
                      <td colSpan={6} className="px-3 py-3 bg-muted/20">
                        {l.error && (
                          <div className="mb-2 p-2 rounded bg-destructive/10 text-destructive text-xs font-mono whitespace-pre-wrap break-all">
                            {l.error}
                          </div>
                        )}
                        {l.payload != null && (
                          <pre className="bg-background rounded p-2 text-[11px] overflow-x-auto max-h-64">
                            {JSON.stringify(l.payload, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DebugLojaTab;