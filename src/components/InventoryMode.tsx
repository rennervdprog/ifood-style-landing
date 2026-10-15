// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, ClipboardList, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Props {
  storeId: string;
  onClose: () => void;
}

interface CountItem {
  product_id: string;
  product_name: string;
  system_qty: number;
  counted_qty: number | null;
}

/**
 * Modo inventário guiado: conta produto por produto,
 * mostra progresso e resumo de divergências no final.
 * Fase 2 do plano de melhoria do estoque.
 */
export default function InventoryMode({ storeId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory-items", storeId],
    queryFn: async () => {
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("name");
      const { data: stocks } = await supabase
        .from("product_stock")
        .select("product_id, quantity")
        .eq("store_id", storeId)
        .eq("track_stock", true);
      const stockMap = new Map((stocks || []).map((s: any) => [s.product_id, Number(s.quantity)]));
      return (products || [])
        .filter((p: any) => stockMap.has(p.id))
        .map((p: any) => ({
          product_id: p.id,
          product_name: p.name,
          system_qty: stockMap.get(p.id) || 0,
          counted_qty: null,
        } as CountItem));
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (divergences: CountItem[]) => {
      for (const d of divergences) {
        await supabase.from("product_stock_movements").insert({
          product_id: d.product_id,
          store_id: storeId,
          type: "adjust",
          quantity: Math.abs(d.counted_qty! - d.system_qty),
          reason: `Inventário: sistema tinha ${d.system_qty}, contado ${d.counted_qty}`,
        });
        await supabase
          .from("product_stock")
          .update({ quantity: d.counted_qty, updated_at: new Date().toISOString() })
          .eq("product_id", d.product_id)
          .eq("store_id", storeId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-list", storeId] });
      toast.success("Inventário aplicado com sucesso!");
      onClose();
    },
  });

  if (isLoading) return <p className="text-center py-8">Carregando produtos...</p>;
  if (items.length === 0) {
    return (
      <Card><CardContent className="p-6 text-center">
        <p>Nenhum produto com controle de estoque ativo.</p>
        <Button className="mt-4" onClick={onClose}>Voltar</Button>
      </CardContent></Card>
    );
  }

  if (finished) {
    const divergences = items.filter(
      (item) => counts[item.product_id] !== undefined && counts[item.product_id] !== item.system_qty
    );
    return (
      <Card><CardContent className="p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> Resumo do inventário
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {items.length} produtos contados, {divergences.length} com diferença
        </p>
        {divergences.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600 mb-4">
            <CheckCircle className="h-5 w-5" /> Tudo certo! Nenhuma divergência.
          </div>
        ) : (
          <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {divergences.map((d) => (
              <div key={d.product_id} className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2 text-sm">
                <span className="font-medium truncate">{d.product_name}</span>
                <span className="shrink-0 ml-2">
                  Sistema: <b>{d.system_qty}</b> → Contado: <b>{counts[d.product_id]}</b>
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            disabled={applyMutation.isPending}
            onClick={() => applyMutation.mutate(divergences)}
          >
            {divergences.length > 0 ? `Aplicar ${divergences.length} ajustes` : "Concluir"}
          </Button>
        </div>
      </CardContent></Card>
    );
  }

  const current = items[currentIndex];
  const progress = Math.round(((currentIndex) / items.length) * 100);
  const counted = Object.keys(counts).length;

  return (
    <Card><CardContent className="p-6">
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Contando estoque</span>
          <span className="text-muted-foreground">{counted}/{items.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <p className="text-xs text-muted-foreground mb-1">Produto {currentIndex + 1} de {items.length}</p>
      <h3 className="font-bold text-xl mb-1">{current.product_name}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Sistema diz: <b>{current.system_qty}</b> un
      </p>

      <label className="text-sm font-medium">Quantas tem agora?</label>
      <div className="flex gap-2 mt-2">
        <Input
          type="number"
          min="0"
          placeholder="0"
          className="text-2xl font-bold text-center h-14"
          value={counts[current.product_id] ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? undefined : Number(e.target.value);
            setCounts((prev) => {
              const next = { ...prev };
              if (v === undefined) delete next[current.product_id];
              else next[current.product_id] = v;
              return next;
            });
          }}
          autoFocus
        />
      </div>

      <div className="flex gap-2 mt-6">
        {currentIndex > 0 && (
          <Button variant="outline" onClick={() => setCurrentIndex((i) => i - 1)}>
            Voltar
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={counts[current.product_id] === undefined}
          onClick={() => {
            if (currentIndex + 1 >= items.length) setFinished(true);
            else setCurrentIndex((i) => i + 1);
          }}
        >
          {currentIndex + 1 >= items.length ? "Ver resumo" : "Próximo"} <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <Button variant="ghost" className="w-full mt-2" onClick={onClose}>
        Sair do inventário
      </Button>
    </CardContent></Card>
  );
}
