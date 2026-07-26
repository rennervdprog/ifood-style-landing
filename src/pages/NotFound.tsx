import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
      <div className="text-7xl mb-4">🔍</div>
      <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
      <p className="text-base text-muted-foreground mb-1">Página não encontrada</p>
      <p className="text-sm text-muted-foreground mb-8 max-w-xs">
        O link que você acessou não existe ou foi removido.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => navigate("/")}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3 px-6 font-semibold hover:bg-primary/90 transition-colors"
        >
          <Home className="h-4 w-4" />
          Ir para o início
        </button>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center gap-2 bg-muted text-foreground rounded-2xl py-3 px-6 font-semibold hover:bg-muted/70 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>
    </div>
  );
};

export default NotFound;
