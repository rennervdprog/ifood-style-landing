import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { ClipboardList, Clock, ChefHat, Truck, CheckCircle2 } from "lucide-react";

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pendente: { label: "Pendente", icon: Clock, color: "text-yellow-500" },
  preparando: { label: "Preparando", icon: ChefHat, color: "text-orange-500" },
  pronto_para_entrega: { label: "Pronto p/ entrega", icon: CheckCircle2, color: "text-purple-500" },
  saiu_entrega: { label: "Saiu p/ entrega", icon: Truck, color: "text-blue-500" },
  em_transito: { label: "Em trânsito", icon: Truck, color: "text-cyan-500" },
  entregue: { label: "Entregue", icon: CheckCircle2, color: "text-green-500" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, color: "text-green-500" },
};

const PedidosPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name), order_items(*, products(name))")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `client_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4">
          <h1 className="font-bold text-foreground">Meus Pedidos</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-1">Faça login</h2>
          <p className="text-sm text-muted-foreground">Entre para ver seus pedidos.</p>
          <button
            onClick={() => navigate("/auth")}
            className="mt-6 bg-primary text-primary-foreground font-bold px-8 py-3 rounded-2xl"
          >
            Entrar
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4">
        <h1 className="font-bold text-foreground">Meus Pedidos</h1>
      </header>

      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl p-4 border border-border animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : orders && orders.length > 0 ? (
          orders.map((order: any) => {
            const config = statusConfig[order.status] || statusConfig.pendente;
            const StatusIcon = config.icon;
            return (
              <div key={order.id} className="bg-card rounded-2xl p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm text-foreground">
                    {order.stores?.name || "Loja"}
                  </h3>
                  <div className={`flex items-center gap-1 text-xs font-bold ${config.color}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {config.label}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {order.order_items?.map((item: any) => (
                    <p key={item.id}>
                      {item.quantity}x {item.products?.name || "Item"}
                    </p>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-sm font-black text-primary">
                    R$ {Number(order.total_price).toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-1">Nenhum pedido ainda</h2>
            <p className="text-sm text-muted-foreground">Seus pedidos aparecerão aqui.</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default PedidosPage;
