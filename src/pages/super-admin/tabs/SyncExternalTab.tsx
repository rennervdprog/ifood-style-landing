import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, Loader2, Store } from "lucide-react";

const SyncExternalTab = () => {
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<Record<string, { count: number; error?: string }> | null>(null);

  const handleTestConnection = async () => {
    setTesting(true); setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-to-external", { body: { action: "test_connection" } });
      if (error) throw error;
      setTestResult({ success: data?.success ?? false, message: data?.message || "Sem resposta" });
      if (data?.success) toast.success("Conexão confirmada!");
      else toast.error(data?.message || "Falha na conexão");
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || "Erro desconhecido" });
      toast.error("Erro ao testar conexão");
    } finally { setTesting(false); }
  };

  const handleSyncStores = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-to-external", { body: { action: "sync_stores" } });
      if (error) throw error;
      setSyncResult(data?.results || {});
      if (data?.success) toast.success("Sincronizado!");
      else toast.warning("Concluído com erros.");
    } catch (err: any) { toast.error(err?.message || "Erro ao sincronizar"); }
    finally { setSyncing(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" /> Sincronização Externa
        </h2>
        <p className="text-sm text-muted-foreground">
          Envie dados para seu banco externo. Certifique-se de que os Secrets estão configurados.
        </p>
        <div className="space-y-2">
          <button onClick={handleTestConnection} disabled={testing}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl disabled:opacity-50">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {testing ? "Testando..." : "Teste de Conexão"}
          </button>
          {testResult && (
            <div className={`p-3 rounded-xl text-sm font-medium ${testResult.success ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>
              {testResult.success ? "✅" : "❌"} {testResult.message}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <button onClick={handleSyncStores} disabled={syncing}
            className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-bold py-3 rounded-xl disabled:opacity-50">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
            {syncing ? "Sincronizando..." : "Sincronizar Dados"}
          </button>
          {syncResult && (
            <div className="bg-muted rounded-xl p-3 space-y-1 text-sm">
              {Object.entries(syncResult).map(([table, info]) => (
                <div key={table} className="flex justify-between">
                  <span className="font-medium text-foreground">{table}</span>
                  <span className={info.error ? "text-destructive" : "text-green-500"}>
                    {info.error ? `❌ ${info.error}` : `✅ ${info.count} registros`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncExternalTab;
