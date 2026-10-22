// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChefHat, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  productId: string;
  productName: string;
  storeId: string;
  onClose: () => void;
}

/**
 * Ficha técnica: define os ingredientes de um produto.
 * Na venda, os insumos baixam automaticamente.
 * Fase 2 do plano de melhoria do estoque.
 */
export default function ProductRecipe({ productId, productName, storeId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("g");

  const { data: ingredients = [] } = useQuery({
    queryKey: ["recipe", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_recipes")
        .select("id, quantity, unit, ingredient_product_id, products!product_recipes_ingredient_product_id_fkey(name)")
        .eq("product_id", productId);
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["recipe-ingredient-options", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, is_available, metadata")
        .eq("store_id", storeId)
        .neq("id", productId)
        .order("name");
      // Ingrediente válido: produto à venda OU insumo (só estoque).
      // (A coluna is_active não existe em products — a consulta antiga
      // voltava sempre vazia e o seletor não listava nada.)
      const list = ((data || []) as any[]).filter(
        (p) => p.is_available || p.metadata?.is_ingredient === true,
      );
      // Insumos primeiro — são os ingredientes mais usados nas fichas
      return list.sort((a, b) => {
        const ai = a.metadata?.is_ingredient ? 0 : 1;
        const bi = b.metadata?.is_ingredient ? 0 : 1;
        return ai - bi || a.name.localeCompare(b.name);
      });
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("product_recipes").insert({
        product_id: productId,
        ingredient_product_id: ingredientId,
        quantity: Number(qty),
        unit: unit,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipe", productId] });
      setShowAdd(false);
      setIngredientId("");
      setQty("");
      setUnit("g");
      toast.success("Ingrediente adicionado!");
    },
    onError: () => {
      toast.error("Erro ao adicionar ingrediente");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("product_recipes").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipe", productId] });
      toast.success("Ingrediente removido!");
    },
    onError: () => {
      toast.error("Erro ao remover ingrediente");
    },
  });

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-orange-600" />
              <h3 className="font-bold text-lg">Ficha técnica</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            <b>{productName}</b> é feito com o quê? Na venda, os ingredientes baixam sozinhos.
          </p>

          <div className="space-y-2 mb-4">
            {ingredients.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum ingrediente cadastrado.<br />Adicione o primeiro abaixo.
              </p>
            )}
            {ingredients.map((ing: any) => (
              <div key={ing.id} className="flex items-center gap-2 bg-orange-50 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {ing.products?.name || "Ingrediente"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ing.quantity} {ing.unit} por unidade
                  </p>
                </div>
                <Button
                  size="sm" variant="ghost" className="text-red-600"
                  onClick={() => removeMutation.mutate(ing.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {!showAdd ? (
            <Button className="w-full" variant="outline" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar ingrediente
            </Button>
          ) : (
            <div className="space-y-3 border-t pt-4">
              <div>
                <Label>Ingrediente</Label>
                <Select value={ingredientId} onValueChange={setIngredientId}>
                  <SelectTrigger><SelectValue placeholder="Escolha o insumo ou produto" /></SelectTrigger>
                  <SelectContent className="z-[80]">
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}{p.metadata?.is_ingredient ? " (insumo)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Quantidade por unidade</Label>
                  <Input
                    type="number" min="0" step="0.01" placeholder="Ex: 150"
                    value={qty} onChange={(e) => setQty(e.target.value)}
                  />
                </div>
                <div className="w-28">
                  <Label>Unidade</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[80]">
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="un">un</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!ingredientId || !qty}
                  onClick={() => addMutation.mutate()}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
