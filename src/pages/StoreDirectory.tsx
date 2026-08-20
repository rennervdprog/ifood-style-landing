import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PartnerClientView from "@/components/PartnerClientView";
import { PLANS } from "@/lib/plansInfo";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  FileText,
  Menu,
  MessageCircle,
  PackageCheck,
  Pizza,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Store,
  StoreIcon,
  Truck,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { prefetchHandlers } from "@/lib/prefetchRoute";
import { formatBRL } from "@/lib/utils";
import { REPASSE_RULES } from "@/lib/repasseRules";

const SEGMENTS = [
  { icon: Pizza, title: "Pizzarias" },
  { icon: ShoppingBag, title: "Lanches" },
  { icon: ShoppingCart, title: "Mercados" },
  { icon: PackageCheck, title: "Docerias" },
  { icon: StoreIcon, title: "Bares" },
  { icon: Store, title: "Loja física" },
];

const PAINS = [
  ["Depende de apps e comissões altas", "Venda no seu canal, sem comissão"],
  ["Pedidos perdidos e confirmação manual", "Cardápio e pedido organizados"],
  ["Sem confirmação de pagamento", "PIX confirmado na hora"],
  ["Sem dados para tomar decisões", "Relatórios e controle na sua mão"],
] as const;

const FEATURES = [
  { icon: Store, title: "Cardápio próprio", desc: "Monte seu cardápio e divulgue seu link." },
  { icon: Zap, title: "PIX online", desc: "Receba pagamentos com confirmação na hora." },
  { icon: MessageCircle, title: "WhatsApp", desc: "Atenda e envie atualizações com um clique." },
  { icon: Truck, title: "Motoboy próprio", desc: "Gestão de entregas com sua própria equipe." },
  { icon: BarChart3, title: "Relatórios", desc: "Acompanhe vendas, clientes e produtos." },
  { icon: ReceiptText, title: "PDV", desc: "Venda no balcão com controle total." },
];

const STEPS = [
  { number: "1", title: "Crie a loja", desc: "Cadastre sua loja em poucos minutos." },
  { number: "2", title: "Monte o cardápio", desc: "Adicione produtos, preços e fotos." },
  { number: "3", title: "Compartilhe seu link", desc: "Divulgue no Instagram e WhatsApp." },
  { number: "4", title: "Receba pedidos", desc: "Pedido confirmado pronto para operar." },
];

const COMPARISON = [
  ["Venda no seu canal", "Sim", "Não", "Sim"],
  ["Comissão por pedido", "0%", "Varia", "0%"],
  ["PIX confirmado", "Sim", "Depende", "Não"],
  ["Gestão de entregas", "Sim", "Limitado", "Não"],
  ["Relatórios e dados", "Completos", "Limitados", "Não"],
  ["Facilidade de uso", "Alta", "Média", "Baixa"],
] as const;

const FAQS = [
  {
    question: "Como funciona o gatilho de faturamento?",
    answer: "Nos planos Essencial e Autonomia, a gratuidade é avaliada no período de análise de 60 dias. Antes de uma mensalidade começar, a loja recebe 30 dias de aviso e registra o aceite da nova condição.",
  },
  {
    question: "Quais são as formas de pagamento aceitas?",
    answer: "Sua loja pode receber por PIX online, PIX na maquininha, dinheiro, cartão ou maquininha conforme as opções configuradas no painel.",
  },
  {
    question: "Posso cancelar quando quiser?",
    answer: "Sim. Não há multa nem fidelidade. A loja pode ser desativada pelo painel, respeitando apenas valores já devidos e obrigações em aberto.",
  },
  {
    question: "Preciso de CNPJ para usar?",
    answer: "Você pode iniciar o cadastro conforme as opções disponíveis no fluxo da plataforma. Os dados exigidos são apresentados com clareza durante a criação da loja.",
  },
];

const ScrollProgress = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const root = document.documentElement;
      const total = Math.max(1, root.scrollHeight - root.clientHeight);
      setProgress(Math.min(100, (root.scrollTop / total) * 100));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-[80] h-[2px] pointer-events-none">
      <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
    </div>
  );
};

