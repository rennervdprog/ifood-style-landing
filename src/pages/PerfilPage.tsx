import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { User, LogOut, Store, Shield, UserPlus } from "lucide-react";
import { toast } from "sonner";

const PerfilPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: myStore } = useQuery({
    queryKey: ["my-store", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const handleSignOut = async () => {
    await signOut();
    toast.success("Você saiu da conta.");
    navigate("/");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4">
          <h1 className="font-bold text-foreground">Meu Perfil</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <User className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-1">Faça login</h2>
          <p className="text-sm text-muted-foreground">Entre para acompanhar seus pedidos.</p>
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
        <h1 className="font-bold text-foreground">Meu Perfil</h1>
      </header>
      <div className="px-4 py-6 space-y-4">
        <div className="bg-card rounded-2xl p-4 border border-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">{user.email}</h2>
            <p className="text-xs text-muted-foreground">Cliente em Itatinga</p>
          </div>
        </div>

        {myStore && (
          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-secondary text-secondary-foreground font-bold"
          >
            <Store className="h-4 w-4" />
            Painel da Loja ({myStore.name})
          </button>
        )}

        {user.email === "vinivias13@gmail.com" && (
          <button
            onClick={() => navigate("/super-admin")}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 font-bold"
          >
            <Shield className="h-4 w-4" />
            Painel Administrativo
          </button>
        )}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-card text-destructive font-bold"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default PerfilPage;
