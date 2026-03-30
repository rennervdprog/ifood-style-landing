import BottomNav from "@/components/BottomNav";
import { ClipboardList } from "lucide-react";

const PedidosPage = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4">
        <h1 className="font-bold text-foreground">Meus Pedidos</h1>
      </header>
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold text-foreground mb-1">Nenhum pedido ainda</h2>
        <p className="text-sm text-muted-foreground">Seus pedidos aparecerão aqui.</p>
      </div>
      <BottomNav />
    </div>
  );
};

export default PedidosPage;
