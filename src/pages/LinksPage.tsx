import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Store,
  Bike,
  ShoppingBag,
  UserPlus,
  Instagram,
  MessageCircle,
  FileText,
  Shield,
  Smartphone,
  Heart,
  Link as LinkIcon,
  BookOpen,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  ShoppingBag,
  Store,
  Bike,
  Heart,
  UserPlus,
  Smartphone,
  Instagram,
  MessageCircle,
  FileText,
  Shield,
  Link: LinkIcon,
  BookOpen,
};

interface AppLink {
  id: string;
  label: string;
  description: string | null;
  url: string;
  icon: string;
  is_external: boolean;
  is_highlight: boolean;
  is_active: boolean;
  sort_order: number;
}

const LinksPage = () => {
  useEffect(() => {
    document.title = "ItaSuper · Todos os Links";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "ItaSuper — Delivery em Itatinga. Peça comida, cadastre sua loja, seja entregador e fale com a gente."
      );
    }
  }, []);

  const { data: links, isLoading } = useQuery({
    queryKey: ["app-links-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_links")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AppLink[];
    },
    staleTime: 1000 * 60, // 1 min
  });

  const isSafeUrl = (url: string) =>
    url.startsWith("/") || /^https?:\/\//i.test(url);

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent via-background to-background">
      <div className="max-w-md mx-auto px-4 py-10 sm:py-14">
        {/* Header */}
        <header className="flex flex-col items-center text-center mb-8">
          <div className="w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold shadow-lg mb-4 ring-4 ring-background">
            IS
          </div>
          <h1 className="text-2xl font-bold text-foreground">ItaSuper</h1>
          <p className="text-sm text-muted-foreground mt-1 px-4">
            Delivery rápido em Itatinga 🛵 Comida, mercado e mais — direto no app.
          </p>
        </header>

        {/* Links */}
        <nav className="flex flex-col gap-3">
          {isLoading && (
            <div className="text-center text-sm text-muted-foreground py-8">Carregando...</div>
          )}

          {!isLoading &&
            links?.filter((l) => isSafeUrl(l.url)).map((item) => {
              const Icon = ICON_MAP[item.icon] || LinkIcon;
              const baseClasses = `group flex items-center gap-3 w-full rounded-2xl px-4 py-3.5 border transition-all active:scale-[0.98] ${
                item.is_highlight
                  ? "bg-primary text-primary-foreground border-primary shadow-md hover:shadow-lg"
                  : "bg-card text-card-foreground border-border hover:border-primary/40 hover:bg-accent"
              }`;

              const content = (
                <>
                  <div
                    className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                      item.is_highlight
                        ? "bg-primary-foreground/20"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-semibold text-sm leading-tight truncate">
                      {item.label}
                    </div>
                    {item.description && (
                      <div
                        className={`text-xs mt-0.5 truncate ${
                          item.is_highlight
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        }`}
                      >
                        {item.description}
                      </div>
                    )}
                  </div>
                </>
              );

              return item.is_external ? (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={baseClasses}
                >
                  {content}
                </a>
              ) : (
                <Link key={item.id} to={item.url} className={baseClasses}>
                  {content}
                </Link>
              );
            })}
        </nav>

        {/* Footer */}
        <footer className="text-center mt-10 pb-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Itasuper — Todos os direitos reservados
          </p>
          <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
            <Link to="/termos-de-uso" className="hover:text-primary transition-colors">Termos</Link>
            <Link to="/politica-de-privacidade" className="hover:text-primary transition-colors">Política</Link>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LinksPage;