function Navbar({ onNavigate, isLoggedIn }: { onNavigate: (path: string) => void; isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const links = [
    { label: "Recursos", href: "#recursos" },
    { label: "Planos", href: "#planos" },
    { label: "Como funciona", href: "#como-funciona" },
    { label: "Dúvidas", href: "#faq" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (href: string) => {
    setOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className={`sticky top-0 z-[70] transition-all duration-200 ${scrolled ? "border-b border-border bg-background/95 shadow-[0_8px_28px_-22px_hsl(var(--foreground)/0.36)] backdrop-blur-xl" : "bg-background/75 backdrop-blur-md"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-6">
        <button onClick={() => scrollTo("#hero")} aria-label="Início ItaSuper" className="shrink-0">
          <img src="/itasuper-logo-horizontal.webp" alt="ItaSuper" width={170} height={40} className="h-7 w-auto md:h-8" decoding="async" />
        </button>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <button key={link.href} onClick={() => scrollTo(link.href)} className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {isLoggedIn ? (
            <Button onClick={() => onNavigate("/pedidos")} className="rounded-full px-5 font-bold">
              <ShoppingBag className="mr-2 h-4 w-4" /> Meus pedidos
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onNavigate("/auth")} className="rounded-full font-semibold">Entrar</Button>
              <Button onClick={() => onNavigate("/cadastro-lojista")} className="rounded-full px-5 font-bold shadow-[0_12px_26px_-14px_hsl(var(--primary)/0.85)]">
                Criar loja grátis
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button size="sm" onClick={() => onNavigate("/cadastro-lojista")} className="h-9 rounded-full px-4 text-xs font-bold">Começar</Button>
          <button onClick={() => setOpen((value) => !value)} aria-label={open ? "Fechar menu" : "Abrir menu"} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card">
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          <div className="grid grid-cols-2 gap-2">
            {links.map((link) => (
              <button key={link.href} onClick={() => scrollTo(link.href)} className="rounded-xl border border-border bg-card px-3 py-3 text-left text-sm font-semibold">
                {link.label}
              </button>
            ))}
          </div>
          {!isLoggedIn && <Button variant="outline" onClick={() => onNavigate("/auth")} className="mt-3 h-11 w-full rounded-xl font-bold">Entrar</Button>}
        </div>
      )}
    </nav>
  );
}

function SectionHeading({ eyebrow, title, description, centered = false }: { eyebrow: string; title: React.ReactNode; description?: string; centered?: boolean }) {
  return (
    <div className={`max-w-2xl ${centered ? "mx-auto text-center" : ""}`}>
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="text-3xl font-black leading-[1.03] tracking-tight text-foreground md:text-5xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>}
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[650px]">
      <div className="overflow-hidden rounded-[1.65rem] border border-border bg-card shadow-[0_28px_80px_-38px_hsl(var(--foreground)/0.38)]">
        <div className="flex h-10 items-center gap-2 border-b border-border bg-muted/40 px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/35" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          <div className="ml-3 h-5 w-36 rounded-full bg-background" />
        </div>
        <div className="grid min-h-[330px] grid-cols-[108px,1fr] bg-card sm:grid-cols-[126px,1fr]">
          <aside className="hidden border-r border-border bg-muted/30 px-3 py-4 sm:block">
            <img src="/itasuper-logo-horizontal.webp" alt="" className="mb-7 h-5 w-auto" />
            {["Resumo", "Pedidos", "Cardápio", "Clientes", "Entregas", "Relatórios"].map((item, index) => (
              <div key={item} className={`mb-1 rounded-lg px-2.5 py-2 text-[10px] font-bold ${index === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>{item}</div>
            ))}
          </aside>
          <div className="p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-foreground sm:text-sm">Pedidos</p>
                <div className="mt-2 flex gap-3 text-[9px] font-semibold text-muted-foreground sm:text-[10px]">
                  <span className="border-b-2 border-primary pb-1 text-primary">Todos</span><span>Novos 3</span><span className="hidden sm:inline">Em preparo 2</span><span className="hidden sm:inline">Concluídos</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Loja ativa</div>
            </div>
            <div className="grid gap-3 md:grid-cols-[1.35fr,0.8fr]">
              <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between"><div><span className="text-sm font-black">#1257</span><span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-black text-primary">NOVO</span></div><span className="text-[9px] text-muted-foreground">há 2 min</span></div>
                <p className="text-[10px] font-semibold">João Silva</p>
                <p className="mt-1 text-[9px] text-muted-foreground">1× Pizza Calabresa · 1× Refrigerante</p>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3"><span className="text-sm font-black">R$ 59,80</span><Button size="sm" className="h-7 rounded-lg px-2 text-[9px] font-black">Aceitar pedido</Button></div>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">PIX confirmado</p>
                <div className="mt-4 grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
                <p className="mt-4 text-[9px] text-muted-foreground">Pagamento aprovado</p><p className="text-base font-black text-emerald-700">R$ 59,80</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {["28 pedidos", "R$ 1.284,50", "Ticket R$ 45,88"].map((metric) => <div key={metric} className="rounded-lg bg-muted/55 px-2 py-2 text-center text-[8px] font-black text-muted-foreground sm:text-[9px]">{metric}</div>)}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -right-2 top-[38%] hidden rounded-2xl border border-emerald-500/15 bg-card px-3 py-2 shadow-[0_16px_38px_-24px_hsl(var(--foreground)/0.4)] md:block">
        <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Pagamento confirmado</p><p className="mt-1 text-xs font-black">+ R$ 59,80</p>
      </div>
    </div>
  );
}

function CostCard({ icon: Icon, title, children }: { icon: typeof ReceiptText; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-5 flex items-start justify-between gap-4"><p className="text-base font-black">{title}</p><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span></div>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

const StoreDirectory = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [partnerRole, setPartnerRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [liveStats, setLiveStats] = useState<{ stores: number; cities: number } | null>(null);

  const handleCTA = useCallback(() => navigate("/cadastro-lojista"), [navigate]);
  const handleWhatsApp = () => window.open("https://wa.me/5522992796291?text=Olá! Tenho interesse em cadastrar minha loja no ItaSuper.", "_blank");

  useEffect(() => {
    document.title = "ItaSuper — Delivery, PIX e PDV para sua loja";
    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
      if (!element) { element = document.createElement("meta"); element.setAttribute(attr, name); document.head.appendChild(element); }
      element.setAttribute("content", content);
    };
    const description = "Cardápio digital próprio, PIX confirmado, WhatsApp, entregas e PDV para sua loja vender no próprio canal.";
    setMeta("description", description);
    setMeta("og:title", "ItaSuper — Seu delivery, sua marca, seu cliente", "property");
    setMeta("og:description", description, "property");
    setMeta("og:type", "website", "property");
    setMeta("twitter:card", "summary_large_image");
  }, []);

  useEffect(() => { import("@/lib/pageView").then((module) => module.trackPageView("store_directory")); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from("stores_public").select("address_city").eq("status", "ativo");
        if (cancelled || !data) return;
        const cities = new Set(data.map((store: any) => (store.address_city || "").trim().toLowerCase()).filter(Boolean));
        setLiveStats({ stores: data.length, cities: cities.size });
      } catch { /* página continua com métricas de fallback */ }
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
          if (!profile.is_approved) {
            const { data: storeDriver } = await supabase.from("store_drivers").select("id").eq("driver_user_id", user.id).limit(1).maybeSingle();
            if (!storeDriver) { navigate("/entregador", { replace: true }); return; }
          }
          setPartnerRole(profile.role);
          if (!cancelled) setRoleChecked(true);
          return;
        }
        if (!profile?.role || profile.role === "cliente") { navigate("/cliente", { replace: true }); return; }
      } catch (error) { console.error("StoreDirectory role check error:", error); }
      if (!cancelled) setRoleChecked(true);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading, navigate]);

  if (roleChecked && partnerRole) return <PartnerClientView />;
  if (authLoading || (user && !roleChecked)) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const storesCount = liveStats?.stores ?? 35;
  const citiesCount = liveStats?.cities ?? 6;
  const essential = PLANS.fixed;
  const autonomy = PLANS.autonomy;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAFAFA] text-foreground antialiased">
      <ScrollProgress />
      <Navbar onNavigate={navigate} isLoggedIn={!!user} />

      <main>
        <section id="hero" className="relative overflow-hidden px-5 pb-16 pt-10 md:px-6 md:pb-24 md:pt-16">
          <div aria-hidden className="absolute inset-0 -z-10"><div className="absolute -right-44 -top-40 h-[540px] w-[540px] rounded-full bg-primary/[0.09] blur-3xl" /><div className="absolute -left-52 bottom-0 h-[430px] w-[430px] rounded-full bg-primary/[0.06] blur-3xl" /></div>
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr,1.1fr] lg:gap-16">
            <div className="max-w-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>{storesCount}+ lojas ativas em {citiesCount} cidades</div>
              <h1 className="text-[2.85rem] font-black leading-[0.94] tracking-[-0.055em] text-foreground sm:text-6xl lg:text-7xl">Seu delivery.<br />Sua marca.<br /><span className="text-primary">Seu cliente.</span></h1>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">Tenha seu cardápio digital, receba pedidos com PIX confirmado, atenda pelo WhatsApp e tenha controle real das suas entregas.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button size="lg" onClick={handleCTA} {...prefetchHandlers("/cadastro-lojista")} className="h-14 rounded-2xl px-7 text-base font-black shadow-[0_18px_36px_-18px_hsl(var(--primary)/0.9)]">Criar minha loja grátis <ArrowRight className="ml-2 h-5 w-5" /></Button><Button size="lg" variant="outline" onClick={handleWhatsApp} className="h-14 rounded-2xl border-2 bg-card px-6 text-base font-bold"><MessageCircle className="mr-2 h-5 w-5" /> Falar no WhatsApp</Button></div>
              <div className="mt-7 grid grid-cols-3 gap-3 border-t border-border pt-5 text-[11px] font-bold text-muted-foreground sm:flex sm:flex-wrap sm:gap-x-5"><span className="inline-flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-primary" /> Sem cartão</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" /> Pronto em 10 min</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Cancele quando quiser</span></div>
            </div>
            <DashboardPreview />
          </div>
        </section>

        <section className="border-y border-border bg-card px-5 py-6 md:px-6 md:py-8"><div className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-border"><Metric value={`${storesCount}+`} label="lojas ativas" /><Metric value={String(citiesCount)} label="cidades" /><Metric value="0%" label="comissão por pedido" /></div></section>

        <section className="px-5 py-12 md:px-6 md:py-16"><div className="mx-auto max-w-6xl"><div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-6">{SEGMENTS.map(({ icon: Icon, title }) => <div key={title} className="flex flex-col items-center gap-2 px-2 py-4 text-center md:py-5"><Icon className="h-5 w-5 text-primary" /><span className="text-[10px] font-black md:text-xs">{title}</span></div>)}</div></div></section>

        <section className="px-5 py-16 md:px-6 md:py-24"><div className="mx-auto max-w-6xl"><SectionHeading eyebrow="Dois canais, um só painel" title={<>Seu link para sua base.<br /><span className="text-primary">Marketplace para ser encontrado.</span></>} description="Você não precisa escolher entre construir sua própria marca e ganhar novos clientes: os dois caminhos usam o mesmo cardápio, preços, pedidos e operação." /><div className="mt-10 grid gap-3 md:grid-cols-2"><article className="rounded-3xl border border-border bg-card p-6 md:p-7"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></span><p className="mt-6 text-xl font-black">Canal próprio</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Receba um link exclusivo da sua loja para divulgar no WhatsApp, Instagram, bio e onde sua base já está. O cliente compra com a sua marca.</p><div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-bold text-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> Você é dono da relação com o cliente</div></article><article className="rounded-3xl border border-primary/25 bg-primary/[0.045] p-6 md:p-7"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><ShoppingBag className="h-5 w-5" /></span><p className="mt-6 text-xl font-black">Marketplace ItaSuper</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Além do link próprio, sua loja disponível pode aparecer na vitrine ItaSuper para ser descoberta por clientes da sua cidade. É alcance extra sem abandonar o seu canal.</p><div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs font-bold text-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> Mesma loja, cardápio e operação</div></article></div><div className="mt-3 rounded-2xl border border-border bg-muted/35 px-5 py-4 text-sm leading-relaxed text-muted-foreground"><b className="text-foreground">Na prática:</b> divulgue seu link para clientes recorrentes no WhatsApp e mantenha sua loja disponível na vitrine para alcançar quem ainda não conhece sua marca.</div></div></section>

        <section className="border-y border-border bg-muted/20 px-5 py-16 md:px-6 md:py-24"><div className="mx-auto max-w-6xl"><SectionHeading eyebrow="A diferença" title={<>Menos improviso.<br /><span className="text-primary">Mais controle.</span></>} /><div className="mt-10 overflow-hidden rounded-3xl border border-border bg-card"><div className="grid grid-cols-2 border-b border-border text-[10px] font-black uppercase tracking-[0.16em] md:text-xs"><div className="bg-destructive/[0.04] px-5 py-3 text-destructive">Antes</div><div className="bg-emerald-500/[0.04] px-5 py-3 text-emerald-700">Depois</div></div>{PAINS.map(([before, after]) => <div key={before} className="grid grid-cols-2 border-b border-border last:border-0"><p className="flex items-center gap-2 px-4 py-4 text-xs leading-snug text-muted-foreground md:px-5 md:text-sm"><X className="h-4 w-4 shrink-0 text-destructive/70" />{before}</p><p className="flex items-center gap-2 border-l border-border px-4 py-4 text-xs font-bold leading-snug md:px-5 md:text-sm"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{after}</p></div>)}</div></div></section>

        <section id="recursos" className="px-5 py-16 md:px-6 md:py-24"><div className="mx-auto max-w-6xl"><SectionHeading eyebrow="Seu canal de vendas" title={<>Tudo para vender<br />no <span className="text-primary">seu canal.</span></>} description="Recursos para vender no seu canal, organizar a operação e ainda aproveitar a descoberta da vitrine ItaSuper." /><div className="mt-10 grid gap-3 md:grid-cols-4"><div className="rounded-3xl border border-border bg-card p-5 shadow-[0_18px_55px_-42px_hsl(var(--foreground)/0.45)] md:col-span-2 md:row-span-2 md:p-7"><div className="flex items-center justify-between"><p className="text-sm font-black">Resumo da sua loja</p><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-700">Loja ativa</span></div><div className="mt-6 grid grid-cols-3 gap-3"><MiniMetric label="Pedidos hoje" value="28" /><MiniMetric label="Faturamento" value="R$ 1.284,50" /><MiniMetric label="Ticket médio" value="R$ 45,88" /></div><div className="mt-6 flex h-32 items-end gap-2 rounded-2xl bg-muted/45 p-4">{[35, 55, 42, 67, 58, 84, 62, 94, 77, 100].map((height, index) => <span key={index} className="flex-1 rounded-t bg-primary/20" style={{ height: `${height}%` }} />)}</div><p className="mt-4 text-sm text-muted-foreground">Acompanhe vendas, pedidos e desempenho numa única tela.</p></div>{FEATURES.map(({ icon: Icon, title, desc }) => <article key={title} className="rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/35"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><h3 className="mt-4 text-sm font-black">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p></article>)}</div></div></section>

        <section id="como-funciona" className="border-y border-border bg-muted/20 px-5 py-16 md:px-6 md:py-24"><div className="mx-auto max-w-6xl"><SectionHeading eyebrow="Como funciona" title={<>Do zero ao primeiro pedido<br />em <span className="text-primary">10 minutos.</span></>} /><div className="mt-10 rounded-3xl border border-border bg-card p-5 md:p-7"><div className="grid gap-6 md:grid-cols-4">{STEPS.map((step, index) => <div key={step.number} className="relative"><span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-black text-primary-foreground">{step.number}</span>{index < STEPS.length - 1 && <span className="absolute left-10 right-0 top-4 hidden h-px bg-border md:block" />}<h3 className="mt-4 text-base font-black">{step.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.desc}</p></div>)}</div><div className="mt-7 flex flex-col items-start justify-between gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3 sm:flex-row sm:items-center"><span className="text-sm font-bold">Pedido #1257 pronto para operar</span><span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Pagamento via PIX confirmado</span></div></div></div></section>

        <section className="px-5 py-16 md:px-6 md:py-24"><div className="mx-auto max-w-6xl"><SectionHeading eyebrow="Transparência" title={<>Custos claros,<br /><span className="text-primary">sem surpresa.</span></>} description="Planos, taxas e cobranças aparecem de forma separada no seu painel para você saber exatamente o que está pagando." /><div className="mt-10 grid gap-3 md:grid-cols-3"><CostCard icon={FileText} title="Seu plano"><p>Pague apenas após o gatilho de faturamento aplicável ao seu plano.</p><p className="mt-3 font-black text-foreground">Planos a partir de R$ 89,90/mês</p></CostCard><CostCard icon={Wallet} title="A taxa de plataforma (R$ 0,99)"><p>No plano Essencial, a taxa de R$ 0,99 é aplicada à entrega própria quando essa regra estiver ativa. Ela não é comissão sobre o valor dos produtos.</p><div className="mt-4 space-y-2 rounded-xl bg-muted/50 p-3 text-xs"><p><b className="text-foreground">Cliente paga:</b> R$ 0,99 são somados à taxa de entrega.</p><p><b className="text-foreground">Meio a meio:</b> cliente paga R$ 0,50 e a loja absorve R$ 0,49.</p><p><b className="text-foreground">Lojista paga:</b> o cliente não vê a taxa e R$ 0,99 entram no saldo operacional.</p></div><p className="mt-4 text-xs font-bold text-muted-foreground">No plano Autonomia, a taxa de plataforma na entrega é R$ 0,00.</p></CostCard><CostCard icon={Clock3} title="Quando a loja absorve a taxa"><p>Os valores que a loja escolhe absorver ficam detalhados no Financeiro. Quando o ciclo elegível atingir {formatBRL(REPASSE_RULES.MIN_AUTO_CHARGE_BRL)}, uma cobrança PIX poderá ser criada na segunda-feira.</p><p className="mt-3 text-xs font-bold text-muted-foreground">{formatBRL(REPASSE_RULES.BLOCK_THRESHOLD_BRL)} ou 30 dias podem bloquear novos pedidos.</p></CostCard></div></div></section>

        <section className="border-y border-border bg-muted/20 px-5 py-16 md:px-6 md:py-24"><div className="mx-auto max-w-5xl"><SectionHeading eyebrow="Comparativo" title={<>Mais controle que marketplace.<br /><span className="text-primary">Mais simples que planilha.</span></>} /><div className="mt-10 overflow-x-auto rounded-3xl border border-border bg-card"><div className="min-w-[620px]"><div className="grid grid-cols-[1.45fr,1fr,1fr,1fr] border-b border-border bg-muted/50 text-[10px] font-black uppercase tracking-wider"><div className="p-4 text-muted-foreground">Recurso</div><div className="p-4 text-primary">ItaSuper</div><div className="p-4 text-muted-foreground">Marketplace</div><div className="p-4 text-muted-foreground">WhatsApp</div></div>{COMPARISON.map(([name, us, marketplace, whatsapp], index) => <div key={name} className={`grid grid-cols-[1.45fr,1fr,1fr,1fr] border-b border-border text-xs last:border-0 md:text-sm ${index % 2 ? "bg-muted/20" : ""}`}><p className="p-4 font-bold">{name}</p><p className="p-4 font-black text-emerald-700">{us}</p><p className="p-4 text-muted-foreground">{marketplace}</p><p className="p-4 text-muted-foreground">{whatsapp}</p></div>)}</div></div></div></section>

        <section id="planos" className="px-5 py-16 md:px-6 md:py-24"><div className="mx-auto max-w-6xl"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><SectionHeading eyebrow="Planos" title={<>Planos feitos para<br />cada <span className="text-primary">momento.</span></>} /><Button variant="outline" onClick={() => navigate("/planos")} className="h-11 rounded-xl border-2 bg-card font-black">Ver todos os planos <ArrowRight className="ml-2 h-4 w-4" /></Button></div><div className="mt-10 grid gap-3 md:grid-cols-2">{[essential, autonomy].map((plan) => { const isEssential = plan.id === "fixed"; const value = isEssential ? "R$ 89,90/mês" : "R$ 199,90/mês"; const trigger = isEssential ? "após o gatilho de faturamento" : "após o gatilho de faturamento"; return <article key={plan.id} className={`rounded-3xl border p-6 md:p-7 ${isEssential ? "border-primary/35 bg-primary/[0.045]" : "border-border bg-card"}`}><div className="flex items-center justify-between"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${plan.accentBg} ${plan.accent}`}><plan.icon className="h-5 w-5" /></span>{isEssential && <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary-foreground">Mais escolhido</span>}</div><h3 className="mt-6 text-2xl font-black">{plan.name}</h3><p className="mt-1 text-sm text-muted-foreground">{plan.forWho}</p><p className="mt-6 text-3xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-primary">{trigger}</p><ul className="mt-6 space-y-2">{plan.features.slice(0, 4).map((feature) => <li key={feature} className="flex gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{feature}</li>)}</ul><Button onClick={handleCTA} variant={isEssential ? "default" : "outline"} className="mt-7 h-11 w-full rounded-xl font-black">Começar grátis <ArrowRight className="ml-2 h-4 w-4" /></Button></article>; })}</div></div></section>

        <section id="faq" className="border-y border-border bg-muted/20 px-5 py-16 md:px-6 md:py-24"><div className="mx-auto max-w-4xl"><SectionHeading centered eyebrow="Dúvidas" title="Perguntas frequentes" /><div className="mt-10 overflow-hidden rounded-3xl border border-border bg-card">{FAQS.map((faq, index) => { const open = openFaq === index; return <div key={faq.question} className="border-b border-border last:border-0"><button onClick={() => setOpenFaq(open ? null : index)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left hover:bg-muted/40 md:px-6"><span className="text-sm font-black md:text-base">{faq.question}</span><ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180 text-primary" : ""}`} /></button>{open && <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground md:px-6 md:pb-6">{faq.answer}</p>}</div>; })}</div></div></section>

        <section className="px-5 py-16 md:px-6 md:py-24"><div className="mx-auto grid max-w-6xl items-center gap-7 rounded-[2rem] border border-primary/20 bg-card p-7 shadow-[0_26px_72px_-45px_hsl(var(--foreground)/0.5)] md:grid-cols-[1fr,auto] md:p-12"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Comece hoje</p><h2 className="mt-3 text-3xl font-black leading-[1.03] tracking-tight md:text-5xl">Crie sua loja e comece a vender hoje.</h2><p className="mt-4 max-w-xl text-base text-muted-foreground">Seu canal, sua marca e seus resultados. Sem cartão para começar e sem fidelidade.</p></div><div className="flex flex-col gap-3"><Button size="lg" onClick={handleCTA} className="h-14 rounded-2xl px-7 font-black">Criar loja grátis <ArrowRight className="ml-2 h-5 w-5" /></Button><Button size="lg" variant="outline" onClick={handleWhatsApp} className="h-12 rounded-2xl border-2 bg-card font-bold"><MessageCircle className="mr-2 h-4 w-4" /> Falar no WhatsApp</Button></div></div></section>
      </main>

      <footer className="border-t border-border bg-card px-5 py-10 md:px-6"><div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 md:flex-row md:items-center"><div><img src="/itasuper-logo-horizontal.webp" alt="ItaSuper" width={140} height={32} className="h-7 w-auto" /><p className="mt-2 text-xs text-muted-foreground">Plataforma independente para delivery e loja física.</p></div><div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground"><button onClick={() => navigate("/planos")} className="hover:text-foreground">Planos</button><button onClick={() => navigate("/termos-de-uso")} className="hover:text-foreground">Termos</button><button onClick={() => navigate("/politica-de-privacidade")} className="hover:text-foreground">Privacidade</button><button onClick={handleWhatsApp} className="hover:text-foreground">Contato</button></div></div></footer>

      <div className="fixed inset-x-0 bottom-0 z-50 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA]/95 to-transparent px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-5 md:hidden"><Button onClick={handleCTA} {...prefetchHandlers("/cadastro-lojista")} className="h-[52px] w-full rounded-2xl text-base font-black shadow-[0_18px_36px_-18px_hsl(var(--primary)/0.85)]"><Store className="mr-2 h-5 w-5" /> Criar minha loja grátis <ArrowRight className="ml-2 h-5 w-5" /></Button></div>
    </div>
  );
};

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="px-2 py-1 text-center"><p className="text-2xl font-black tracking-tight md:text-4xl">{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground md:text-xs">{label}</p></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted/55 p-3"><p className="text-[9px] font-bold text-muted-foreground">{label}</p><p className="mt-1 text-xs font-black">{value}</p></div>;
}

export default StoreDirectory;
