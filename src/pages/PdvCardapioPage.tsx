import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, BookOpen, Layers, Pizza, Shirt, Package2, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStorePdvAccess } from "@/hooks/useStorePdvAccess";
import { toast } from "sonner";
import MenuBuilder from "@/components/MenuBuilder";
import { PdvQuickGridEditor } from "@/pages/pdv/components/PdvQuickGridEditor";

// Sub-tabs pesadas — lazy para não pesar no primeiro paint do PDV.
const AddonManager = lazy(() => import("@/components/AddonManager"));
const BordasTab = lazy(() => import("@/pages/admin/tabs/BordasTab"));
const ApparelProductForm = lazy(() => import("@/pages/pdv/apparel/ApparelProductForm"));
const SnackBarCombosManager = lazy(() => import("@/pages/pdv/snackbar/SnackBarCombosManager"));
const RestaurantDailyMenuManager = lazy(() => import("@/pages/pdv/restaurant/RestaurantDailyMenuManager"));

type SubTab = "cardapio" | "adicionais" | "pizza_pastel" | "boutique" | "combos" | "daily_menu";

/** Cardápio standalone acessível a partir do PDV (principalmente pra lojas pdv_only,
 *  que não têm painel do lojista). Renderiza o mesmo MenuBuilder do painel. */
const PdvCardapioPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const selectedAdminStoreId = useMemo(() => {
    try { return localStorage.getItem("pdv_admin_selected_store"); } catch { return null; }
  }, []);

  const { data: store, isFetched } = useQuery({
    queryKey: ["pdv-cardapio-store", user?.id, selectedAdminStoreId],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();

      // 1) Super-admin operando loja fake/sandbox: respeitar seleção do PDV.
      if (adminRole) {
        try {
          const adminStoreId = selectedAdminStoreId;
          if (adminStoreId) {
            const { data } = await supabase
              .from("stores").select("id, name, category, categories, store_type")
              .eq("id", adminStoreId).maybeSingle();
            if (data) return data;
          }
        } catch {}
      }

      // 2) Loja do próprio usuário logado — fonte da verdade pra lojistas
      const { data: owned } = await supabase
        .from("stores")
        .select("id, name, category, categories, store_type")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (owned) return owned;

      try {
        const raw = localStorage.getItem("pdv_store_v1");
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.id) return cached;
        }
      } catch {}
      return null;
    },
  });

  const pdvAccess = useStorePdvAccess(store?.id);

  const cats = useMemo(() => {
    if (!store) return [] as string[];
    return [store.category, ...(((store as any).categories || []) as string[])].filter(Boolean);
  }, [store]);
  const showPizzaPastel = cats.includes("pizzas") || cats.includes("pasteis");
  const isApparel = (store as any)?.store_type === "apparel";
  const isSnackBar = (store as any)?.store_type === "snack_bar" || cats.includes("lanches");
  const isRestaurant = (store as any)?.store_type === "restaurant" || cats.includes("restaurante");

  const [sub, setSub] = useState<SubTab>("cardapio");

  useEffect(() => {
    if (isApparel && sub === "cardapio") setSub("boutique");
  }, [isApparel]); // eslint-disable-line

  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  // Gate: sem acesso ao módulo PDV → volta pra aba de plano com aviso.
  useEffect(() => {
    if (!store?.id || pdvAccess.isLoading) return;
    if (!pdvAccess.enabled) {
      toast.error("Ative o módulo PDV pra usar o caixa e o cardápio.");
      navigate("/admin?tab=plano", { replace: true });
    }
  }, [store?.id, pdvAccess.enabled, pdvAccess.isLoading, navigate]);

  if (!isFetched) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground max-w-xs">
          Nenhuma loja encontrada para o seu usuário. Abra o PDV primeiro para selecionar uma loja.
        </p>
        <button
          onClick={() => navigate("/admin/pdv")}
          className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl text-sm"
        >
          Ir para o PDV
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-12 border-b border-border bg-card flex items-center px-3 gap-2 sticky top-0 z-10">
        <button
          onClick={() => navigate("/admin/pdv")}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          title="Voltar ao PDV"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-border" />
        <span className="text-sm font-bold">Cardápio · {store.name}</span>
      </header>

      {/* Sub-abas: Cardápio / Adicionais / Pizza-Pastel */}
      <div className="sticky top-12 z-10 bg-card border-b border-border">
        <div className="flex gap-1 overflow-x-auto px-2">
          {(isApparel
            ? [
                { key: "boutique" as SubTab, label: "Modelos & Grade", icon: Shirt },
                { key: "cardapio" as SubTab, label: "Cardápio simples", icon: BookOpen },
              ]
            : ([
                { key: "cardapio", label: "Cardápio", icon: BookOpen },
                { key: "adicionais", label: "Adicionais", icon: Layers },
                ...(isSnackBar
                  ? [{ key: "combos" as SubTab, label: "Combos", icon: Package2 }]
                  : []),
                ...(isRestaurant
                  ? [{ key: "daily_menu" as SubTab, label: "Prato do Dia", icon: UtensilsCrossed }]
                  : []),
                ...(showPizzaPastel
                  ? [{ key: "pizza_pastel" as SubTab, label: cats.includes("pizzas") ? "Pizza / Pastel" : "Pastel", icon: Pizza }]
                  : []),
              ] as { key: SubTab; label: string; icon: typeof BookOpen }[])
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSub(key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                sub === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        {sub === "boutique" && isApparel && (
          <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mt-6" />}>
            <ApparelProductForm storeId={store.id} />
          </Suspense>
        )}
        {sub === "cardapio" && (
          <>
            <PdvQuickGridEditor storeId={store.id} />
            <MenuBuilder storeId={store.id} storeCategory={store.category} storeCategories={cats} />
          </>
        )}
        {sub === "adicionais" && (
          <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mt-6" />}>
            <AddonManager storeId={store.id} />
          </Suspense>
        )}
        {sub === "combos" && isSnackBar && (
          <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mt-6" />}>
            <SnackBarCombosManager storeId={store.id} />
          </Suspense>
        )}
        {sub === "daily_menu" && isRestaurant && (
          <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mt-6" />}>
            <RestaurantDailyMenuManager storeId={store.id} />
          </Suspense>
        )}
        {sub === "pizza_pastel" && showPizzaPastel && (
          <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mt-6" />}>
            <BordasTab storeId={store.id} category={store.category} categories={(store as any).categories} />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default PdvCardapioPage;