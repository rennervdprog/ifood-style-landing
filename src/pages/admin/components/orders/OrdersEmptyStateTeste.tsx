import { Clock, ChefHat, Package, Truck, CheckCircle2 } from "lucide-react";
import type { OrderTabKey } from "../../types";

interface Props {
  activeTab: OrderTabKey;
  /** Quando true, mostra erro de carregamento (com tentar de novo) em vez de "vazio". */
  loadError?: boolean;
  onRetry?: () => void;
}

const CONFIG: Record<string, { icon: any; title: string; hint: string }> = {
  pendente: { icon: Clock, title: "Tudo em ordem! 🎉", hint: "Novos pedidos aparecerão automaticamente. Relaxe! 😎" },
  preparando: { icon: ChefHat, title: "Nenhum pedido em preparo", hint: "Aceite pedidos pendentes para começar a produzir." },
  pronto_para_entrega: { icon: Package, title: "Nenhum pedido pronto", hint: "Marque pedidos como prontos quando finalizarem." },
  delivery: { icon: Truck, title: "Nenhuma entrega em andamento", hint: "Entregas em andamento aparecerão aqui." },
  entregue: { icon: CheckCircle2, title: "Nenhum pedido aqui", hint: "Pedidos concluídos aparecerão aqui." },
  finalizado: { icon: CheckCircle2, title: "Nenhum pedido aqui", hint: "Pedidos concluídos aparecerão aqui." },
};

/**
 * CÓPIA DE TESTE (/admin-teste) de OrdersEmptyState.
 * Idêntica ao original, EXCETO: com loadError, distingue "falha ao carregar"
 * de "nenhum pedido" e oferece "Tentar novamente".
 */
export default function OrdersEmptyStateTeste({ activeTab, loadError, onRetry }: Props) {
  if (loadError) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-14 text-center">
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 bg-destructive/10">
          <Clock className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-base font-black text-foreground mb-1.5">Não foi possível carregar os pedidos</p>
        <p className="text-sm text-muted-foreground max-w-[280px] mb-4">Verifique sua conexão e tente novamente. Isto não significa que não há pedidos.</p>
        {onRetry && (
          <button onClick={onRetry} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 rounded-xl text-sm h-12">
            Tentar novamente
          </button>
        )}
      </div>
    );
  }
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