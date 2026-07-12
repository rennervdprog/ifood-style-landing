import { Clock, ChefHat, Package, Truck, CheckCircle2 } from "lucide-react";
import type { OrderTabKey } from "../../types";

interface Props { activeTab: OrderTabKey; }

const CONFIG: Record<string, { icon: any; title: string; hint: string }> = {
  pendente: { icon: Clock, title: "Tudo em ordem! 🎉", hint: "Novos pedidos aparecerão automaticamente. Relaxe! 😎" },
  preparando: { icon: ChefHat, title: "Nenhum pedido em preparo", hint: "Aceite pedidos pendentes para começar a produzir." },
  pronto_para_entrega: { icon: Package, title: "Nenhum pedido pronto", hint: "Marque pedidos como prontos quando finalizarem." },
  delivery: { icon: Truck, title: "Nenhuma entrega em andamento", hint: "Entregas em andamento aparecerão aqui." },
  entregue: { icon: CheckCircle2, title: "Nenhum pedido aqui", hint: "Pedidos concluídos aparecerão aqui." },
  finalizado: { icon: CheckCircle2, title: "Nenhum pedido aqui", hint: "Pedidos concluídos aparecerão aqui." },
};

export default function OrdersEmptyState({ activeTab }: Props) {
  const cfg = CONFIG[activeTab] || CONFIG.pendente;
  const Icon = cfg.icon;
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-14 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-base font-black text-foreground mb-1.5">{cfg.title}</p>
      <p className="text-sm text-muted-foreground max-w-[240px]">{cfg.hint}</p>
    </div>
  );
}