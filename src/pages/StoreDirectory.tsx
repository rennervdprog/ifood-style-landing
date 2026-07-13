import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AsaasBadgeBar } from "@/components/AsaasBadge";
import PartnerClientView from "@/components/PartnerClientView";
import {
  Store, ShieldCheck, Smartphone,
  ArrowRight, CheckCircle2, MapPin, Clock, CreditCard,
  BarChart3, Menu, X, Rocket, Sparkles, ChevronDown,
  ShoppingBag, Truck, Crown, Bell, MessageCircle, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ───────────────────────── DATA ───────────────────────── */

const painSolutions = [
  { pain: "Pedido no papel, endereço errado", solution: "Pedido completo na tela, com mapa." },
  { pain: "Conferir PIX no extrato", solution: "PIX cai na hora, já confirmado." },
  { pain: "Cliente liga: 'já saiu?'", solution: "WhatsApp avisa cada etapa sozinho." },
  { pain: "Não sabe o lucro do dia", solution: "Relatório do dia em 1 tela." },
];

const steps = [
  { n: "1", title: "Crie sua conta", desc: "Nome da loja e telefone. Pronto." },
  { n: "2", title: "Monte o cardápio", desc: "Produtos com foto e preço." },
  { n: "3", title: "Compartilhe o link", desc: "Envie no WhatsApp e redes." },
  { n: "4", title: "Receba pedidos", desc: "Cada pedido pago, no celular." },
];

const features = [
  { icon: Smartphone, title: "Cardápio digital", desc: "Cardápio digital com link próprio da sua loja — cliente abre no navegador, sem instalar app." },
  { icon: CreditCard, title: "PIX automático", desc: "Cliente paga, dinheiro cai na hora." },
  { icon: Truck, title: "Motoboy integrado", desc: "Mapa em tempo real e código de confirmação." },
  { icon: BarChart3, title: "Relatório do dia", desc: "Vendas, lucro e mais pedidos numa tela." },
  { icon: Store, title: "PDV para loja física", desc: "Frente de caixa completa: vendas, troco, sangria e fechamento do dia. Contrate à parte ou use o plano Somente PDV." },
];

const segments = [
  { emoji: "🍕", title: "Pizzarias", desc: "Meio-a-meio, bordas e adicionais sem erro." },
  { emoji: "🛒", title: "Mercados", desc: "Catálogo grande organizado por categoria." },
  { emoji: "🍰", title: "Docerias", desc: "Cliente agenda dia e hora sozinho." },
  { emoji: "🍺", title: "Bares", desc: "Delivery e balcão no mesmo sistema." },
  { emoji: "🍔", title: "Lanches", desc: "Combos e adicionais com 1 toque." },
  { emoji: "💈", title: "Lojas físicas", desc: "Barbearia, pet shop, loja de roupa — use só o PDV, sem vitrine online." },
];

const plans = [
  {
    id: "fixed",
    name: "Essencial",
    tagline: "Grátis pra começar — vira R$180 quando faturar R$5.000",
    price: "0",
    commission: "0%",
    icon: Crown,
    highlight: true,
    badge: "🎁 Grátis pra começar" as string | undefined,
    features: [
      "R$ 0/mês pra começar",
      "Sobe pra R$ 180/mês após atingir R$ 5.000 em vendas",
      "Zero comissão por pedido",
      "Cardápio digital ilimitado + Motoboy integrado",
      "PDV: módulo opcional (+ R$ 49/mês)",
    ],
  },
  {
    id: "autonomy",
    name: "Autonomia",
    tagline: "Grátis pra começar. Sem acréscimo da plataforma na entrega.",
    price: "0",
    commission: "0%",
    icon: Crown,
    highlight: false,
    badge: "🎁 Grátis pra começar" as string | undefined,
    features: [
      "R$ 0/mês pra começar",
      "Sobe pra R$ 239,90/mês após atingir R$ 2.500 em vendas",
      "SEM taxa de R$ 0,99 da plataforma na entrega",
      "Cliente paga exatamente a taxa que você define",
      "PIX online: R$1,99/pedido (só se usar)",
      "PDV: módulo opcional (+ R$ 49/mês)",
    ],
  },
];

// Plano Somente PDV (loja física sem delivery)
plans.push({
  id: "pdv_only",
  name: "Somente PDV",
  tagline: "Só o caixa, sem delivery",
  price: "69",
  commission: "Sem",
  icon: CreditCard,
  highlight: false,
  badge: "Balcão" as string | undefined,
  features: [
    "PDV completo (vendas, sangria, fechamento)",
    "Cadastro de produtos ilimitado",
    "Relatórios do caixa",
    "WhatsApp integrado (grátis)",
    "Sem vitrine pública, sem delivery",
  ],
});

const testimonials = [
  { name: "Carlos M.", store: "Pizzaria do Carlinho", quote: "Em 2 semanas dobrei os pedidos. O PIX cair na hora mudou minha vida." },
  { name: "Juliana R.", store: "Doceria Júlia", quote: "Saí do WhatsApp e parei de perder pedido. Agora vendo até dormindo." },
  { name: "Renato S.", store: "Mercadinho Bom Preço", quote: "O cliente faz tudo sozinho. Eu só separo e entrego." },
];

const faqs = [
  { q: "Preciso instalar algum programa?", a: "Não. Você usa no celular ou computador. O cliente também não instala nada." },
  { q: "Como o cliente paga?", a: "PIX direto no celular. O dinheiro cai na sua conta na hora." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Sem multa, sem fidelidade, sem pegadinha." },
  { q: "E se eu tiver dificuldade?", a: "Nossa equipe responde no WhatsApp em minutos." },
  {
    q: 'O que é essa "taxa de R$ 0,99 da plataforma" na entrega?',
    a: "É o quanto a plataforma cobra por pedido pra manter o motoboy integrado, o rastreamento e o suporte. No plano Essencial ela aparece pro cliente como acréscimo de R$ 0,99 em cima da sua taxa de entrega. No plano Autonomia esse acréscimo é zero — o cliente paga exatamente a taxa que você define.",
  },
  {
    q: "Quando vale a pena o plano Autonomia?",
    a: 'Se você prefere mostrar um preço de entrega "redondo" sem qualquer acréscimo da plataforma, o Autonomia é ideal. Começa grátis (R$ 0/mês) e só sobe pra R$ 239,90/mês depois que sua loja faturar R$ 2.500 — com 30 dias de aviso e aceite expresso seu.',
  },
  {
    q: "O PDV está incluso em algum plano?",
    a: "Não. O PDV é um módulo opcional, contratado à parte por R$ 49/mês, e funciona com qualquer plano (Essencial ou Autonomia). Lojas antigas que já usavam o PDV mantêm a regra anterior de R$ 1 por venda presencial.",
  },
  {
    q: "Tenho só loja física, sem delivery. Dá pra usar só o PDV?",
    a: "Dá sim. Existe o plano Somente PDV por R$ 69/mês: você usa o caixa completo (vendas, sangria, fechamento do dia) sem vitrine pública, sem cardápio online e sem comissão por pedido. Depois, se quiser abrir delivery, migra pra Essencial ou Autonomia num clique.",
  },
  {
    q: "O ItaSuper é uma alternativa ao iFood?",
    a: "Sim. Você tem seu próprio cardápio digital, recebe pedidos direto no seu link, o PIX cai na sua conta na hora e a comissão é bem menor (0% no plano Essencial, contra ~27% das grandes plataformas). Você fica dono do cliente.",
  },
  {
    q: "Serve para pizzaria com meio-a-meio e bordas?",
    a: "Sim. O cardápio suporta sabor meio-a-meio, escolha de borda recheada, adicionais por sabor e observações do cliente sem erro. Ideal para pizzaria delivery.",
  },
];

/* ───────────────────────── HELPERS ───────────────────────── */

const ScrollProgress = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      setProgress(Math.min(100, (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-[60] pointer-events-none">
      <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
    </div>
  );
};

const StickyMobileCTA = ({ onClick }: { onClick: () => void }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const s = window.scrollY;
      const nearBottom = window.innerHeight + s >= document.documentElement.scrollHeight - 320;
      setShow(s > 600 && !nearBottom);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 bg-gradient-to-t from-background via-background/95 to-background/0 transition-all duration-300 ${
        show ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      <Button onClick={onClick} className="w-full min-h-[52px] rounded-2xl text-base font-black shadow-2xl shadow-primary/30">
        <Store className="mr-2 h-5 w-5" /> Criar minha loja grátis <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
    </div>
  );
};

const Navbar = ({ onNavigate, isLoggedIn }: { onNavigate: (p: string) => void; isLoggedIn?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
  const links = [
    { label: "Como funciona", href: "#como-funciona", icon: Rocket },
    { label: "Recursos", href: "#recursos", icon: Sparkles },
    { label: "Planos", href: "#planos", icon: Crown },
    { label: "Dúvidas", href: "#faq", icon: MessageCircle },
  ];
  const scrollTo = (id: string) => {
    setOpen(false);
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <nav className={`sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 ${scrolled ? "bg-background/90 border-b border-border shadow-sm" : "bg-background/60 border-b border-transparent"}`}>
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 md:px-6 h-14 md:h-16">
        <button onClick={() => scrollTo("#hero")} aria-label="Início" className="shrink-0">
          <img src="/itasuper-logo-horizontal.webp" alt="ItaSuper — sistema de delivery e PDV" width={170} height={40} className="h-7 md:h-9 w-auto object-contain" decoding="async" {...({ fetchpriority: "high" } as any)} />
        </button>
        <div className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <button key={l.href} onClick={() => scrollTo(l.href)} className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </button>
          ))}
          {isLoggedIn ? (
            <Button className="rounded-full font-bold text-sm px-6" onClick={() => onNavigate("/pedidos")}>
              <ShoppingBag className="h-4 w-4 mr-2" /> Meus Pedidos
            </Button>
          ) : (
            <>
              <button onClick={() => onNavigate("/portal-parceiro")} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                Já sou parceiro
              </button>
              <Button variant="outline" className="rounded-full font-bold text-sm px-5" onClick={() => onNavigate("/auth")}>Entrar</Button>
              <Button className="rounded-full font-bold text-sm px-5" onClick={() => onNavigate("/cadastro-lojista")}>Começar grátis</Button>
            </>
          )}
        </div>
        <div className="md:hidden flex items-center gap-2">
          {!isLoggedIn ? (
            <Button size="sm" className="rounded-full font-bold text-xs px-4 h-9 shadow-md shadow-primary/20" onClick={() => onNavigate("/cadastro-lojista")}>
              Começar
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="rounded-full font-bold text-xs px-3 h-9" onClick={() => onNavigate("/pedidos")}>
              <ShoppingBag className="h-3.5 w-3.5 mr-1.5" /> Pedidos
            </Button>
          )}
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? "Fechar" : "Menu"}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border bg-card/60 active:scale-95 transition-transform"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl px-3 py-3 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-2">
            {links.map((l) => (
              <button
                key={l.href}
                onClick={() => scrollTo(l.href)}
                className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:border-primary/40 active:scale-[0.98] transition"
              >
                <l.icon className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{l.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {!isLoggedIn && (
              <Button variant="outline" className="w-full h-11 rounded-xl font-bold" onClick={() => { setOpen(false); onNavigate("/auth"); }}>
                Entrar
              </Button>
            )}
            {!isLoggedIn && (
              <button onClick={() => { setOpen(false); onNavigate("/portal-parceiro"); }} className="text-center text-xs font-semibold text-muted-foreground py-1">
                Já sou parceiro
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

/* ───────────────────────── PAGE ───────────────────────── */

const StoreDirectory = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [partnerRole, setPartnerRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeSegment, setActiveSegment] = useState(0);
  const [liveStats, setLiveStats] = useState<{ stores: number; cities: number } | null>(null);

  const handleCTA = useCallback(() => navigate("/cadastro-lojista"), [navigate]);
  const handleWhatsApp = () =>
    window.open("https://wa.me/5522992796291?text=Olá! Tenho interesse em cadastrar minha loja na plataforma.", "_blank");

  useEffect(() => {
    document.title = "Sistema de Delivery e PDV para Restaurantes e Lojas | ItaSuper";
    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const desc = "Sistema completo de delivery com cardápio digital, PIX automático, motoboy integrado e PDV para loja física. Sem comissão no plano fixo. Grátis para começar.";
    setMeta("description", desc);
    setMeta("og:title", "ItaSuper — Delivery e PDV num app só", "property");
    setMeta("og:description", desc, "property");
    setMeta("og:url", "https://itasuper.com.br/", "property");
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = "https://itasuper.com.br/";

    // FAQPage JSON-LD
    const SCRIPT_ID = "faq-jsonld-storedirectory";
    let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.type = "application/ld+json";
      s.id = SCRIPT_ID;
      document.head.appendChild(s);
    }
    s.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });

    // SoftwareApplication JSON-LD
    const APP_ID = "app-jsonld-storedirectory";
    let a = document.getElementById(APP_ID) as HTMLScriptElement | null;
    if (!a) {
      a = document.createElement("script");
      a.type = "application/ld+json";
      a.id = APP_ID;
      document.head.appendChild(a);
    }
    a.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "ItaSuper",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Android",
      description: desc,
      url: "https://itasuper.com.br/",
      offers: [
        { "@type": "Offer", name: "Essencial", price: "0", priceCurrency: "BRL" },
        { "@type": "Offer", name: "Autonomia", price: "0.00", priceCurrency: "BRL" },
        { "@type": "Offer", name: "Somente PDV", price: "69", priceCurrency: "BRL" },
      ],
    });

    // Organization JSON-LD
    const ORG_ID = "org-jsonld-storedirectory";
    let o = document.getElementById(ORG_ID) as HTMLScriptElement | null;
    if (!o) {
      o = document.createElement("script");
      o.type = "application/ld+json";
      o.id = ORG_ID;
      document.head.appendChild(o);
    }
    o.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "ItaSuper",
      url: "https://itasuper.com.br/",
      logo: "https://itasuper.com.br/itasuper-logo-horizontal.webp",
    });
  }, []);

  useEffect(() => {
    import("@/lib/pageView").then((m) => m.trackPageView("store_directory"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("stores")
          .select("address_city")
          .eq("status", "ativo")
          .eq("is_test", false);
        if (cancelled || !data) return;
        const cities = new Set(data.map((s: any) => (s.address_city || "").trim().toLowerCase()).filter(Boolean));
        setLiveStats({ stores: data.length, cities: cities.size });
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setPartnerRole(null); setRoleChecked(true); return; }
    let cancelled = false;
    const check = async () => {
      try {
        const { data: adminRole } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (cancelled) return;
        if (adminRole) { setPartnerRole(null); setRoleChecked(true); return; }
        const { data: profile } = await supabase.from("profiles").select("role, is_approved").eq("user_id", user.id).maybeSingle();
        if (cancelled) return;
        if (profile?.role === "lojista") { navigate("/admin", { replace: true }); return; }
        if (profile?.role === "motoboy") {
          if (!profile?.is_approved) {
            const { data: sd } = await supabase.from("store_drivers").select("id").eq("driver_user_id", user.id).limit(1).maybeSingle();
            if (!sd) { navigate("/entregador", { replace: true }); return; }
          }
          setPartnerRole(profile.role);
          if (!cancelled) setRoleChecked(true);
          return;
        }
        if (!profile?.role || profile.role === "cliente") {
          navigate("/cliente", { replace: true });
          return;
        }
      } catch (e) { console.error("StoreDirectory role check error:", e); }
      if (!cancelled) setRoleChecked(true);
    };
    setRoleChecked(false);
    check();
    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  if (roleChecked && partnerRole) return <PartnerClientView />;

  const storesCount = liveStats?.stores ?? 35;
  const citiesCount = liveStats?.cities ?? 6;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <ScrollProgress />
      <Navbar onNavigate={navigate} isLoggedIn={!!user} />

      {/* ════ HERO ════ */}
      <section id="hero" className="relative px-6 pt-10 pb-20 md:pt-24 md:pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_55%)] pointer-events-none" />
        <div className="relative mx-auto max-w-6xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-semibold text-muted-foreground mb-8">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {storesCount}+ lojas ativas em {citiesCount} cidades
          </div>

          <h1 className="mx-auto max-w-3xl text-5xl md:text-7xl font-black tracking-tight text-foreground leading-[0.95] mb-6">
            Sistema de delivery e PDV<br />
            <span className="text-primary">pronto em 10 minutos.</span>
          </h1>

          <p className="mx-auto max-w-xl text-lg md:text-xl text-muted-foreground leading-relaxed mb-10">
            Cardápio digital, PIX automático, motoboy integrado e frente de caixa (PDV) num app só. Sem mensalidade pra começar.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={handleCTA} className="min-h-[56px] px-8 rounded-2xl text-base font-black shadow-xl shadow-primary/20 hover:-translate-y-0.5 transition-all w-full sm:w-auto">
              Criar minha loja grátis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleWhatsApp} className="min-h-[56px] px-8 rounded-2xl text-base font-bold w-full sm:w-auto">
              <MessageCircle className="mr-2 h-5 w-5" /> Falar no WhatsApp
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {[{ icon: CheckCircle2, t: "Sem cartão" }, { icon: Clock, t: "Pronto em 10 min" }, { icon: ShieldCheck, t: "Cancele quando quiser" }].map((x) => (
              <span key={x.t} className="inline-flex items-center gap-1.5 font-semibold">
                <x.icon className="h-3.5 w-3.5 text-primary" /> {x.t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════ STATS BAR ════ */}
      <section className="border-y border-border bg-muted/30 py-10 px-6">
        <div className="mx-auto max-w-6xl grid grid-cols-3 gap-6 text-center">
          {[
            { v: `${storesCount}+`, l: "Lojas ativas" },
            { v: `${citiesCount}`, l: "Cidades atendidas" },
            { v: "0%", l: "Comissão no plano fixo" },
          ].map((s) => (
            <div key={s.l}>
              <p className="text-3xl md:text-5xl font-black tracking-tight text-foreground">{s.v}</p>
              <p className="mt-1 text-[11px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════ DOR → SOLUÇÃO ════ */}
      <section className="py-24 md:py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl mb-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3">A diferença</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-foreground leading-tight">
              Chega de anotar pedido no papel <br /> e conferir PIX no banco.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {painSolutions.map((p) => (
              <div key={p.pain} className="rounded-2xl border border-border bg-card p-6 hover:border-primary/30 hover:-translate-y-1 transition-all">
                <p className="text-sm text-muted-foreground line-through mb-3">{p.pain}</p>
                <p className="text-base font-bold text-foreground leading-snug">{p.solution}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ COMO FUNCIONA ════ */}
      <section id="como-funciona" className="py-24 md:py-28 px-6 bg-muted/30 border-y border-border">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-xl mx-auto mb-16">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3">Como funciona</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
              Como montar seu delivery <br /> em 10 minutos.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={s.n} className="relative">
                {i < 3 && <div className="hidden lg:block absolute top-7 left-[55%] w-full h-px bg-border" />}
                <div className="relative w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-black mb-5 shadow-lg shadow-primary/20">{s.n}</div>
                <h3 className="text-lg font-black text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ FEATURES (bento) ════ */}
      <section id="recursos" className="py-24 md:py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl mb-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3">Recursos</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-foreground leading-tight">
              Tudo que restaurante, mercado <br /> e loja física precisam.
            </h2>
          </div>
          <div className="grid grid-cols-6 gap-4 auto-rows-[180px]">
            {features.map((f, i) => {
              const spans = [
                "col-span-6 md:col-span-4 md:row-span-2 bg-gradient-to-br from-primary/[0.08] to-card",
                "col-span-6 md:col-span-2",
                "col-span-6 md:col-span-2",
                "col-span-3 md:col-span-3",
                "col-span-3 md:col-span-3",
              ];
              const isHero = i === 0;
              return (
                <div key={f.title} className={`group rounded-3xl border border-border bg-card p-7 flex flex-col justify-between hover:border-primary/30 hover:-translate-y-1 transition-all ${spans[i]}`}>
                  <div className={`rounded-2xl bg-primary/10 flex items-center justify-center ${isHero ? "w-14 h-14" : "w-11 h-11"}`}>
                    <f.icon className={`text-primary ${isHero ? "h-7 w-7" : "h-5 w-5"}`} />
                  </div>
                  <div>
                    <h3 className={`font-black text-foreground tracking-tight mb-2 ${isHero ? "text-2xl md:text-3xl" : "text-lg"}`}>{f.title}</h3>
                    <p className={`text-muted-foreground leading-relaxed ${isHero ? "text-base" : "text-sm"}`}>{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════ SEGMENTOS (tabs) ════ */}
      <section className="py-24 md:py-28 px-6 bg-muted/30 border-y border-border">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-xl mx-auto mb-12">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3">Para o seu negócio</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">Feito para pizzarias, mercados, docerias, bares e lojas físicas.</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {segments.map((s, i) => (
              <button
                key={s.title}
                onClick={() => setActiveSegment(i)}
                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  i === activeSegment ? "bg-foreground text-background" : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="mr-1.5">{s.emoji}</span>{s.title}
              </button>
            ))}
          </div>
          <div className="max-w-2xl mx-auto rounded-3xl border border-border bg-card p-10 text-center">
            <div className="text-6xl mb-4">{segments[activeSegment].emoji}</div>
            <h3 className="text-2xl font-black text-foreground mb-2">{segments[activeSegment].title}</h3>
            <p className="text-muted-foreground text-lg">{segments[activeSegment].desc}</p>
          </div>
        </div>
      </section>

      {/* ════ MOTOBOY (dark contrast) ════ */}
      <section className="py-24 md:py-28 px-6 bg-foreground text-background">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3">Logística integrada</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight mb-6">
              Motoboy integrado com mapa <br /> e código de entrega.
            </h2>
            <p className="text-background/70 text-lg leading-relaxed mb-8">
              Da cozinha à porta do cliente, tudo conectado em tempo real. Sem ligação, sem erro de endereço.
            </p>
            <ul className="space-y-4">
              {[
                "Celular do motoboy apita quando o pedido sai",
                "Cliente acompanha o motoboy no mapa",
                "Código de confirmação na entrega",
                "Acerto financeiro automático no fim do dia",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                  <span className="text-base font-medium text-background/90">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="aspect-[4/5] rounded-[2.5rem] border border-background/10 bg-background/5 backdrop-blur p-5">
              <div className="w-full h-full bg-background text-foreground rounded-[2rem] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-border flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Truck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-black text-sm">App do Motoboy</p>
                    <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ONLINE
                    </p>
                  </div>
                </div>
                <div className="flex-1 p-5 space-y-4">
                  <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-1">Novo Pedido</p>
                    <p className="text-xl font-black mb-1">#1024 · R$ 45,90</p>
                    <p className="text-xs text-muted-foreground">R. das Flores, 123 · 1,2km</p>
                  </div>
                  <div className="h-32 rounded-2xl bg-muted relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full ring-4 ring-primary/20" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-center font-black text-sm">
                    ACEITAR ENTREGA
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ PLANOS ════ */}
      <section id="planos" className="py-24 md:py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-xl mx-auto mb-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3">Planos</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">Planos de delivery e PDV — cancele quando quiser.</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`relative rounded-3xl border p-7 flex flex-col ${
                  p.highlight ? "border-primary bg-card shadow-2xl shadow-primary/10 md:scale-105" : "border-border bg-card"
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider">
                    Mais escolhido
                  </div>
                )}
                {p.badge && (
                  <div className="absolute -top-3 right-4 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider">
                    {p.badge}
                  </div>
                )}
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <p.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-black text-foreground">{p.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">{p.tagline}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-sm font-bold text-muted-foreground">R$</span>
                  <span className={`${p.price.length > 2 ? "text-4xl" : "text-5xl"} font-black tracking-tight text-foreground`}>{p.price}</span>
                  <span className="text-sm font-semibold text-muted-foreground">/mês</span>
                </div>
                <p className="text-sm font-bold text-primary mb-6">{p.commission} comissão por pedido</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/80">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button onClick={handleCTA} variant={p.highlight ? "default" : "outline"} className="w-full min-h-[48px] rounded-xl font-black">
                  Começar agora
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            💡 No plano <strong className="text-foreground">Essencial</strong> a plataforma soma R$ 0,99 à sua taxa de entrega (o cliente paga, não sai do seu caixa). Apenas no <strong className="text-foreground">Autonomia</strong> esse acréscimo é zero — o cliente paga exatamente a taxa que você define.
          </p>
          <p className="mt-3 text-center text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            🏪 Já tem clientela na loja física? O plano <strong className="text-foreground">Somente PDV</strong> é a frente de caixa pura — se quiser abrir delivery depois, migra num clique.
          </p>
        </div>
      </section>

      {/* ════ POR QUE AUTONOMIA (comparação) ════ */}
      <section className="py-20 md:py-24 px-6 bg-muted/30 border-y border-border">
        <div className="mx-auto max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="inline-block text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full mb-4">
              Novidade • Plano Autonomia
            </p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-foreground text-balance">
              Quer entrega com preço <span className="text-emerald-600 dark:text-emerald-400">100% seu</span>? Agora você escolhe.
            </h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground">
              Vários lojistas pediram: "queria que o cliente pagasse exatamente a taxa que eu cobro, sem acréscimo da plataforma". Ouvimos. Nasceu o <strong className="text-foreground">Autonomia</strong> — o único plano sem a taxa de R$ 0,99 da plataforma na entrega.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 md:gap-5 max-w-3xl mx-auto">
            {/* Planos normais */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-4">Plano Essencial</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sua taxa de entrega</span>
                  <span className="font-bold text-foreground">R$ 5,00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">+ Taxa plataforma</span>
                  <span className="font-bold text-foreground">R$ 0,99</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="font-bold text-foreground">Cliente paga</span>
                  <span className="font-black text-foreground text-lg">R$ 5,99</span>
                </div>
              </div>
            </div>

            {/* Autonomia */}
            <div className="rounded-2xl border-2 border-emerald-500 bg-card p-6 relative">
              <div className="absolute -top-3 left-6 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider">
                Plano Autonomia
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-4">Sem acréscimo da plataforma</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sua taxa de entrega</span>
                  <span className="font-bold text-foreground">R$ 5,00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">+ Taxa plataforma</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">R$ 0,00 ✓</span>
                </div>
                <div className="border-t border-emerald-500/30 pt-2 flex justify-between">
                  <span className="font-bold text-foreground">Cliente paga</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg">R$ 5,00</span>
                </div>
              </div>
            </div>
          </div>

          <ul className="mt-10 grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-sm">
            <li className="flex items-start gap-2 text-foreground/80">
              <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>Você define a taxa, o cliente vê exatamente isso</span>
            </li>
            <li className="flex items-start gap-2 text-foreground/80">
              <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>Zero comissão por pedido</span>
            </li>
            <li className="flex items-start gap-2 text-foreground/80">
              <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>PIX online: R$1,99 só quando o cliente paga via PIX</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ════ DEPOIMENTOS ════ */}
      <section className="py-24 md:py-28 px-6 bg-muted/30 border-y border-border">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-xl mx-auto mb-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3">Quem usa, recomenda</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">O que os lojistas dizem sobre o ItaSuper.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-3xl border border-border bg-card p-7">
                <div className="flex gap-1 mb-4 text-primary">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
                <p className="text-foreground text-base leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.store}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ FAQ ════ */}
      <section id="faq" className="py-24 md:py-28 px-6">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3">Dúvidas</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">Perguntas frequentes sobre o sistema.</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={f.q} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="text-base font-bold text-foreground">{f.q}</span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform shrink-0 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-muted-foreground leading-relaxed">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ FINAL CTA ════ */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-foreground text-background px-6 py-14 md:p-20 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.15),transparent_70%)] pointer-events-none" />
          <div className="relative flex flex-col items-center">
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight leading-[1.1] mb-4 text-balance max-w-3xl mx-auto">
              Cadastre sua loja e comece a vender hoje.
            </h2>
            <p className="text-background/70 text-base md:text-lg max-w-xl mx-auto mb-10 text-balance">
              Crie sua loja grátis em 10 minutos. Sem cartão, sem fidelidade.
            </p>
            <Button size="lg" onClick={handleCTA} className="w-full sm:w-auto min-h-[56px] px-10 rounded-2xl text-base font-black shadow-2xl shadow-primary/30">
              Criar minha loja grátis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="mt-4 text-xs text-background/50 font-semibold">
              Já tem conta?{" "}
              <button onClick={() => navigate("/auth")} className="underline hover:text-background">
                Entrar
              </button>
            </p>
          </div>
        </div>
      </section>

      {/* ════ FOOTER ════ */}
      <footer className="border-t border-border bg-muted/30 px-6 py-12">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/itasuper-logo-horizontal.webp" alt="ItaSuper" width={140} height={32} className="h-8 w-auto" decoding="async" />
            <span className="text-xs text-muted-foreground hidden md:inline">© {new Date().getFullYear()} ItaSuper</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <button onClick={() => navigate("/termos-de-uso")} className="hover:text-foreground font-semibold">Termos</button>
            <button onClick={() => navigate("/politica-de-privacidade")} className="hover:text-foreground font-semibold">Privacidade</button>
            <button onClick={() => navigate("/portal-parceiro")} className="hover:text-foreground font-semibold">Já sou parceiro</button>
            <button onClick={handleWhatsApp} className="hover:text-foreground font-semibold">Contato</button>
          </div>
          <AsaasBadgeBar />
        </div>
      </footer>

      <StickyMobileCTA onClick={handleCTA} />
    </div>
  );
};

export default StoreDirectory;