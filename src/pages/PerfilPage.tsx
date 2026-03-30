import BottomNav from "@/components/BottomNav";
import { User } from "lucide-react";

const PerfilPage = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4">
        <h1 className="font-bold text-foreground">Meu Perfil</h1>
      </header>
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <User className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold text-foreground mb-1">Faça login</h2>
        <p className="text-sm text-muted-foreground">Entre para acompanhar seus pedidos.</p>
        <button className="mt-6 bg-primary text-primary-foreground font-bold px-8 py-3 rounded-2xl">
          Entrar
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default PerfilPage;
