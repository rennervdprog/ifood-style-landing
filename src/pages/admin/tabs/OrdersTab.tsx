import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Printer, Loader2 } from "lucide-react";

interface OrdersTabProps {
  storeId: string;
}

export default function OrdersTab({ storeId }: OrdersTabProps) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["store-orders", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, created_at, total")
        .eq("store_id", storeId)
        .neq("status", "aguardando_pagamento" as any)
        .neq("status", "cancelado" as any)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
    staleTime: 15_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Pedidos em Tempo Real</h2>
        <div className="flex gap-2">
           <button className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
             <Printer className="h-5 w-5" />
           </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
           {orders?.length === 0 ? (
             <div className="text-center py-20 bg-muted/30 rounded-3xl">
               <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
             </div>
           ) : (
             <p className="text-muted-foreground">Listagem de pedidos modularizada (V2).</p>
           )}
        </div>
      )}
    </div>
  );
}
