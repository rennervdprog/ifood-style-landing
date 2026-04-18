import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { FlaskConical, Trash2, ShoppingBag, DollarSign, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const TestStoreFinancePanel = () => {
  const queryClient = useQueryClient();

  const { data: testStores = [] } = useQuery({
    queryKey: ["test-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, owner_id, status, is_test")
        .eq("is_test", true);
      if (error) throw error;
      return data || [];
    },
  });

  const testStoreIds = testStores.map((s) => s.id);

  const { data: testOrders = [] } = useQuery({
    queryKey: ["test-orders", testStoreIds],
    queryFn: async () => {
      if (testStoreIds.length === 0) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, store_id, status, subtotal, total_price, app_fee, payment_method, created_at")
        .in("store_id", testStoreIds)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: testStoreIds.length > 0,
  });

  const { data: testBalances = [] } = useQuery({
    queryKey: ["test-balances", testStoreIds],
    queryFn: async () => {
      if (testStoreIds.length === 0) return [];
      const { data, error } = await supabase
        .from("store_balances")
        .select("*")
        .in("store_id", testStoreIds);
      if (error) throw error;
      return data || [];
    },
    enabled: testStoreIds.length > 0,
  });

  const totalGMV = testOrders.reduce((s, o) => s + Number(o.subtotal || 0), 0);
  const totalCommission = testOrders.reduce((s, o) => s + Number(o.app_fee || 0), 0);
  const finalizedOrders = testOrders.filter((o) => o.status === "finalizado").length;

  const handleResetBalance = async (storeId: string, storeName: string) => {
    if (!confirm(`Zerar saldos pendentes de teste de "${storeName}"?`)) return;
    const { error } = await supabase
      .from("store_balances")
      .upsert(
        {
          store_id: storeId,
          comissao_pendente: 0,
          pending_commission: 0,
          repasse_pendente: 0,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "store_id" }
      );
    if (error) toast.error("Erro ao zerar.");
    else {
      toast.success(`Saldos de "${storeName}" zerados!`);
      queryClient.invalidateQueries({ queryKey: ["test-balances"] });
    }
  };

  const handleToggleTest = async (storeId: string, storeName: string, currentIsTest: boolean) => {
    const newValue = !currentIsTest;
    const action = newValue ? "marcar como teste" : "remover marcação de teste";
    if (!confirm(`Tem certeza que deseja ${action} a loja "${storeName}"?`)) return;
    const { error } = await supabase
      .from("stores")
      .update({ is_test: newValue } as any)
      .eq("id", storeId);
    if (error) toast.error("Erro ao atualizar loja.");
    else {
      toast.success(`Loja "${storeName}" atualizada!`);
      queryClient.invalidateQueries({ queryKey: ["test-stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
        <FlaskConical className="h-6 w-6 text-amber-500" />
        <div>
          <h2 className="font-bold text-foreground">Finanças de Teste (Fictícias)</h2>
          <p className="text-xs text-muted-foreground">
            Estas lojas não geram cobrança real, comissão pendente, repasse ou ganhos para moderadores.
            Pedidos finalizados aqui são ignorados pelo painel financeiro principal e pelos cron jobs de pagamento.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-[10px] uppercase text-muted-foreground">Lojas de teste</p>
          <p className="text-2xl font-bold flex items-center gap-1"><FlaskConical className="h-4 w-4 text-amber-500" />{testStores.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-[10px] uppercase text-muted-foreground">Pedidos (todos)</p>
          <p className="text-2xl font-bold flex items-center gap-1"><ShoppingBag className="h-4 w-4 text-blue-500" />{testOrders.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-[10px] uppercase text-muted-foreground">Pedidos finalizados</p>
          <p className="text-2xl font-bold text-green-500">{finalizedOrders}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-[10px] uppercase text-muted-foreground">GMV fictício</p>
          <p className="text-2xl font-bold flex items-center gap-1"><DollarSign className="h-4 w-4 text-amber-500" />{formatBRL(totalGMV)}</p>
          <p className="text-[10px] text-muted-foreground">Comissão fake: {formatBRL(totalCommission)}</p>
        </CardContent></Card>
      </div>

      {/* Stores list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lojas marcadas como teste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {testStores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma loja marcada como teste.</p>
          ) : (
            testStores.map((store) => {
              const balance = testBalances.find((b: any) => b.store_id === store.id);
              const orders = testOrders.filter((o) => o.store_id === store.id);
              const gmv = orders.reduce((s, o) => s + Number(o.subtotal || 0), 0);
              return (
                <div key={store.id} className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{store.name}</span>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                          <FlaskConical className="h-3 w-3 mr-1" />Teste
                        </Badge>
                        <Badge variant="secondary" className="text-xs">{store.status}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono mt-1">{store.id.slice(0, 8)}…</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResetBalance(store.id, store.name)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Zerar saldos
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleTest(store.id, store.name, store.is_test)}
                      >
                        Remover marcação
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="bg-muted/40 rounded p-2">
                      <p className="text-muted-foreground">Pedidos</p>
                      <p className="font-bold">{orders.length}</p>
                    </div>
                    <div className="bg-muted/40 rounded p-2">
                      <p className="text-muted-foreground">GMV fake</p>
                      <p className="font-bold">{formatBRL(gmv)}</p>
                    </div>
                    <div className="bg-muted/40 rounded p-2">
                      <p className="text-muted-foreground">Comissão pendente</p>
                      <p className="font-bold">{formatBRL(Number(balance?.comissao_pendente || 0))}</p>
                    </div>
                    <div className="bg-muted/40 rounded p-2">
                      <p className="text-muted-foreground">Repasse pendente</p>
                      <p className="font-bold">{formatBRL(Number(balance?.repasse_pendente || 0))}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Recent orders */}
      {testOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos pedidos fictícios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {testOrders.slice(0, 20).map((o) => (
              <div key={o.id} className="flex flex-col gap-1 text-xs p-2 hover:bg-muted/40 rounded border border-border/40">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono truncate">#{o.id.slice(0, 8)}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{o.status}</Badge>
                  </div>
                  <span className="font-bold shrink-0">{formatBRL(Number(o.total_price || 0))}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span className="capitalize">{o.payment_method}</span>
                  <span>{new Date(o.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs">
        <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-blue-600 dark:text-blue-400">
          <strong>Como funciona:</strong> Toda loja com a marcação de teste tem seus pedidos finalizados ignorados pelos triggers de comissão, repasse e moderador.
          Para alternar, use o botão acima ou marque/desmarque na aba "Lojas".
        </div>
      </div>
    </div>
  );
};

export default TestStoreFinancePanel;
