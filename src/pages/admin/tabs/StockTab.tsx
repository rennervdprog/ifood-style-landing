import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Package,
  AlertTriangle,
  Plus,
  Minus,
  Search,
  History,
  PackageX,
  ArrowUpCircle,
  ArrowDownCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  storeId: string;
}

interface StockItem {
  product_id: string;
  product_name: string;
  product_price: number;
  product_image: string | null;
  quantity: number;
  min_quantity: number;
  track_stock: boolean;
}

const MOVEMENT_LABELS: Record<string, string> = {
  in: "Entrada",
  out: "Saída",
  adjust: "Ajuste",
  sale: "Venda",
  loss: "Perda",
  return: "Devolução",
};

export default function StockTab({ storeId }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showOnlyLow, setShowOnlyLow] = useState(false);

  // Dialogs
  const [activateDialog, setActivateDialog] = useState<StockItem | null>(null);
  const [activateQty, setActivateQty] = useState("");
  const [activateMin, setActivateMin] = useState("");
  const [adjustDialog, setAdjustDialog] = useState<StockItem | null>(null);
  const [adjustType, setAdjustType] = useState("in");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [historyProduct, setHistoryProduct] = useState<StockItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["stock-list", storeId],
    queryFn: async () => {
      const { data: products } = await supabase
        .from("products")
        .select("id, name, price, image_url")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("name");
      const { data: stocks } = await supabase
        .from("product_stock")
        .select("*")
        .eq("store_id", storeId);
      const stockMap = new Map((stocks || []).map((s: any) => [s.product_id, s]));
      return (products || []).map((p: any) => {
        const s = stockMap.get(p.id);
        return {
          product_id: p.id,
          product_name: p.name,
          product_price: Number(p.price),
          product_image: p.image_url,
          quantity: s ? Number(s.quantity) : 0,
          min_quantity: s ? Number(s.min_quantity) : 0,
          track_stock: s ? s.track_stock : false,
        } as StockItem;
      });
    },
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ["low-stock", storeId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_low_stock_products", {
        _store_id: storeId,
      });
      return data || [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["stock-history", historyProduct?.product_id],
    queryFn: async () => {
      if (!historyProduct) return [];
      const { data } = await supabase
        .from("product_stock_movements")
        .select("*")
        .eq("product_id", historyProduct.product_id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!historyProduct,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-list"] });
    queryClient.invalidateQueries({ queryKey: ["low-stock"] });
  };

  // Ativar controle com estoque inicial
  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!activateDialog) throw new Error("Erro interno");
      const qty = Number(activateQty) || 0;
      const min = Number(activateMin) || 0;

      const { error: e1 } = await supabase.rpc("stock_toggle_tracking", {
        _product_id: activateDialog.product_id,
        _track: true,
      });
      if (e1) throw e1;

      if (qty > 0) {
        const { error: e2 } = await supabase.rpc("stock_adjust", {
          _product_id: activateDialog.product_id,
          _quantity: qty,
          _type: "in",
          _reason: "Estoque inicial",
        });
        if (e2) throw e2;
      }
      if (min > 0) {
        await supabase.rpc("stock_set_min", {
          _product_id: activateDialog.product_id,
          _min_quantity: min,
        });
      }
    },
    onSuccess: () => {
      toast.success("Controle de estoque ativado!");
      refresh();
      setActivateDialog(null);
      setActivateQty("");
      setActivateMin("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (item: StockItem) => {
      const { error } = await supabase.rpc("stock_toggle_tracking", {
        _product_id: item.product_id,
        _track: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Controle desativado");
      refresh();
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!adjustDialog || !adjustQty) throw new Error("Digite a quantidade");
      const { error } = await supabase.rpc("stock_adjust", {
        _product_id: adjustDialog.product_id,
        _quantity: Number(adjustQty),
        _type: adjustType,
        _reason: adjustReason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estoque atualizado!");
      refresh();
      setAdjustDialog(null);
      setAdjustQty("");
      setAdjustReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = items.filter((item) => {
    if (search && !item.product_name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (showOnlyLow) {
      // Usa a mesma lógica do RPC: track ativo E quantidade <= mínimo
      return item.track_stock && Number(item.quantity) <= Number(item.min_quantity);
    }
    return true;
  });

  const trackedItems = items.filter((i) => i.track_stock);
  const notTracked = items.filter((i) => !i.track_stock);

  return (
    <div className="space-y-4 p-4 max-w-3xl mx-auto">
      {/* Como funciona - design claro */}
      {trackedItems.length === 0 && (
        <Card className="bg-white">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Info className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-base mb-2">
                  Como funciona
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                    <span>Clique em <strong>"Ativar"</strong> no produto abaixo</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                    <span>Digite <strong>quantas unidades</strong> você tem</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                    <span>Pronto! <strong>Baixa sozinho</strong> a cada venda</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerta estoque baixo - design claro */}
      {lowStock.length > 0 && (
        <Card className="bg-white border-l-4 border-l-orange-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <span className="font-bold text-base">
                {lowStock.length} produto{lowStock.length > 1 ? "s" : ""} precisando repor
              </span>
            </div>
            <div className="space-y-2">
              {lowStock.map((p: any) => (
                <div key={p.product_id} className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2">
                  <span className="font-medium text-sm">{p.product_name}</span>
                  <span className={`font-bold text-sm px-2 py-1 rounded ${Number(p.quantity) <= 0 ? "bg-red-600 text-white" : "bg-orange-500 text-white"}`}>
                    {Number(p.quantity) <= 0 ? "ESGOTADO" : `só ${p.quantity} un`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {lowStock.length > 0 && (
        <Button
          variant={showOnlyLow ? "default" : "outline"}
          size="sm"
          onClick={() => setShowOnlyLow(!showOnlyLow)}
        >
          {showOnlyLow ? "Mostrar todos" : `Ver só os ${lowStock.length} com estoque baixo`}
        </Button>
      )}

      {/* Produtos COM controle */}
      {trackedItems.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">
            ✅ Com controle de estoque ({trackedItems.length})
          </h3>
          <div className="space-y-2">
            {filtered.filter((i) => i.track_stock).map((item) => {
              const isLow = item.quantity <= item.min_quantity;
              const isZero = item.quantity <= 0;
              return (
                <Card key={item.product_id} className={isZero ? "border-red-500 border-2" : isLow ? "border-orange-400 border-2" : ""}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product_name}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-3xl font-black px-3 py-1 rounded-lg ${isZero ? "bg-red-600 text-white" : isLow ? "bg-orange-500 text-white" : "bg-green-600 text-white"}`}>
                            {item.quantity}
                          </span>
                          <span className="text-sm font-medium">unidades</span>
                        </div>
                        <div className="mt-1">
                          {isZero && (
                            <Badge className="bg-red-600 text-white font-bold">ESGOTADO</Badge>
                          )}
                          {isLow && !isZero && (
                            <Badge className="bg-orange-500 text-white font-bold">⚠️ REPOR — mín: {item.min_quantity}</Badge>
                          )}
                          {!isLow && !isZero && (
                            <Badge className="bg-green-600 text-white">Em estoque</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await supabase.rpc("stock_adjust", {
                                _product_id: item.product_id,
                                _quantity: 1,
                                _type: "out",
                                _reason: "Saída manual",
                              });
                              refresh();
                            }}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAdjustDialog(item)}
                          >
                            <Plus className="h-4 w-4" /> Ajustar
                          </Button>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7"
                            onClick={() => setHistoryProduct(item)}
                          >
                            <History className="h-3 w-3 mr-1" /> Ver histórico
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Produtos SEM controle */}
      {notTracked.length > 0 && filtered.some((i) => !i.track_stock) && (
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">
            ⭕ Sem controle ({notTracked.length}) — clique para ativar
          </h3>
          <div className="space-y-2">
            {filtered.filter((i) => !i.track_stock).map((item) => (
              <Card key={item.product_id} className="opacity-75">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        R$ {item.product_price.toFixed(2)}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setActivateDialog(item)}>
                      Ativar controle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <p className="text-center text-muted-foreground py-8">
          Nenhum produto encontrado
        </p>
      )}

      {/* Dialog: Ativar controle */}
      <Dialog open={!!activateDialog} onOpenChange={() => setActivateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ativar controle de estoque</DialogTitle>
            <DialogDescription>
              <strong>{activateDialog?.product_name}</strong>
              <br />
              Quantas unidades você tem agora em estoque?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-base">Quantidade atual</Label>
              <Input
                type="number"
                min="0"
                value={activateQty}
                onChange={(e) => setActivateQty(e.target.value)}
                placeholder="Ex: 50"
                className="text-lg h-12"
                autoFocus
              />
            </div>
            <div>
              <Label>Avise-me quando chegar em (opcional)</Label>
              <Input
                type="number"
                min="0"
                value={activateMin}
                onChange={(e) => setActivateMin(e.target.value)}
                placeholder="Ex: 10"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Vamos te avisar quando o estoque ficar baixo
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
            >
              Ativar controle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ajustar estoque */}
      <Dialog open={!!adjustDialog} onOpenChange={() => setAdjustDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar: {adjustDialog?.product_name}</DialogTitle>
            <DialogDescription>
              Estoque atual: <strong>{adjustDialog?.quantity} unidades</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>O que aconteceu?</Label>
              <Select value={adjustType} onValueChange={setAdjustType}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">📦 Chegou mercadoria (entrada)</SelectItem>
                  <SelectItem value="out">📤 Saiu do estoque (saída)</SelectItem>
                  <SelectItem value="loss">🗑️ Perdeu/estragou (perda)</SelectItem>
                  <SelectItem value="adjust">🔢 Corrigir (definir valor exato)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-base">Quantidade</Label>
              <Input
                type="number"
                min="0"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="Ex: 20"
                className="text-lg h-12"
              />
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Ex: compra do fornecedor"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={() => adjustMutation.mutate()}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Histórico */}
      <Dialog open={!!historyProduct} onOpenChange={() => setHistoryProduct(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico: {historyProduct?.product_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {history.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 p-2 border rounded-lg text-sm">
                <div className="flex-1">
                  <p className="font-medium">
                    {MOVEMENT_LABELS[m.type]}: {m.quantity > 0 ? "+" : ""}{m.type === "in" || m.type === "return" ? m.quantity : m.type === "adjust" ? `→ ${m.balance_after}` : `-${m.quantity}`} un
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.reason || "—"} · Saldo: {m.balance_after}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma movimentação ainda
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (historyProduct) deactivateMutation.mutate(historyProduct);
                setHistoryProduct(null);
              }}
            >
              Desativar controle deste produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
