import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AsaasBadgeBar } from "@/components/AsaasBadge";
import PartnerClientView from "@/components/PartnerClientView";
import PlansComparisonTable from "@/components/PlansComparisonTable";
import { PLANS, PLANS_ORDER } from "@/lib/plansInfo";
import {
  ArrowRight, Check, CheckCircle2, ChevronDown, Clock, CreditCard,
  Menu, MessageCircle, ShieldCheck, ShoppingBag, Sparkles,
  Store, Truck, X, Zap, Smartphone, BarChart3, Printer, Gift, MapPin,
  AlertTriangle, PhoneCall, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─────────────────────────── CONTENT ─────────────────────────── */

const PAINS = [
  { pain: "Pedido no papel, endereço errado, entrega perdida.",     solution: "Pedido completo na tela, com mapa e código de confirmação." },
  { pain: "Conferir PIX no extrato pedido por pedido.",               solution: "PIX cai confirmado — o pedido libera sozinho." },
  { pain: "Cliente ligando \"já saiu meu pedido?\" toda hora.",      solution: "WhatsApp avisa cada etapa automaticamente." },
  { pain: "Fim do dia sem saber quanto sobrou de verdade.",           solution: "Relatório do dia numa tela — vendas, taxas e líquido." },
];

const FEATURES = [
  { icon: Smartphone, title: "Cardápio digital próprio",  desc: "Link exclusivo da sua loja. Cliente abre no navegador, sem baixar app." },
  { icon: CreditCard, title: "PIX automático + Pix Direto", desc: "Asaas confirma na hora, ou receba direto na sua chave e confirme com 1 toque." },
  { icon: MessageCircle, title: "WhatsApp Bot guiado",     desc: "Cliente faz o pedido conversando no seu WhatsApp — bot valida endereço, horário e taxa." },
  { icon: Truck, title: "Motoboy integrado",               desc: "Mapa em tempo real, cálculo de taxa por distância e código de entrega." },
  { icon: BarChart3, title: "Relatórios que fecham a conta", desc: "Vendas, comissão, PIX, mensalidade — tudo já descontado no líquido." },
  { icon: Store, title: "PDV pro balcão",                  desc: "Sessão, sangria, fechamento do dia e impressão térmica. Grátis pra loja física." },
  { icon: Gift, title: "Cupons, fidelidade e banners",     desc: "Suas próprias promoções sem depender de marketplace." },
  { icon: Printer, title: "Impressão térmica",             desc: "Roda em qualquer impressora Bluetooth / USB de cozinha." },
];

const STEPS = [
  { n: "01", title: "Cria a conta",       desc: "Nome da loja, telefone e endereço. 2 minutos." },
  { n: "02", title: "Monta o cardápio",   desc: "Produtos com foto, preço e adicionais." },
  { n: "03", title: "Compartilha o link", desc: "Cola no WhatsApp, Instagram, bio do TikTok." },
  { n: "04", title: "Recebe pedidos",     desc: "Cada pedido pago, no seu celular, com o PIX na conta." },
];

const SEGMENTS = [
  { emoji: "🍕", title: "Pizzarias",   desc: "Meio-a-meio, bordas recheadas, adicionais por sabor." },
  { emoji: "🍔", title: "Lanches",     desc: "Combos, adicionais e observações do cliente sem erro." },
  { emoji: "🛒", title: "Mercados",    desc: "Catálogo grande organizado por categoria." },
  { emoji: "🍰", title: "Docerias",    desc: "Cliente agenda dia e hora sozinho pela vitrine." },
  { emoji: "🍺", title: "Bares",       desc: "Delivery + balcão no mesmo sistema." },
  { emoji: "💈", title: "Loja física", desc: "Barbearia, pet, roupa — só o PDV, sem vitrine online." },
];

const TESTIMONIALS = [
  { name: "Carlos M.",  store: "Pizzaria do Carlinho",   quote: "Em 2 semanas dobrei os pedidos. O PIX cair na hora mudou minha vida." },
  { name: "Juliana R.", store: "Doceria Júlia",          quote: "Saí do WhatsApp na mão e parei de perder pedido. Vendo até dormindo." },
  { name: "Renato S.",  store: "Mercadinho Bom Preço",   quote: "O cliente faz tudo sozinho. Eu só separo e entrego." },
];

const FAQS = [
  { q: "Grátis mesmo? Onde está a pegadinha?",
    a: "Sem pegadinha. Você começa com R$ 0/mês. Ao faturar R$ 5.000 no Essencial (ou R$ 2.500 no Autonomia) em 60 dias, a mensalidade passa a valer, com 30 dias de aviso e aceite expresso. Se você não aceitar, a loja fica suspensa até aceitar — está explícito na cláusula 5.2 dos Termos." },
  { q: "E as taxas que aparecem: R$ 0,99 e R$ 1,99?",
    a: "R$ 0,99 é o acréscimo da plataforma somado à sua taxa de entrega, pago pelo cliente (não sai do seu caixa). Só existe no plano Essencial — no Autonomia é zero. R$ 1,99 é a taxa de PIX online por pedido pago no PIX; pedidos em dinheiro ou cartão não pagam." },
  { q: "O PDV está incluso?",
    a: "No plano Essencial e Autonomia o PDV é um módulo opcional (R$ 49/mês). Se você só quer o caixa presencial, tem o plano Somente PDV por R$ 69/mês, sem delivery." },
  { q: "Preciso instalar algo?",
    a: "Não. Roda no celular ou computador pelo navegador. Tem app Android opcional pra receber notificação de pedido. Cliente não instala nada." },
  { q: "Posso cancelar quando quiser?",
    a: "Sim, sem multa e sem fidelidade. Você desativa a loja no painel e pronto." },
  { q: "É alternativa ao iFood?",
    a: "Sim. Cardápio próprio, PIX direto na sua conta, comissão 0% no Essencial e Autonomia (contra ~27% dos grandes marketplaces). Você fica dono do cliente." },
];

/* ─────────────────────────── HELPERS ─────────────────────────── */

const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",").replace(/,00$/, "")}`;

const ScrollProgress = () => {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      setP(Math.min(100, (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className="fixed top-0 inset-x-0 h-[2px] z-[70] pointer-events-none">
      <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${p}%` }} />
    </div>
  );
};

