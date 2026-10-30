// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarX, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  storeId: string;
  onNavigateToStock: () => void;
}

/**
 * Banner de alerta de produtos próximos ao vencimento (FEFO).
 * Fase 2 do plano de melhoria do estoque.
 */
export default function ExpiryAlertBanner({ storeId, onNavigateToStock }: Props) {
  const { data: expiring = [] } = useQuery({
    queryKey: ["expiring-products", storeId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_expiring_products", {
        _store_id: storeId,
        _days: 7,
      });
      return data || [];
    },
    refetchInterval: 300000, // 5 minutos
  });

  if (expiring.length === 0) return null;

  const expired = expiring.filter((p: any) => p.days_left <= 0).length;

  return (
    <Card
      className="bg-white border-l-4 border-l-yellow-500 cursor-pointer hover:shadow-md transition-shadow mb-4"
      onClick={onNavigateToStock}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
            <CalendarX className="h-5 w-5 text-yellow-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">
              {expired > 0
                ? `${expired} produto${expired > 1 ? "s" : ""} vencido${expired > 1 ? "s" : ""}!`
                : `${expiring.length} produto${expiring.length > 1 ? "s" : ""} vencendo em 7 dias`}
            </p>
            <p className="text-xs text-muted-foreground">
              Toque para ver detalhes
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
