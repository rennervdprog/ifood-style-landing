// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  storeId: string;
  onNavigateToStock: () => void;
}

/**
 * Banner de alerta proativo: aparece no topo do dashboard
 * quando há produtos com estoque baixo ou zerado.
 * Fase 1 do plano de melhoria do estoque.
 */
export default function LowStockAlertBanner({ storeId, onNavigateToStock }: Props) {
  const { data: lowStock = [] } = useQuery({
    queryKey: ["low-stock-alert", storeId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_low_stock_products", {
        _store_id: storeId,
      });
      return data || [];
    },
    refetchInterval: 60000, // atualiza a cada minuto
  });

  if (lowStock.length === 0) return null;

  const outOfStock = lowStock.filter((p: any) => Number(p.quantity) <= 0).length;

  return (
    <Card
      className="bg-white border-l-4 border-l-red-500 cursor-pointer hover:shadow-md transition-shadow mb-4"
      onClick={onNavigateToStock}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">
              {outOfStock > 0
                ? `${outOfStock} produto${outOfStock > 1 ? "s" : ""} esgotado${outOfStock > 1 ? "s" : ""}!`
                : `${lowStock.length} produto${lowStock.length > 1 ? "s" : ""} com estoque baixo`}
            </p>
            <p className="text-xs text-muted-foreground">
              Toque para ver a lista de reposição
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