const Navbar = ({ onNavigate, isLoggedIn }: { onNavigate: (p: string) => void; isLoggedIn?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  const links = [
    { label: "Recursos", href: "#recursos" },
    { label: "Planos", href: "#planos" },
    { label: "Como funciona", href: "#como-funciona" },
    { label: "Dúvidas", href: "#faq" },
  ];
  const scrollTo = (id: string) => { setOpen(false); document.querySelector(id)?.scrollIntoView({ behavior: "smooth" }); };
  return (
    <nav className={`sticky top-0 z-[60] transition-all duration-300 ${scrolled ? "bg-background/85 backdrop-blur-xl border-b border-border shadow-[0_2px_20px_-8px_hsl(var(--foreground)/0.15)]" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 md:px-6 h-14 md:h-16">
        <button onClick={() => scrollTo("#hero")} aria-label="Início" className="shrink-0">
          <img src="/itasuper-logo-horizontal.webp" alt="ItaSuper" width={170} height={40} className="h-7 md:h-9 w-auto object-contain" decoding="async" {...({ fetchpriority: "high" } as any)} />
        </button>
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <button key={l.href} onClick={() => scrollTo(l.href)} className="text-sm font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-full hover:bg-muted/60 transition">
              {l.label}
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-2">
          {isLoggedIn ? (
            <Button className="rounded-full font-bold text-sm px-6" onClick={() => onNavigate("/pedidos")}>
              <ShoppingBag className="h-4 w-4 mr-2" /> Meus pedidos
            </Button>
          ) : (
            <>
              <Button variant="ghost" className="rounded-full font-semibold text-sm" onClick={() => onNavigate("/auth")}>Entrar</Button>
              <Button className="rounded-full font-bold text-sm px-5 shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.5)]" onClick={() => onNavigate("/cadastro-lojista")}>
                Criar loja grátis
              </Button>
            </>
          )}
        </div>
        <div className="md:hidden flex items-center gap-2">
          {!isLoggedIn ? (
            <Button size="sm" className="rounded-full font-bold text-xs px-4 h-9" onClick={() => onNavigate("/cadastro-lojista")}>Começar</Button>
          ) : (
            <Button size="sm" variant="outline" className="rounded-full font-bold text-xs px-3 h-9" onClick={() => onNavigate("/pedidos")}>
              <ShoppingBag className="h-3.5 w-3.5 mr-1.5" /> Pedidos
            </Button>
          )}
          <button onClick={() => setOpen(!open)} aria-label={open ? "Fechar" : "Menu"} className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border bg-card/70 active:scale-95 transition">
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl px-3 py-3">
          <div className="grid grid-cols-2 gap-2">
            {links.map((l) => (
              <button key={l.href} onClick={() => scrollTo(l.href)} className="rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left text-sm font-semibold hover:border-primary/40 active:scale-[0.98] transition">
                {l.label}
              </button>
            ))}
          </div>
          {!isLoggedIn && (
            <Button variant="outline" className="w-full mt-3 h-11 rounded-xl font-bold" onClick={() => { setOpen(false); onNavigate("/auth"); }}>Entrar</Button>
          )}
        </div>
      )}
    </nav>
  );
};

/* Fake mock phone com pedido — dá cara Figma ao hero */
const HeroMock = () => (
  <div className="relative mx-auto w-[280px] md:w-[320px] aspect-[9/19] rounded-[2.6rem] border-[10px] border-foreground/90 bg-background shadow-[0_40px_80px_-30px_hsl(var(--primary)/0.35),0_20px_40px_-15px_hsl(var(--foreground)/0.25)] overflow-hidden">
    <div className="absolute top-0 inset-x-0 h-6 bg-foreground/90 flex justify-center items-end">
      <div className="h-3.5 w-24 bg-background rounded-b-2xl" />
    </div>
    <div className="pt-8 px-3 pb-3 h-full flex flex-col gap-2 bg-gradient-to-b from-background to-muted/40">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-primary/15 grid place-items-center text-primary text-sm">🍕</div>
        <div className="flex-1">
          <p className="text-[10px] font-black text-foreground leading-none">Pizzaria do Carlinho</p>
          <p className="text-[8px] text-muted-foreground mt-0.5">Pedido #1247 · há 2 min</p>
        </div>
        <span className="text-[8px] font-black bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5 rounded-full">PAGO PIX</span>
      </div>
      <div className="rounded-xl border border-border bg-card/70 p-2 space-y-1">
        <div className="flex justify-between text-[9px] font-semibold"><span>1× Pizza Calabresa G</span><span>R$ 52,00</span></div>
        <div className="flex justify-between text-[9px] font-semibold"><span>1× Coca-Cola 2L</span><span>R$ 12,00</span></div>
        <div className="flex justify-between text-[9px] font-semibold text-muted-foreground"><span>Taxa entrega</span><span>R$ 5,00</span></div>
        <div className="h-px bg-border my-1" />
        <div className="flex justify-between text-[10px] font-black text-primary"><span>Total</span><span>R$ 69,00</span></div>
      </div>
      <div className="rounded-xl border border-border bg-card/70 p-2">
        <p className="text-[8px] font-black uppercase tracking-wider text-muted-foreground mb-1">Entrega</p>
        <p className="text-[9px] font-semibold leading-tight">R. das Flores, 234 — Centro</p>
        <div className="mt-1.5 flex items-center gap-1 text-[8px] font-bold text-primary">
          <MapPin className="h-2.5 w-2.5" /> 2,4 km · ~18 min
        </div>
      </div>
      <div className="mt-auto flex gap-1.5">
        <button className="flex-1 h-8 rounded-lg bg-primary text-[9px] font-black text-primary-foreground shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.5)]">Aceitar pedido</button>
        <button className="h-8 w-8 rounded-lg border border-border bg-card grid place-items-center">
          <Printer className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
);

/* ─────────────────────────── PAGE ─────────────────────────── */

const StoreDirectory = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [partnerRole, setPartnerRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showCompare, setShowCompare] = useState(false);
  const [liveStats, setLiveStats] = useState<{ stores: number; cities: number } | null>(null);

  const handleCTA = useCallback(() => navigate("/cadastro-lojista"), [navigate]);
  const handleWhatsApp = () =>
    window.open("https://wa.me/5522992796291?text=Olá! Tenho interesse em cadastrar minha loja no ItaSuper.", "_blank");

  /* SEO */
  useEffect(() => {
    document.title = "ItaSuper — Cardápio digital, PIX na hora e PDV, grátis pra começar";
    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const desc = "Sistema de delivery e PDV com cardápio digital próprio, PIX automático, WhatsApp bot e motoboy integrado. Grátis até R$ 5.000 em vendas. Sem comissão por pedido.";
    setMeta("description", desc);
    setMeta("og:title", "ItaSuper — Delivery, PIX e PDV num app só", "property");
    setMeta("og:description", desc, "property");
    setMeta("og:type", "website", "property");
    setMeta("twitter:card", "summary_large_image");
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = "https://itasuper.com.br/";
    const setLd = (id: string, obj: unknown) => {
      let s = document.getElementById(id) as HTMLScriptElement | null;
      if (!s) { s = document.createElement("script"); s.type = "application/ld+json"; s.id = id; document.head.appendChild(s); }
      s.textContent = JSON.stringify(obj);
    };
    setLd("faq-jsonld-storedirectory", {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
    setLd("app-jsonld-storedirectory", {
      "@context": "https://schema.org", "@type": "SoftwareApplication",
      name: "ItaSuper", applicationCategory: "BusinessApplication", operatingSystem: "Web, Android",
      description: desc, url: "https://itasuper.com.br/",
      offers: PLANS_ORDER.concat(["pdv_only"] as any).map((id) => ({
        "@type": "Offer", name: PLANS[id].name, price: String(PLANS[id].monthlyFee), priceCurrency: "BRL",
      })),
    });
  }, []);

  useEffect(() => { import("@/lib/pageView").then((m) => m.trackPageView("store_directory")); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from("stores").select("address_city").eq("status", "ativo").eq("is_test", false);
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
    (async () => {
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
        if (!profile?.role || profile.role === "cliente") { navigate("/cliente", { replace: true }); return; }
      } catch (e) { console.error("StoreDirectory role check error:", e); }
      if (!cancelled) setRoleChecked(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  if (roleChecked && partnerRole) return <PartnerClientView />;

  const storesCount = liveStats?.stores ?? 35;
  const citiesCount = liveStats?.cities ?? 6;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden antialiased">
      <ScrollProgress />
      <Navbar onNavigate={navigate} isLoggedIn={!!user} />

      {/* ═════════════════ HERO ═════════════════ */}
      <section id="hero" className="relative px-5 md:px-6 pt-6 md:pt-16 pb-16 md:pb-24">
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-[520px] w-[520px] rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute top-40 -left-32 h-[420px] w-[420px] rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute inset-0 [background-image:linear-gradient(hsl(var(--foreground)/0.04)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.04)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />
        </div>

        <div className="mx-auto max-w-6xl grid md:grid-cols-[1.15fr,0.85fr] gap-10 md:gap-14 items-center">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1.5 text-[11px] font-bold text-muted-foreground mb-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {storesCount}+ lojas ativas em {citiesCount} cidades
            </div>

            <h1 className="text-[2.6rem] leading-[0.95] md:text-6xl lg:text-7xl font-black tracking-tight text-foreground mb-5">
              Seu delivery{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-primary">no seu link.</span>
                <span aria-hidden className="absolute inset-x-0 bottom-1 h-3 md:h-4 bg-primary/20 -skew-x-6 -z-0" />
              </span>
              <br className="hidden md:block" />
              Sem comissão. Sem app pro cliente.
            </h1>

            <p className="max-w-xl mx-auto md:mx-0 text-base md:text-lg text-muted-foreground leading-relaxed mb-8">
              Cardápio digital próprio, <b className="text-foreground">PIX cai na hora</b>, WhatsApp bot que anota o pedido sozinho e motoboy com rastreio. <b className="text-foreground">Grátis até R$ 5.000</b> em vendas.
            </p>

            <div className="flex flex-col sm:flex-row items-center md:items-start justify-center md:justify-start gap-3">
              <Button size="lg" onClick={handleCTA} className="min-h-[54px] px-7 rounded-2xl text-base font-black shadow-[0_20px_50px_-20px_hsl(var(--primary)/0.7)] hover:-translate-y-0.5 transition-all w-full sm:w-auto">
                Criar minha loja grátis <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={handleWhatsApp} className="min-h-[54px] px-6 rounded-2xl text-base font-bold w-full sm:w-auto border-2">
                <MessageCircle className="mr-2 h-5 w-5" /> Falar no WhatsApp
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center md:justify-start gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
              {[
                { icon: CheckCircle2, t: "Sem cartão pra começar" },
                { icon: Clock, t: "Pronto em 10 min" },
                { icon: ShieldCheck, t: "Sem multa, cancele quando quiser" },
              ].map((x) => (
                <span key={x.t} className="inline-flex items-center gap-1.5 font-bold">
                  <x.icon className="h-3.5 w-3.5 text-primary" /> {x.t}
                </span>
              ))}
            </div>
          </div>

          <div className="relative order-first md:order-last">
            <HeroMock />
            <div className="hidden md:block absolute -left-6 top-10 rounded-2xl border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-[0_20px_40px_-20px_hsl(var(--foreground)/0.25)]">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/15 grid place-items-center"><Zap className="h-4 w-4 text-emerald-600" /></div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">PIX confirmado</p>
                  <p className="text-xs font-black text-foreground">+ R$ 69,00</p>
                </div>
              </div>
            </div>
            <div className="hidden md:block absolute -right-4 bottom-16 rounded-2xl border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-[0_20px_40px_-20px_hsl(var(--foreground)/0.25)]">
              <p className="text-[10px] font-black uppercase text-muted-foreground">Hoje</p>
              <p className="text-sm font-black text-foreground">37 pedidos · R$ 2.184</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════ STATS ═════════════════ */}
      <section className="border-y border-border bg-muted/30 py-8 md:py-10 px-6">
        <div className="mx-auto max-w-6xl grid grid-cols-3 gap-6 text-center">
          {[
            { v: `${storesCount}+`, l: "Lojas ativas" },
            { v: `${citiesCount}`, l: "Cidades" },
            { v: "0%", l: "Comissão por pedido" },
          ].map((s) => (
            <div key={s.l}>
              <p className="text-3xl md:text-5xl font-black tracking-tight text-foreground">{s.v}</p>
              <p className="mt-1 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═════════════════ SEGMENTOS ═════════════════ */}
      <section className="py-20 md:py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl mb-10 md:mb-14">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mb-3">Pra quem é</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">
              Feito pra quem vende <span className="text-primary">todo dia</span>.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {SEGMENTS.map((s) => (
              <div key={s.title} className="group rounded-2xl border border-border bg-card p-4 md:p-5 hover:border-primary/40 hover:-translate-y-0.5 transition-all">
                <div className="text-3xl md:text-4xl mb-2">{s.emoji}</div>
                <p className="font-black text-sm md:text-base">{s.title}</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1 leading-snug">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════ DOR → SOLUÇÃO ═════════════════ */}
      <section className="py-20 md:py-24 px-6 bg-muted/20 border-y border-border">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl mb-10 md:mb-14">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mb-3">A diferença</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">
              Chega de anotar pedido no papel<br />e conferir PIX no banco.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-3 md:gap-4">
            {PAINS.map((p) => (
              <div key={p.pain} className="rounded-2xl border border-border bg-card p-5 md:p-6 grid grid-cols-[auto,1fr] gap-3 md:gap-4">
                <div className="flex flex-col gap-2 pt-1">
                  <span className="h-7 w-7 rounded-full bg-destructive/10 text-destructive grid place-items-center"><X className="h-4 w-4" /></span>
                  <span className="h-7 w-7 rounded-full bg-primary/15 text-primary grid place-items-center"><Check className="h-4 w-4" /></span>
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-sm md:text-base text-muted-foreground line-through">{p.pain}</p>
                  <p className="text-sm md:text-base font-bold text-foreground">{p.solution}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════ RECURSOS (BENTO) ═════════════════ */}
      <section id="recursos" className="py-20 md:py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl mb-10 md:mb-14">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mb-3">Recursos</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">
              Tudo pra rodar. <span className="text-primary">Nada de firula.</span>
            </h2>
            <p className="mt-4 text-muted-foreground md:text-lg">Só o que você usa de verdade no dia a dia — sem prometer o que a gente não entrega.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`group rounded-3xl border border-border bg-card p-5 md:p-6 hover:border-primary/40 transition-all ${i === 0 ? "md:col-span-2 md:row-span-1 bg-gradient-to-br from-primary/10 via-card to-card" : ""}`}>
                <div className={`h-11 w-11 rounded-2xl grid place-items-center mb-4 ${i === 0 ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <p className="text-base md:text-lg font-black">{f.title}</p>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════ COMO FUNCIONA ═════════════════ */}
      <section id="como-funciona" className="py-20 md:py-24 px-6 bg-muted/20 border-y border-border">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl mb-10 md:mb-14">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mb-3">Como funciona</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">Do zero ao primeiro pedido em <span className="text-primary">10 minutos.</span></h2>
          </div>
          <div className="grid md:grid-cols-4 gap-3 md:gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-3xl font-black text-primary/70 tabular-nums">{s.n}</p>
                <p className="mt-3 font-black text-base">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground leading-snug">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════ PLANOS ═════════════════ */}
      <PlansSection onCTA={handleCTA} onCompare={() => setShowCompare((v) => !v)} showCompare={showCompare} />

      {/* ═════════════════ TRANSPARÊNCIA UPGRADE ═════════════════ */}
      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-4xl rounded-3xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.06] via-card to-card p-6 md:p-10 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.25)]">
          <div className="flex items-start gap-3 md:gap-4">
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-primary/15 text-primary grid place-items-center shrink-0">
              <AlertTriangle className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mb-2">Transparência total</p>
              <h3 className="text-xl md:text-2xl font-black leading-tight mb-3">E quando eu passar dos R$ 5.000?</h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                Quando sua loja atingir o gatilho de vendas (R$ 5.000 no Essencial ou R$ 2.500 no Autonomia em 60 dias), a mensalidade passa a valer com <b className="text-foreground">30 dias de aviso</b> e aceite expresso seu. Se você preferir não continuar, a loja fica <b className="text-foreground">suspensa até você aceitar</b> — não voltamos ao grátis pra sempre. Está escrito na cláusula 5.2 dos Termos, sem letra miúda.
              </p>
              <button onClick={() => navigate("/termos-de-uso")} className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-primary hover:underline">
                <FileText className="h-4 w-4" /> Ler a cláusula
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════ DEPOIMENTOS ═════════════════ */}
      <section className="px-6 py-20 md:py-24 bg-muted/20 border-y border-border">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl mb-10">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mb-3">Quem já usa</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">Lojistas que <span className="text-primary">saíram do WhatsApp na mão.</span></h2>
          </div>
          <div className="grid md:grid-cols-3 gap-3 md:gap-4">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="rounded-2xl border border-border bg-card p-5 md:p-6">
                <blockquote className="text-base md:text-lg font-semibold leading-snug text-foreground">"{t.quote}"</blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-black">{t.name}</span>
                  <span className="text-muted-foreground"> · {t.store}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════ FAQ ═════════════════ */}
      <section id="faq" className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mb-3">Dúvidas</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">Perguntas frequentes</h2>
          </div>
          <div className="rounded-3xl border border-border bg-card divide-y divide-border overflow-hidden">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q}>
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 md:px-6 py-4 md:py-5 hover:bg-muted/40 transition"
                    aria-expanded={open}
                  >
                    <span className="font-black text-sm md:text-base leading-snug">{f.q}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180 text-primary" : ""}`} />
                  </button>
                  {open && (
                    <div className="px-5 md:px-6 pb-5 md:pb-6 text-sm md:text-base text-muted-foreground leading-relaxed">{f.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═════════════════ CTA FINAL ═════════════════ */}
      <section className="px-6 py-20 md:py-28">
        <div className="mx-auto max-w-5xl relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] border border-primary/20 bg-gradient-to-br from-primary via-primary to-primary/80 p-8 md:p-16 text-primary-foreground shadow-[0_40px_80px_-30px_hsl(var(--primary)/0.6)]">
          <div aria-hidden className="absolute inset-0 [background-image:linear-gradient(hsl(0_0%_100%/0.08)_1px,transparent_1px),linear-gradient(90deg,hsl(0_0%_100%/0.08)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
          <div className="relative text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-90 mb-3">Bora vender mais</p>
            <h2 className="text-3xl md:text-6xl font-black tracking-tight leading-[1.05] mb-4">
              Crie sua loja grátis<br />e receba pedido ainda hoje.
            </h2>
            <p className="opacity-90 text-base md:text-lg max-w-xl mx-auto mb-8">
              Sem cartão. Sem mensalidade até R$ 5.000 em vendas. Cancelamento a qualquer momento.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" variant="secondary" onClick={handleCTA} className="min-h-[56px] px-8 rounded-2xl text-base font-black bg-background text-foreground hover:bg-background/90 w-full sm:w-auto">
                Criar minha loja grátis <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={handleWhatsApp} className="min-h-[56px] px-6 rounded-2xl text-base font-bold border-2 border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 w-full sm:w-auto">
                <PhoneCall className="mr-2 h-5 w-5" /> Falar com humano
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════ FOOTER ═════════════════ */}
      <footer className="border-t border-border bg-muted/30 px-6 py-10 md:py-12">
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

      {/* Sticky mobile CTA */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 bg-gradient-to-t from-background via-background/95 to-background/0">
        <Button onClick={handleCTA} className="w-full min-h-[52px] rounded-2xl text-base font-black shadow-[0_16px_40px_-12px_hsl(var(--primary)/0.6)]">
          <Store className="mr-2 h-5 w-5" /> Criar minha loja grátis <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

/* ─────────────────── PLANS SECTION ─────────────────── */

function PlansSection({
  onCTA, onCompare, showCompare,
}: {
  onCTA: () => void; onCompare: () => void; showCompare: boolean;
}) {
  // Ordem visual: Autonomia, Essencial (destaque no meio), Somente PDV
  const order = useMemo(() => ["autonomy", "fixed", "pdv_only"] as const, []);

  return (
    <section id="planos" className="px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mb-3">Planos</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">
            Comece grátis. <span className="text-primary">Pague quando faturar.</span>
          </h2>
          <p className="mt-4 text-muted-foreground md:text-lg">
            Só 3 planos. Escolhe o seu, começa hoje e migra a qualquer hora.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5 items-stretch">
          {order.map((id) => {
            const p = PLANS[id];
            const highlight = id === "fixed";
            const isPdv = id === "pdv_only";
            const gmvTrigger =
              id === "fixed"    ? "R$ 5.000 em vendas" :
              id === "autonomy" ? "R$ 2.500 em vendas" : null;
            const paidPrice =
              id === "fixed"    ? "R$ 180/mês"    :
              id === "autonomy" ? "R$ 239,90/mês" : null;

            return (
              <div
                key={id}
                className={`relative rounded-3xl border p-6 md:p-7 flex flex-col ${
                  highlight
                    ? "border-primary bg-gradient-to-b from-primary/[0.08] via-card to-card shadow-[0_30px_60px_-25px_hsl(var(--primary)/0.5)] md:-my-4 md:py-11"
                    : "border-border bg-card"
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest px-3 py-1 shadow-md">
                      <Sparkles className="h-3 w-3" /> Mais escolhido
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-1">
                  <span className={`h-9 w-9 rounded-xl grid place-items-center ${p.accentBg} ${p.accent}`}>
                    <p.icon className="h-5 w-5" />
                  </span>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{p.name}</p>
                </div>

                <p className="text-sm text-muted-foreground leading-snug min-h-[2.5rem]">{p.forWho}</p>

                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-5xl md:text-6xl font-black tracking-tight">
                    {p.monthlyFee === 0 ? "R$ 0" : brl(p.monthlyFee)}
                  </span>
                  <span className="text-sm text-muted-foreground font-semibold">/mês</span>
                </div>

                {gmvTrigger ? (
                  <p className="mt-2 text-xs font-bold text-primary">
                    Vira {paidPrice} depois de {gmvTrigger}
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-bold text-muted-foreground">Preço fixo · sem gatilho de upgrade</p>
                )}

                <ul className="mt-6 space-y-2.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <span className="leading-snug text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={onCTA}
                  className={`mt-7 min-h-[48px] rounded-xl font-black ${
                    highlight ? "shadow-[0_16px_40px_-12px_hsl(var(--primary)/0.6)]" : ""
                  }`}
                  variant={highlight ? "default" : "outline"}
                >
                  {isPdv ? "Contratar PDV" : "Começar grátis"} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {highlight && (
                  <p className="mt-3 text-[11px] text-muted-foreground text-center font-semibold">
                    Sem cartão · cancele quando quiser
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-muted/40 to-background p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-primary/10 grid place-items-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <h4 className="text-sm font-black tracking-tight">Regras claras, sem letra miúda</h4>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FeeNote
                title="Taxa de entrega"
                body="Você define quanto cobrar. Nos planos Comissão e Essencial, a plataforma soma R$ 0,99 em cima — o cliente paga, você recebe sua parte inteira. No Autonomia esse acréscimo é zero."
              />
              <FeeNote
                title="PIX online"
                body="R$ 1,99 por pedido pago via PIX (descontado no repasse). Dinheiro e cartão não têm taxa."
              />
              <FeeNote
                title="Módulo PDV"
                body="Opcional no Essencial e Autonomia por + R$ 49/mês. O plano Somente PDV é focado só no caixa, sem delivery nem vitrine pública."
              />
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button onClick={onCompare} className="inline-flex items-center gap-1.5 text-sm font-black text-primary hover:underline">
            {showCompare ? "Ocultar" : "Ver"} comparação completa de recursos
            <ChevronDown className={`h-4 w-4 transition-transform ${showCompare ? "rotate-180" : ""}`} />
          </button>
          {showCompare && (
            <div className="mt-6 text-left">
              <PlansComparisonTable />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FeeNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-background/60 border border-border/60 p-4">
      <p className="text-[11px] font-black uppercase tracking-wider text-primary mb-1.5">{title}</p>
      <p className="text-[12px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export default StoreDirectory;