// @ts-nocheck — tabelas/RPCs de estoque vivem no banco externo e não estão nos tipos gerados
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
  PackageCheck,
  Boxes,
  TrendingDown,
  CircleDollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  Info,
  X
} from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";
import { ScanLine } from "lucide-react";
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
  unit: string;
  is_ingredient?: boolean;
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
  const [hideHowItWorks, setHideHowItWorks] = useState(false);
  const [activateQty, setActivateQty] = useState("");
  const [activateMin, setActivateMin] = useState("");
  const [activateUnit, setActivateUnit] = useState("un");
  // Novo insumo (só estoque)
  const [insumoName, setInsumoName] = useState("");
  const [insumoQty, setInsumoQty] = useState("");
  const [insumoUnit, setInsumoUnit] = useState("kg");
  const [insumoMin, setInsumoMin] = useState("");
  const [adjustDialog, setAdjustDialog] = useState<StockItem | null>(null);
  const [adjustType, setAdjustType] = useState("in");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [historyProduct, setHistoryProduct] = useState<StockItem | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["stock-list", storeId],
    queryFn: async () => {
      const { data: products } = await supabase
        .from("products")
        .select("id, name, price, image_url")
        .eq("store_id", storeId)
        .eq("is_available", true)
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
          unit: s?.unit || "un",
        } as StockItem;
      });
    },
  });

  // Insumos: itens só de estoque (metadata.is_ingredient) — não são
  // produtos do cardápio; são os ingredientes das fichas técnicas.
  const { data: insumos = [] } = useQuery({
    queryKey: ["stock-insumos", storeId],
    queryFn: async () => {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price, image_url, metadata")
        .eq("store_id", storeId)
        .order("name");
      const { data: stocks } = await supabase
        .from("product_stock")
        .select("*")
        .eq("store_id", storeId);
      const stockMap = new Map((stocks || []).map((s: any) => [s.product_id, s]));
      return ((prods || []) as any[])
        .filter((p) => p.metadata?.is_ingredient === true)
        .map((p) => {
          const s = stockMap.get(p.id);
          return {
            product_id: p.id,
            product_name: p.name,
            product_price: Number(p.price),
            product_image: p.image_url,
            quantity: s ? Number(s.quantity) : 0,
            min_quantity: s ? Number(s.min_quantity) : 0,
            track_stock: s ? s.track_stock : false,
            unit: s?.unit || "un",
            is_ingredient: true,
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
    queryClient.invalidateQueries({ queryKey: ["stock-insumos"] });
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

      const { error: eUnit } = await (supabase as any).rpc("stock_set_unit", {
        _product_id: activateDialog.product_id,
        _unit: activateUnit,
      });
      if (eUnit) throw eUnit;

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
      setActivateUnit("un");
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
    onError: (e: any) => {
      toast.error(e?.message || "Erro ao desativar controle");
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

  // Criar insumo: nasce como item só de estoque (metadata.is_ingredient,
  // is_available=false) — não aparece no cardápio, no PDV nem pra clientes.
  const createInsumoMutation = useMutation({
    mutationFn: async () => {
      const name = insumoName.trim();
      if (!name) throw new Error("Digite o nome do insumo");
      const { data: inserted, error } = await supabase
        .from("products")
        .insert({
          store_id: storeId,
          name,
          price: 0,
          is_available: false,
          metadata: { is_ingredient: true },
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      const pid = (inserted as any).id;

      const { error: e1 } = await supabase.rpc("stock_toggle_tracking", {
        _product_id: pid,
        _track: true,
      });
      if (e1) throw e1;

      const { error: eUnit } = await (supabase as any).rpc("stock_set_unit", {
        _product_id: pid,
        _unit: insumoUnit,
      });
      if (eUnit) throw eUnit;

      const qty = Number(insumoQty) || 0;
      if (qty > 0) {
        const { error: e2 } = await supabase.rpc("stock_adjust", {
          _product_id: pid,
          _quantity: qty,
          _type: "in",
          _reason: "Estoque inicial",
        });
        if (e2) throw e2;
      }
      const min = Number(insumoMin) || 0;
      if (min > 0) {
        await supabase.rpc("stock_set_min", {
          _product_id: pid,
          _min_quantity: min,
        });
      }
    },
    onSuccess: () => {
      toast.success("Insumo adicionado!");
      refresh();
      setInsumoName("");
      setInsumoQty("");
      setInsumoMin("");
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
  const trackedInsumos = insumos.filter((i) => i.track_stock);
  const insumosFiltrados = insumos.filter(
    (i) => !search || i.product_name.toLowerCase().includes(search.toLowerCase()),
  );

  // KPIs do estoque (produtos controlados + insumos)
  const allTracked = [...trackedItems, ...trackedInsumos];
  const totalUnits = allTracked.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  const outOfStock = allTracked.filter((i) => Number(i.quantity || 0) === 0).length;
  const stockValue = allTracked.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.product_price || 0), 0);

  return (
    <div className="space-y-4 p-4 max-w-3xl mx-auto">
      {/* KPIs - resumo do estoque */}
      {allTracked.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <PackageCheck className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Produtos controlados</span>
              </div>
              <p className="text-2xl font-bold">{allTracked.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <Boxes className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Unidades em estoque</span>
              </div>
              <p className="text-2xl font-bold">{totalUnits}</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <TrendingDown className="h-4 w-4 text-orange-600" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Estoque baixo</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">{lowStock.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CircleDollarSign className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Valor em estoque</span>
              </div>
              <p className="text-2xl font-bold">R$ {stockValue.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Como funciona - design claro (só mostra se não tem nenhum controle ativo, dispensável) */}
      {trackedItems.length === 0 && lowStock.length === 0 && !hideHowItWorks && (
        <Card className="bg-white relative">
          <CardContent className="pt-4">
            <button
              onClick={() => setHideHowItWorks(true)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
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
              {lowStock.map((p: any) => {
                const item = items.find((i) => i.product_id === p.product_id);
                return (
                  <div key={p.product_id} className="flex items-center gap-2 bg-orange-50 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.product_name}</p>
                      <span className={`font-bold text-xs px-2 py-0.5 rounded inline-block mt-1 ${Number(p.quantity) <= 0 ? "bg-red-600 text-white" : "bg-orange-500 text-white"}`}>
                        {Number(p.quantity) <= 0 ? "ESGOTADO" : `só ${p.quantity} un`}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white font-bold shrink-0"
                      onClick={() => {
                        if (item) {
                          setAdjustDialog(item);
                        } else {
                          // Fallback: cria item temporário com dados do alerta
                          setAdjustDialog({
                            product_id: p.product_id,
                            product_name: p.product_name,
                            product_price: 0,
                            product_image: null,
                            quantity: Number(p.quantity),
                            min_quantity: Number(p.min_quantity),
                            track_stock: true,
                          });
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Repor
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Busca + Scanner */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setShowScanner(true)}
          title="Escanear código de barras"
        >
          <ScanLine className="h-5 w-5" />
        </Button>
      </div>
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setShowScanner(false);
            setSearch(code);
            toast.success(`Código lido: ${code}`);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

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
                          <span className="text-sm font-medium">{item.unit === "un" ? "unidades" : item.unit}</span>
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
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm text-muted-foreground">
              ⭕ Sem controle ({notTracked.length})
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm(`Ativar controle de estoque para ${notTracked.length} produtos?\n\nVocê poderá ajustar as quantidades depois.`)) {
                  // Ativa todos de uma vez com quantidade 0
                  Promise.all(
                    notTracked.map((item) =>
                      supabase.from("product_stock").upsert({
                        product_id: item.product_id,
                        store_id: storeId,
                        quantity: 0,
                        min_quantity: 5,
                        track_stock: true,
                      }, { onConflict: "product_id,store_id" })
                    )
                  ).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["stock-list", storeId] });
                    toast.success(`${notTracked.length} produtos com controle ativado! Ajuste as quantidades.`);
                  });
                }
              }}
            >
              Ativar todos
            </Button>
          </div>
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

      {/* Insumos — só estoque (não aparecem no cardápio nem pra clientes) */}
      <div>
        <h3 className="font-semibold text-sm text-muted-foreground mb-1">
          Insumos — só estoque ({insumosFiltrados.length})
        </h3>
        <p className="text-xs text-muted-foreground mb-2">
          Arroz, feijão, óleo… não aparecem no cardápio nem pra clientes. São os ingredientes das fichas técnicas.
        </p>
        {insumosFiltrados.length > 0 && (
          <div className="space-y-2">
            {insumosFiltrados.map((item) => {
              if (!item.track_stock) {
                return (
                  <Card key={item.product_id} className="opacity-75">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Package className="h-8 w-8 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">Insumo</p>
                        </div>
                        <Button size="sm" onClick={() => setActivateDialog(item)}>
                          Ativar controle
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
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
                          <span className="text-sm font-medium">{item.unit === "un" ? "unidades" : item.unit}</span>
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
        )}

        {/* Novo insumo */}
        <Card className="mt-3">
          <CardContent className="p-4 space-y-3">
            <p className="font-bold text-sm">Novo insumo</p>
            <div>
              <Label>Nome do insumo</Label>
              <Input
                placeholder="Ex: Arroz branco"
                value={insumoName}
                onChange={(e) => setInsumoName(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Quantidade atual</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 5"
                  value={insumoQty}
                  onChange={(e) => setInsumoQty(e.target.value)}
                />
              </div>
              <div className="w-24">
                <Label>Unidade</Label>
                <Select value={insumoUnit} onValueChange={setInsumoUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">un</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>Mínimo (opcional)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 1"
                  value={insumoMin}
                  onChange={(e) => setInsumoMin(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => createInsumoMutation.mutate()}
              disabled={!insumoName.trim() || createInsumoMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar insumo
            </Button>
          </CardContent>
        </Card>
      </div>

      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-semibold text-sm">
            {items.length === 0 ? "Nenhum produto cadastrado" : "Nenhum produto encontrado"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {items.length === 0
              ? "Cadastre produtos no cardápio para controlar o estoque"
              : "Tente buscar por outro nome ou código"}
          </p>
        </div>
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
            <div className="flex gap-2">
              <div className="flex-1">
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
              <div className="w-28">
                <Label className="text-base">Unidade</Label>
                <Select value={activateUnit} onValueChange={setActivateUnit}>
                  <SelectTrigger className="text-lg h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">un</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
