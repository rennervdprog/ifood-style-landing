import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FlaskConical, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Result = { ok?: boolean; created?: any[]; removed?: string[]; stores?: any[]; password?: string; error?: string };

export default function SandboxTestsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = async (action: "seed" | "cleanup" | "status") => {
    setLoading(action);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("seed-test-accounts", { body: { action } });
      if (error) throw error;
      setResult(data as Result);
      if ((data as any)?.error) toast.error((data as any).error);
      else toast.success(`Ação "${action}" concluída`);
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Sandbox · Testes Asaas</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfis fake</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cria 3 lojistas, 2 motoboys e 2 clientes sandbox no banco externo.
            Emails usam o domínio <code>@itasuper.test</code>. Stores ficam com <code>is_test=true</code>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!!loading} onClick={() => run("seed")}>
              {loading === "seed" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
              Criar perfis sandbox
            </Button>
            <Button variant="secondary" disabled={!!loading} onClick={() => run("status")}>
              {loading === "status" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Ver lojas de teste
            </Button>
            <Button variant="destructive" disabled={!!loading} onClick={() => run("cleanup")}>
              {loading === "cleanup" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Limpar tudo
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {result.password && (
              <p>Senha padrão: <code className="bg-muted px-2 py-1 rounded">{result.password}</code></p>
            )}
            {Array.isArray(result.created) && result.created.length > 0 && (
              <div className="space-y-1">
                <p className="font-semibold">Criados ({result.created.length}):</p>
                {result.created.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{c.kind}</Badge>
                    <span>{c.email}</span>
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(result.removed) && (
              <p>Removidos: {result.removed.length}</p>
            )}
            {Array.isArray(result.stores) && (
              <div className="space-y-1">
                <p className="font-semibold">Lojas de teste ({result.stores.length}):</p>
                {result.stores.map((s) => (
                  <div key={s.id} className="text-xs flex items-center gap-2">
                    <Badge variant={s.asaas_wallet_id ? "default" : "secondary"}>
                      {s.asaas_wallet_id ? "Asaas OK" : "Sem Asaas"}
                    </Badge>
                    <span>{s.name}</span>
                    <span className="text-muted-foreground">({s.status})</span>
                  </div>
                ))}
              </div>
            )}
            {result.error && <p className="text-destructive">{result.error}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}