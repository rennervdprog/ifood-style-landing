import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  AlertTriangle,
  Plus,
  Minus,
  Search,
  History,
  TrendingUp,
  TrendingDown,
  PackageX,
  ArrowUpCircle,
  ArrowDownCircle,
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

const MOVEMENT_ICONS: Record<string, any> = {
  in: ArrowUpCircle,
  out: ArrowDownCircle,
  adjust: History,
  sale: TrendingDown,
  loss: PackageX,
  return: ArrowUpCircle,
};

export default function StockTab({ storeId }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "zero" | "tracked">("all");
  const [adjustDialog, setAdjustDialog] = useState<StockItem | null>(null);
  const [historyProduct, setHistoryProduct] = useState<StockItem | null>(null);
  const [adjustType, setAdjustType] = useState("in");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [minQtyDialog, setMinQtyDialog] = useState<StockItem | null>(null);
  const [minQtyValue, setMinQtyValue] = useState("");

  // Lista produtos com estoque
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

  // Alertas de estoque baixo
  const { data: lowStock = [] } = useQuery({
    queryKey: ["low-stock", storeId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_low_stock_products", {
        _store_id: storeId,
      });
      return data || [];
    },
  });

  // Histórico de movimentações
  const { data: history = [] } = useQuery({
    queryKey: ["stock-history", storeId, historyProduct?.product_id],
    queryFn: async () => {
      let q = supabase
        .from("product_stock_movements")
        .select("*, products(name)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (historyProduct) q = q.eq("product_id", historyProduct.product_id);
      const { data } = await q;
      return data || [];
    },
    enabled: !!historyProduct || filter === "history",
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!adjustDialog || !adjustQty) throw new Error("Preencha a quantidade");
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
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      setAdjustDialog(null);
      setAdjustQty("");
      setAdjustReason("");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao ajustar estoque"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ productId, track }: { productId: string; track: boolean }) => {
      const { error } = await supabase.rpc("stock_toggle_tracking", {
        _product_id: productId,
        _track: track,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
    },
  });

  const minQtyMutation = useMutation({
    mutationFn: async () => {
      if (!minQtyDialog) return;
      const { error } = await supabase.rpc("stock_set_min", {
        _product_id: minQtyDialog.product_id,
        _min_quantity: Number(minQtyValue),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estoque mínimo atualizado!");
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      setMinQtyDialog(null);
    },
  });

  const quickAdjust = async (item: StockItem, delta: number) => {
    const type = delta > 0 ? "in" : "out";
    const { error } = await supabase.rpc("stock_adjust", {
      _product_id: item.product_id,
      _quantity: Math.abs(delta),
      _type: type,
      _reason: "Ajuste rápido",
    });
    if (error) toast.error(error.message);
    else {
      queryClient.invalidateQueries({ queryKey: ["stock-list"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
    }
  };

  const filtered = items.filter((item) => {
    if (search && !item.product_name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (filter === "low") return item.track_stock && item.quantity <= item.min_quantity && item.quantity > 0;
    if (filter === "zero") return item.track_stock && item.quantity <= 0;
    if (filter === "tracked") return item.track_stock;
    return true;
  });

  const totalValue = items
    .filter((i) => i.track_stock)
    .reduce((acc, i) => acc + i.quantity * i.product_price, 0);
  const trackedCount = items.filter((i) => i.track_stock).length;
  const zeroCount = items.filter((i) => i.track_stock && i.quantity <= 0).length;

  return (
    <div className="space-y-4 p-4">
      {/* Alertas */}
      {lowStock.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-semibold">
                {lowStock.length} produto{lowStock.length > 1 ? "s" : ""} com estoque baixo
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {lowStock.slice(0, 5).map((p: any) => (
                <Badge key={p.product_id} variant="outline" className="bg-white">
                  {p.product_name}: {p.quantity} un
                </Badge>
              ))}
              {lowStock.length > 5 && (
                <Badge variant="secondary">+{lowStock.length - 5} outros</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <Package className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{trackedCount}</p>
            <p className="text-xs text-muted-foreground">Com controle</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <PackageX className="h-5 w-5 mx-auto text-red-500 mb-1" />
            <p className="text-2xl font-bold">{zeroCount}</p>
            <p className="text-xs text-muted-foreground">Zerados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
            <p className="text-2xl font-bold">
              R$ {totalValue.toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground">Valor em estoque</p>
          </CardContent>
        </Card>
      </div>

      {/* Busca e filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="tracked">Com controle</SelectItem>
            <SelectItem value="low">Estoque baixo</SelectItem>
            <SelectItem value="zero">Zerados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {isLoading && <p className="text-center text-muted-foreground py-8">Carregando...</p>}
        {filtered.map((item) => (
          <Card key={item.product_id}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {item.product_image ? (
                  <img
                    src={item.product_image}
                    alt={item.product_name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.product_name}</p>
                  <p className="text-sm text-muted-foreground">
                    R$ {item.product_price.toFixed(2)}
                  </p>
                  {item.track_stock ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={item.quantity <= 0 ? "destructive" : item.quantity <= item.min_quantity ? "outline" : "secondary"}
                        className={item.quantity <= item.min_quantity && item.quantity > 0 ? "border-amber-500 text-amber-700" : ""}
                      >
                        {item.quantity} un
                      </Badge>
                      {item.quantity <= item.min_quantity && (
                        <span className="text-xs text-amber-600">
                          mín: {item.min_quantity}
                        </span>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="mt-1">Sem controle</Badge>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Switch
                    checked={item.track_stock}
                    onCheckedChange={(v) =>
                      toggleMutation.mutate({ productId: item.product_id, track: v })
                    }
                  />
                  {item.track_stock && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => quickAdjust(item, -1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => setAdjustDialog(item)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setHistoryProduct(item)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {item.track_stock && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-6 px-0 text-xs"
                  onClick={() => {
                    setMinQtyDialog(item);
                    setMinQtyValue(String(item.min_quantity));
                  }}
                >
                  Definir estoque mínimo
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum produto encontrado
          </p>
        )}
      </div>

      {/* Dialog de ajuste */}
      <Dialog open={!!adjustDialog} onOpenChange={() => setAdjustDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar estoque — {adjustDialog?.product_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de movimentação</Label>
              <Select value={adjustType} onValueChange={setAdjustType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada (compra)</SelectItem>
                  <SelectItem value="out">Saída</SelectItem>
                  <SelectItem value="loss">Perda / quebra</SelectItem>
                  <SelectItem value="adjust">Ajuste (definir valor)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                min="0"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="0"
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
            <Button onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog estoque mínimo */}
      <Dialog open={!!minQtyDialog} onOpenChange={() => setMinQtyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estoque mínimo — {minQtyDialog?.product_name}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Quantidade mínima (alerta)</Label>
            <Input
              type="number"
              min="0"
              value={minQtyValue}
              onChange={(e) => setMinQtyValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMinQtyDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={() => minQtyMutation.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog histórico */}
      <Dialog open={!!historyProduct} onOpenChange={() => setHistoryProduct(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico — {historyProduct?.product_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {history.map((m: any) => {
              const Icon = MOVEMENT_ICONS[m.type] || History;
              return (
                <div key={m.id} className="flex items-center gap-3 p-2 border rounded-lg">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {MOVEMENT_LABELS[m.type] || m.type} — {m.quantity} un
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.reason || "—"} · Saldo: {m.balance_after} un
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })}
            {history.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma movimentação
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
