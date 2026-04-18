import { useEffect } from "react";
import { Link } from "react-router-dom";
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
} from "lucide-react";

interface LinkItem {
  label: string;
  description?: string;
  icon: React.ElementType;
  href: string;
  external?: boolean;
  highlight?: boolean;
}

const links: LinkItem[] = [
  {
    label: "Fazer um Pedido",
    description: "Veja todas as lojas disponíveis",
    icon: ShoppingBag,
    href: "/",
    highlight: true,
  },
  {
    label: "Cadastrar minha Loja",
    description: "Cadastro 100% grátis • Sem mensalidade",
    icon: Store,
    href: "/cadastro-lojista",
    highlight: true,
  },
  {
    label: "Quero ser Entregador",
    description: "Faça entregas e ganhe por corrida",
    icon: Bike,
    href: "/cadastro-entregador",
  },
  {
    label: "Plano Apoiador (Vitalício)",
    description: "Apoie o app por R$ 130 — apenas 10 vagas",
    icon: Heart,
    href: "/planos",
  },
  {
    label: "Criar minha Conta",
    description: "Acesse promoções e cupons exclusivos",
    icon: UserPlus,
    href: "/auth",
  },
  {
    label: "Baixar o App",
    description: "Disponível para Android",
    icon: Smartphone,
    href: "https://play.google.com/store/apps/details?id=app.lovable.e8d28aded6334d74be2161c8dbe24765",
    external: true,
  },
  {
    label: "Instagram @itasuper",
    icon: Instagram,
    href: "https://instagram.com/itasuper",
    external: true,
  },
  {
    label: "Falar no WhatsApp",
    description: "Suporte e dúvidas",
    icon: MessageCircle,
    href: "https://wa.me/5514998765432",
    external: true,
  },
  {
    label: "Termos de Uso",
    icon: FileText,
    href: "/termos-de-uso",
  },
  {
    label: "Política de Privacidade",
    icon: Shield,
    href: "/politica-de-privacidade",
  },
];

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
          {links.map((item) => {
            const Icon = item.icon;
            const baseClasses = `group flex items-center gap-3 w-full rounded-2xl px-4 py-3.5 border transition-all active:scale-[0.98] ${
              item.highlight
                ? "bg-primary text-primary-foreground border-primary shadow-md hover:shadow-lg"
                : "bg-card text-card-foreground border-border hover:border-primary/40 hover:bg-accent"
            }`;

            const content = (
              <>
                <div
                  className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    item.highlight
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
                        item.highlight
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

            return item.external ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={baseClasses}
              >
                {content}
              </a>
            ) : (
              <Link key={item.label} to={item.href} className={baseClasses}>
                {content}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <footer className="text-center mt-10 pb-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ItaSuper · Itatinga/SP
          </p>
        </footer>
      </div>
    </div>
  );
};

export default LinksPage;
