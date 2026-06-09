import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AsaasBadgeBar } from "@/components/AsaasBadge";
import PartnerClientView from "@/components/PartnerClientView";
import {
  Zap, Store, ShieldCheck, Smartphone, TrendingUp,
  ArrowRight, CheckCircle2, Star, MapPin, Clock, CreditCard,
  BarChart3, Package,
  Menu, X, DollarSign, Globe, Rocket,
  Sparkles, ChevronDown,
  ShoppingBag, Truck, Crown, BadgePercent,
   Bell, MessageCircle, Shield, Check,
    Navigation, UserCheck, Info,
  } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/* ─── hooks ─── */

/* ─── static data ─── */
 const painPoints = [
   { emoji: "📸", pain: "Manda foto do cardápio no WhatsApp", solution: "Seu cardápio na internet, com fotos bonitas e preço certinho." },
   { emoji: "📝", pain: "Anota pedido no papel e erra o endereço", solution: "O pedido chega pronto, com o endereço completo do cliente." },
   { emoji: "💸", pain: "Confere PIX um por um no extrato", solution: "Quando o cliente paga no PIX, o dinheiro aparece na hora pra você." },
   { emoji: "🔇", pain: "Perde pedidos por não ver mensagem", solution: "O celular toca alto a cada pedido novo. Você não perde nenhum." },
   { emoji: "💬", pain: "Esquece de avisar o cliente quando saiu pra entrega", solution: "O WhatsApp manda sozinho: pedido recebido, em preparo, saiu pra entrega e entregue." },
 ];

const steps = [
   { step: "01", title: "Crie sua conta", desc: "É rápido. Coloca o nome da loja, telefone e pronto." },
   { step: "02", title: "Monte seu cardápio", desc: "Adicione seus produtos com foto e preço. Bem fácil." },
   { step: "03", title: "Mande seu link", desc: "Envia o link da sua loja no WhatsApp e nas redes." },
   { step: "04", title: "Receba os pedidos", desc: "Cada pedido chega no seu celular, organizado e pago." },
 ];
 
 /* ─── Motoboy Data ─── */
 const motoboyWorkflow = [
   { 
     icon: Bell, 
      title: "Apita no celular do motoboy", 
      desc: "Quando o pedido está pronto, o celular do entregador toca avisando que tem entrega.",
     color: "bg-blue-500/10",
     iconColor: "text-blue-500"
   },
   { 
     icon: MapPin, 
      title: "Cliente vê o motoboy no mapa", 
      desc: "O cliente acompanha onde está o motoboy. Ninguém liga pra perguntar a hora da entrega.",
     color: "bg-green-500/10",
     iconColor: "text-green-500"
   },
   { 
     icon: Smartphone, 
      title: "Código de confirmação", 
      desc: "O cliente passa um número para o motoboy na entrega. Assim ninguém entrega no lugar errado.",
     color: "bg-orange-500/10",
     iconColor: "text-orange-500"
   },
   { 
     icon: BarChart3, 
      title: "Acerto fácil no fim do dia", 
      desc: "Você vê quanto cada motoboy entregou e quanto ele tem que te repassar. Sem confusão.",
     color: "bg-purple-500/10",
     iconColor: "text-purple-500"
   },
 ];
 
 const features = [
  { icon: Smartphone, title: "Cardápio no celular", desc: "Seus produtos com foto e preço, num link. O cliente vê tudo sem precisar instalar nada." },
  { icon: CreditCard, title: "Pagamento no PIX", desc: "O cliente paga e o dinheiro cai na hora. Você não precisa mais conferir o extrato." },
  { icon: Truck, title: "Controle de motoboys", desc: "O celular do entregador apita, o cliente vê no mapa e a entrega tem código de confirmação." },
  { icon: BarChart3, title: "Relatório do dia", desc: "Veja quanto vendeu, o que mais saiu e o lucro do dia — tudo numa tela só." },
  { icon: Bell, title: "Avisa cada pedido", desc: "O celular toca a cada pedido novo. Você nunca mais perde uma venda por não ouvir." },
  { icon: Package, title: "Imprime na cozinha", desc: "O pedido sai impresso na cozinha automaticamente. Sua equipe não se perde mais." },
  { icon: MessageCircle, title: "WhatsApp Automático", desc: "A cada etapa do pedido o cliente recebe uma mensagem no WhatsApp. Sem você precisar digitar nada." },
  { icon: ShieldCheck, title: "Tudo seguro", desc: "Seus dados e o dinheiro dos seus clientes ficam protegidos. Só você acessa sua loja." },
  { icon: Store, title: "Caixa do balcão", desc: "Quem vende no balcão também usa: caixa digital, troco automático e fechamento do dia." },
];

const plans = [
  {
    id: "commission_only",
    name: "Comissão",
    tagline: "Comece sem pagar nada",
    price: "0",
    period: "/mês",
    icon: Rocket,
    highlight: false,
    badge: null,
    commission: "6%",
    commissionLabel: "comissão por pedido",
    color: "from-emerald-500 to-emerald-600",
    lightBg: "bg-emerald-50",
    textColor: "text-emerald-600",
    borderColor: "border-emerald-200",
      description: "Bom para quem está começando. Você não paga mensalidade — só uma pequena parte do que vender.",
    features: [
      "Cardápio digital ilimitado",
        "Link exclusivo",
        "PIX automático",
        "Notificações em tempo real",
        "Gestão completa de pedidos",
        "Gestão de taxas de entrega",
        "Relatórios e Financeiro 100%",
       "Suporte via comunidade",
    ],
    extraFees: [
      { label: "Taxa Entrega", value: "R$ 2,00 (pago pelo cliente somado à sua taxa)" },
    ],
    extraNote: "A taxa de entrega é somada à definida por você. Ex: você cobra R$ 3,00 → cliente paga R$ 5,00 (R$ 3 seu + R$ 2 plataforma).",
  },
  {
    id: "hybrid",
    name: "Crescimento",
    tagline: "Comece por R$50 — cresce com você",
    price: "50",
    period: "/mês",
    icon: TrendingUp,
    highlight: false,
    badge: null,
    commission: "2,5%",
    commissionLabel: "comissão por pedido",
    color: "from-blue-500 to-blue-600",
    lightBg: "bg-blue-50",
    textColor: "text-blue-600",
    borderColor: "border-blue-200",
     description: "Bom para quem já vende todo dia e quer pagar menos por cada pedido.",
    features: [
      "Tudo do plano Comissão",
      "Comissão reduzida para 2,5%",
      "R$50/mês → R$100 após 2 meses faturando acima de R$5.000",
      "PDV — Caixa presencial (1% comissão)",
      "Banners ilimitados na loja",
      "Agendamento de pedidos",
      "Destaque na vitrine",
      "Programa de fidelidade",
      "Suporte prioritário",
    ],
    extraFees: [
      { label: "Taxa Entrega", value: "R$ 2,00 (pago pelo cliente somado à sua taxa)" },
    ],
    extraNote: "A taxa de entrega é somada à definida por você. Ex: você cobra R$ 3,00 → cliente paga R$ 5,00 (R$ 3 seu + R$ 2 plataforma).",
  },
  {
    id: "fixed",
    name: "Essencial",
    tagline: "O mais usado pelos lojistas",
    price: "90",
    period: "/mês",
    icon: Crown,
    highlight: true,
    badge: "⭐ Mais escolhido",
    commission: "0%",
    commissionLabel: "sem comissão por venda",
    color: "from-primary to-orange-600",
    lightBg: "bg-accent",
    textColor: "text-primary",
    borderColor: "border-primary/30",
     description: "Você fica com o dinheiro inteiro de cada venda. Sem comissão sobre os seus produtos.",
    features: [
      "Todas as ferramentas inclusas",
      "Zero comissão por venda (0%)",
      "R$90/mês → R$180 após 2 meses faturando acima de R$5.000",
      "PDV — Caixa presencial (0% comissão)",
      "Gestão completa de motoboys",
      "Relatórios financeiros avançados",
      "Suporte prioritário via WhatsApp",
      "7 dias grátis para testar",
    ],
    extraFees: [
       { label: "Taxa PIX", value: "R$ 1,99/transação" },
        { label: "Taxa Entrega", value: "R$ 2,00 (pago pelo cliente somado à sua taxa)" },
    ],
    extraNote: "A taxa de entrega é somada à definida por você. Ex: você cobra R$ 3,00 → cliente paga R$ 5,00 (R$ 3 seu + R$ 2 plataforma).",
  },
  {
    id: "supporter",
    name: "Apoiador",
    tagline: "Preço travado pra sempre · Só 10 vagas",
    price: "75",
    period: "/mês",
    icon: Sparkles,
    highlight: false,
    badge: "🚀 Lançamento • 10 vagas",
    commission: "0%",
    commissionLabel: "sem comissão por venda",
    color: "from-violet-500 to-purple-600",
    lightBg: "bg-accent",
    textColor: "text-primary",
    borderColor: "border-primary/30",
     description: "Os mesmos benefícios do plano Essencial, com preço menor travado pra sempre. Só para os 10 primeiros.",
    features: [
      "Tudo do plano Essencial",
      "Zero comissão por venda (0%)",
      "PDV — Caixa presencial (0% comissão)",
      "Valor mensal de R$75 fixo vitalício",
      "Selo exclusivo de Apoiador na sua loja",
      "Acesso antecipado a novidades",
      "Apenas 10 vagas disponíveis",
    ],
    extraFees: [
       { label: "Taxa PIX", value: "R$ 1,99/transação" },
        { label: "Taxa Entrega", value: "R$ 2,00 (pago pelo cliente somado à sua taxa)" },
    ],
    extraNote: "A taxa de entrega é somada à definida por você. Ex: você cobra R$ 3,00 → cliente paga R$ 5,00 (R$ 3 seu + R$ 2 plataforma).",
  },
];

const benefits = [
  {
    icon: "🍕",
    segment: "Pizzarias & Hamburguerias",
    headline: "Sem erro no pedido",
    text: "Pizza meio-a-meio, borda recheada e adicionais organizados sozinhos. O papel sai impresso na cozinha.",
  },
  {
    icon: "🛒",
    segment: "Mercados & Adegas",
    headline: "Muitos produtos, sem confusão",
    text: "Cadastre seus produtos por categoria. O cliente faz o pedido sozinho, sem te ligar.",
  },
  {
    icon: "🍰",
    segment: "Docerias & Padarias",
    headline: "Cliente agenda sozinho",
    text: "O cliente escolhe o dia e a hora para retirar ou receber. Você se organiza com calma.",
  },
  {
    icon: "🍺",
    segment: "Bares & Restaurantes",
    headline: "Delivery e balcão juntos",
    text: "Recebe pedido pelo aplicativo e também vende no balcão. Tudo no mesmo lugar.",
  },
  {
    icon: "💈",
    segment: "Lojas & Serviços",
    headline: "Vende sem precisar de entrega",
    text: "Use como vitrine dos seus produtos e como caixa do balcão. Sem precisar de motoboy.",
  },
];

const faqs = [
  { q: "Preciso baixar algum programa?", a: "Não. Você usa tudo direto no celular ou no computador. O seu cliente também não precisa instalar nada." },
  { q: "Como o cliente paga?", a: "Pelo PIX, direto no celular. Quando ele paga, o dinheiro aparece na hora pra você." },
  { q: "Funciona na minha cidade?", a: "Sim. Funciona em qualquer cidade do Brasil, seja grande ou pequena." },
  { q: "Quanto custa?", a: "Você pode começar de graça. Só paga uma pequena parte do que vender. Se preferir, pode escolher um plano com mensalidade fixa." },
  { q: "Posso cancelar quando quiser?", a: "Pode sim. Sem multa, sem fidelidade, sem pegadinha." },
  { q: "E se eu tiver dificuldade?", a: "Nossa equipe te ajuda no WhatsApp. É só chamar que a gente responde." },
];

/* ─── Scroll Progress Bar (reading indicator no topo) ─── */
const ScrollProgress = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      setProgress(Math.min(100, Math.max(0, scrolled * 100)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-[60] pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-primary via-orange-500 to-primary transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

/* ─── Sticky Mobile CTA (aparece após scroll > 600px) ─── */
const StickyMobileCTA = ({ onClick }: { onClick: () => void }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY;
      const nearBottom =
        window.innerHeight + scrolled >= document.documentElement.scrollHeight - 320;
      setShow(scrolled > 600 && !nearBottom);
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
      <Button
        onClick={onClick}
        className="w-full min-h-[52px] rounded-2xl text-base font-black shadow-2xl shadow-primary/30 bg-primary"
      >
        <Store className="mr-2 h-5 w-5" />
        Criar minha loja grátis
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
    </div>
  );
};

/* ─── Navbar ─── */
const Navbar = ({ onNavigate, isLoggedIn }: { onNavigate: (path: string) => void; isLoggedIn?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const links = [
    { label: "Vantagens", href: "#vantagens" },
    { label: "Como funciona", href: "#como-funciona" },
    { label: "Planos", href: "#planos" },
  ];

  const scrollTo = (id: string) => {
    setOpen(false);
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className={`sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 ${scrolled ? "bg-background/80 border-b border-border shadow-sm" : "bg-background/40 border-b border-transparent"}`}>
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
        <button onClick={() => scrollTo("#hero")} className="flex items-center group" aria-label="Ir para o início">
          <img
            src="/itasuper-logo-horizontal.webp"
            alt="ItaSuper"
            width={170}
            height={40}
            decoding="async"
            fetchPriority="high"
            className="h-10 md:h-11 w-auto object-contain group-hover:scale-105 transition-transform"
          />
        </button>

        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <button key={l.href} onClick={() => scrollTo(l.href)} className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">
              {l.label}
            </button>
          ))}
          {isLoggedIn ? (
            <Button className="rounded-full font-bold text-sm px-6 gap-2" onClick={() => onNavigate("/pedidos")}>
              <ShoppingBag className="h-4 w-4" />
              Meus Pedidos
            </Button>
          ) : (
            <>
              <button onClick={() => onNavigate("/portal-parceiro")} className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">
                Já sou parceiro
              </button>
              <Button variant="outline" className="rounded-full font-bold text-sm px-6" onClick={() => onNavigate("/auth")}>
                Entrar
              </Button>
              <Button className="rounded-full font-bold text-sm px-6" onClick={() => onNavigate("/cadastro-lojista")}>
                Cadastrar grátis
              </Button>
            </>
          )}
        </div>

        <div className="md:hidden flex items-center gap-2">
          {!isLoggedIn && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full font-bold text-xs px-6 h-9"
              onClick={() => onNavigate("/auth")}
            >
              Entrar
            </Button>
          )}
          <button onClick={() => setOpen(!open)} aria-label={open ? "Fechar menu" : "Abrir menu"}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border px-4 pb-4 pt-2 animate-in slide-in-from-top-2">
          {links.map((l) => (
            <button key={l.href} onClick={() => scrollTo(l.href)} className="block w-full text-left py-3 text-sm font-semibold text-muted-foreground">
              {l.label}
            </button>
          ))}
          {isLoggedIn ? (
            <Button className="w-full min-h-[44px] rounded-full font-bold mt-2 gap-2" onClick={() => { setOpen(false); onNavigate("/pedidos"); }}>
              <ShoppingBag className="h-4 w-4" /> Meus Pedidos
            </Button>
          ) : (
            <>
              <button onClick={() => { setOpen(false); onNavigate("/portal-parceiro"); }} className="block w-full text-left py-3 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">
                Já sou parceiro
              </button>
              <Button className="w-full min-h-[44px] rounded-full font-bold mt-2" onClick={() => { setOpen(false); onNavigate("/cadastro-lojista"); }}>
                Criar minha loja grátis
              </Button>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

/* ─── Main Component ─── */
const StoreDirectory = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [partnerRole, setPartnerRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [supporterTaken, setSupporterTaken] = useState<number | null>(null);
  const [liveStats, setLiveStats] = useState<{ stores: number; cities: number } | null>(null);

  // No fake stats — we use honest value props instead


  const handleCTA = () => navigate("/cadastro-lojista");
  const handleWhatsApp = () =>
    window.open("https://wa.me/5522992796291?text=Olá! Tenho interesse em cadastrar minha loja na plataforma.", "_blank");

  useEffect(() => {
    document.title = "ItaSuper — Cardápio digital, delivery próprio e PDV para lojas em todo o Brasil";
  }, []);

  // Registra visualização da landing (RPC ignora admin/moderador/contas internas)
  useEffect(() => {
    const KEY = "pv_store_directory_at";
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30 * 60 * 1000) return; // 1x a cada 30min/sessão
    let visitorHash = localStorage.getItem("visitor_hash");
    if (!visitorHash) {
      visitorHash = crypto.randomUUID();
      localStorage.setItem("visitor_hash", visitorHash);
    }
    supabase.rpc("record_page_view", { _page: "store_directory", _visitor_hash: visitorHash })
      .then(({ error }) => { if (!error) sessionStorage.setItem(KEY, String(Date.now())); });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("count_supporter_plans");
        if (cancelled || error) return;
        setSupporterTaken(typeof data === "number" ? data : 0);
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Live social proof: real number of active stores + cities
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
        const cities = new Set(
          data.map((s: any) => (s.address_city || "").trim().toLowerCase()).filter(Boolean),
        );
        setLiveStats({ stores: data.length, cities: cities.size });
      } catch {
        /* silent */
      }
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
        // Cliente role or no special role → redirect to client home
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

  // ⚡ Render landing immediately. Role check happens in the background and
  // only switches view if the user is actually a logged-in partner.
  // Anonymous visitors (vast majority) see the page instantly with no spinner.
  if (roleChecked && partnerRole) return <PartnerClientView />;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <ScrollProgress />
      <Navbar onNavigate={navigate} isLoggedIn={!!user} />

      {/* ══════ HERO ══════ */}
      <section id="hero" className="relative pt-16 pb-20 md:pt-24 md:pb-32 px-4 overflow-hidden">
        {/* Camadas de fundo sutis (gradientes via tokens) */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.10),transparent_55%),radial-gradient(circle_at_bottom_left,hsl(var(--accent)/0.35),transparent_55%)] pointer-events-none" />
        <div className="absolute top-1/3 -left-32 w-[480px] h-[480px] bg-primary/[0.06] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 -right-32 w-[420px] h-[420px] bg-orange-500/[0.05] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative mx-auto max-w-6xl grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Coluna esquerda — copy */}
          <div className="lg:col-span-7 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/15 px-3.5 py-1.5 text-xs font-bold text-primary mb-6 animate-fade-in">
              <Globe className="h-3.5 w-3.5" />
              Disponível em todo o Brasil 🇧🇷
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black tracking-tight text-foreground leading-[0.95] mb-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
              Venda mais.{" "}
              <span className="text-primary relative inline-block">
                Pague menos comissão
                <span className="absolute -bottom-2 left-0 w-full h-3 bg-primary/20 -z-10 rounded-full" />
              </span>
              {" "}por cada pedido.
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
              Cardápio digital, PIX automático, motoboy integrado e PDV do balcão — tudo num app só. Crie sua loja em 10 minutos e{" "}
              <span className="text-foreground font-bold">comece a vender hoje mesmo.</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:items-start lg:justify-start justify-center gap-3 animate-in fade-in zoom-in-95 duration-1000 delay-300">
              <Button
                size="lg"
                onClick={handleCTA}
                className="text-base md:text-lg px-7 py-4 min-h-[56px] rounded-2xl shadow-2xl shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 active:scale-[0.98] font-black w-full sm:w-auto"
              >
                <Store className="mr-2 h-5 w-5" />
                Criar minha loja grátis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleWhatsApp}
                className="text-base px-7 py-4 min-h-[56px] rounded-2xl w-full sm:w-auto border-foreground/15 hover:border-primary/40 hover:bg-primary/5"
              >
                <MessageCircle className="mr-2 h-5 w-5" /> Falar no WhatsApp
              </Button>
            </div>

            {/* Trust microcopy logo abaixo dos CTAs */}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 justify-center lg:justify-start text-xs text-muted-foreground">
              {[
                { icon: CheckCircle2, text: "Sem cartão de crédito" },
                { icon: Clock, text: "Pronto em 10 min" },
                { icon: ShieldCheck, text: "Cancele quando quiser" },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <t.icon className="h-3.5 w-3.5 text-primary" />
                  <span className="font-semibold">{t.text}</span>
                </div>
              ))}
            </div>

            {/* Faixa de prova social — diferenciais */}
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-xl mx-auto lg:mx-0">
              {[
                {
                  v: liveStats ? `+${liveStats.stores}` : "10min",
                  l: liveStats ? "Lojas ativas" : "Pra começar",
                  c: "text-primary",
                },
                {
                  v: liveStats && liveStats.cities > 0 ? `${liveStats.cities}` : "R$0",
                  l: liveStats && liveStats.cities > 0 ? "Cidades atendidas" : "Mensalidade pra começar",
                  c: "text-foreground",
                },
                { v: "0%", l: "Comissão nos planos pagos", c: "text-primary" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur px-3 py-3 text-center">
                  <p className={`text-xl md:text-2xl font-black tracking-tight ${s.c}`}>{s.v}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna direita — mockup do app */}
          <div className="lg:col-span-5 relative flex justify-center animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <div className="relative">
              {/* Glow atrás do device */}
              <div className="absolute -inset-8 bg-gradient-to-br from-primary/30 via-orange-500/20 to-transparent rounded-full blur-3xl opacity-60" />

              {/* Device frame */}
              <div className="relative w-[280px] sm:w-[320px] aspect-[9/19] bg-foreground rounded-[3rem] p-3 shadow-2xl">
                <div className="w-full h-full bg-background rounded-[2.3rem] overflow-hidden relative">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-foreground rounded-b-2xl z-10" />
                  {/* Status bar */}
                  <div className="pt-2 pb-1.5 px-5 flex justify-between text-[10px] font-bold text-foreground/70">
                    <span>9:41</span>
                    <span>•••</span>
                  </div>
                  {/* Header do app */}
                  <div className="bg-primary mx-3 mt-1 rounded-2xl px-3 py-2.5 flex items-center gap-2 shadow-lg shadow-primary/20">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <ShoppingBag className="text-white h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] text-white/80 leading-none font-bold uppercase tracking-wide">ItaSuper</p>
                      <p className="text-xs font-black text-white leading-tight mt-0.5">Novo pedido!</p>
                    </div>
                    <div className="relative">
                      <Bell className="text-white h-4 w-4" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    </div>
                  </div>
                  {/* Card pedido */}
                  <div className="p-3 space-y-2.5 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-foreground">Pedido #1247</span>
                      <span className="text-[8px] font-black text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">PIX PAGO</span>
                    </div>
                    <div className="bg-muted/60 rounded-2xl p-2.5 space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-foreground font-semibold">2x Pizza Calabresa</span>
                        <span className="font-black text-foreground">R$ 90,00</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-foreground font-semibold">1x Coca 2L</span>
                        <span className="font-black text-foreground">R$ 12,00</span>
                      </div>
                      <div className="border-t border-border pt-1.5 flex justify-between text-[11px]">
                        <span className="font-black text-foreground">Total</span>
                        <span className="font-black text-primary">R$ 102,00</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground">
                      <MapPin className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                      <span className="leading-tight font-medium">R. das Flores, 123<br />Centro · 2,4 km</span>
                    </div>
                    <button className="w-full bg-primary text-white text-[11px] font-black py-2.5 rounded-xl shadow-md mt-1">
                      Aceitar pedido
                    </button>
                  </div>
                </div>
              </div>

              {/* Floating chip "WhatsApp enviado" */}
              <div className="hidden sm:flex absolute -left-12 top-24 items-center gap-2 bg-card border border-emerald-500/20 rounded-2xl px-3 py-2 shadow-xl animate-bounce-subtle">
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-foreground leading-none">Cliente avisado</p>
                  <p className="text-[8px] text-emerald-600 font-bold mt-0.5">via WhatsApp ✓✓</p>
                </div>
              </div>

              {/* Floating chip "PIX caiu" */}
              <div className="hidden sm:flex absolute -right-10 bottom-20 items-center gap-2 bg-card border border-primary/20 rounded-2xl px-3 py-2 shadow-xl animate-bounce-subtle" style={{ animationDelay: "0.6s" }}>
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-foreground leading-none">+ R$ 102,00</p>
                  <p className="text-[8px] text-primary font-bold mt-0.5">PIX recebido</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ FAIXA DE PROVA SOCIAL — segmentos atendidos ══════ */}
      <section className="border-y border-border bg-muted/20 py-6 overflow-hidden">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground mb-4">
            Feito para o seu negócio
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-bold text-foreground/70">
            <span className="flex items-center gap-1.5">🍕 Pizzarias</span>
            <span className="flex items-center gap-1.5">🍔 Hamburguerias</span>
            <span className="flex items-center gap-1.5">🛒 Mercados</span>
            <span className="flex items-center gap-1.5">🍰 Docerias</span>
            <span className="flex items-center gap-1.5">🍺 Bares</span>
            <span className="flex items-center gap-1.5">💈 Serviços</span>
          </div>
        </div>
      </section>

      {/* ══════ ANTES vs DEPOIS — gatilho de contraste de status ══════ */}
      <section className="py-20 px-4 bg-background border-b border-border">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary mb-3">A diferença é gritante</p>
            <h2 className="text-3xl md:text-5xl font-black text-foreground leading-[1.05]">
              Sua rotina <span className="text-foreground/40">antes</span> e <span className="text-primary">depois</span> da ItaSuper
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* ANTES */}
            <div className="rounded-3xl border border-border bg-muted/30 p-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-6">
                <X className="h-3 w-3" /> Antes
              </div>
              <ul className="space-y-4">
                {[
                  "Anota pedido no papel e perde o endereço",
                  "Confere PIX um por um no extrato do banco",
                  "Perde venda porque não viu a mensagem",
                  "Cliente liga toda hora: 'já saiu?'",
                  "Não sabe quanto vendeu no fim do dia",
                  "Motoboy entrega no lugar errado",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-foreground/60">
                    <X className="h-5 w-5 text-foreground/40 shrink-0 mt-0.5" />
                    <span className="text-base line-through decoration-foreground/20 font-medium">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* DEPOIS */}
            <div className="rounded-3xl border-2 border-primary/30 bg-card p-7 shadow-xl shadow-primary/5 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary mb-6">
                <CheckCircle2 className="h-3 w-3" /> Depois
              </div>
              <ul className="relative space-y-4">
                {[
                  "Pedido chega pronto, com endereço completo",
                  "PIX cai na hora — você só confirma e prepara",
                  "Celular toca alto a cada novo pedido",
                  "WhatsApp avisa o cliente em cada etapa, sozinho",
                  "Relatório do dia numa tela: vendas, lucro e top produtos",
                  "Motoboy com mapa + código de confirmação",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <span className="text-base font-bold text-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Button
              size="lg"
              onClick={handleCTA}
              className="text-base md:text-lg px-8 py-4 min-h-[56px] rounded-2xl shadow-2xl shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 active:scale-[0.98] font-black"
            >
              <Store className="mr-2 h-5 w-5" />
              Quero o lado direito
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="mt-3 text-xs text-muted-foreground font-semibold">Grátis pra começar · Sem cartão · Cancele quando quiser</p>
          </div>
        </div>
      </section>

       {/* ══════ PAIN POINTS ══════ */}
       <section id="vantagens" className="py-24 px-4 bg-muted/30">
         <div className="mx-auto max-w-6xl">
           <div className="grid lg:grid-cols-2 gap-16 items-center">
             <div>
               <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6 leading-none">
                 Cansado de <br /> perder dinheiro?
               </h2>
               <p className="text-xl text-muted-foreground mb-8 font-medium">
                 O WhatsApp não foi feito para gerenciar delivery. O ItaSuper foi criado para resolver a bagunça da sua operação.
               </p>
               <div className="space-y-4">
                 {painPoints.map((item) => (
                   <div key={item.pain} className="group flex gap-5 items-center rounded-3xl border border-border bg-card p-6 hover:border-primary/30 transition-all">
                     <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-4xl shrink-0 group-hover:scale-110 transition-transform">
                       {item.emoji}
                     </div>
                     <div>
                       <p className="text-base text-foreground/60 line-through mb-1">{item.pain}</p>
                       <p className="text-lg font-bold text-foreground">{item.solution}</p>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
             <div className="relative">
               <div className="aspect-square bg-gradient-to-br from-primary to-orange-600 rounded-[3rem] p-1 shadow-2xl overflow-hidden group">
                 <div className="w-full h-full bg-card rounded-[2.8rem] flex items-center justify-center p-8 overflow-hidden">
                    <div className="relative w-full aspect-[9/16] max-w-[280px] bg-background border-[8px] border-muted rounded-[2.5rem] shadow-2xl overflow-hidden transform group-hover:scale-105 transition-transform duration-700">
                      {/* Notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-muted rounded-b-2xl z-10" />

                      {/* Header do app */}
                      <div className="bg-primary px-4 pt-8 pb-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                          <ShoppingBag className="text-white h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-white/70 leading-none">ItaSuper</p>
                          <p className="text-xs font-bold text-white leading-tight">Novo pedido!</p>
                        </div>
                        <div className="relative">
                          <Bell className="text-white h-4 w-4" />
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        </div>
                      </div>

                      {/* Card do pedido */}
                      <div className="p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-foreground">Pedido #1247</span>
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">PIX PAGO</span>
                        </div>

                        <div className="bg-muted/50 rounded-xl p-2.5 space-y-1.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-foreground font-medium">2x Pizza Calabresa</span>
                            <span className="font-bold text-foreground">R$ 90,00</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-foreground font-medium">1x Coca 2L</span>
                            <span className="font-bold text-foreground">R$ 12,00</span>
                          </div>
                          <div className="border-t border-border pt-1.5 flex justify-between text-[10px]">
                            <span className="font-bold text-foreground">Total</span>
                            <span className="font-black text-primary">R$ 102,00</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground">
                          <MapPin className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                          <span className="leading-tight">R. das Flores, 123<br/>Centro · 2,4 km</span>
                        </div>

                        <button className="w-full bg-primary text-white text-[10px] font-bold py-2 rounded-lg shadow-md">
                          Aceitar pedido
                        </button>
                      </div>
                    </div>
                 </div>
               </div>
             </div>
           </div>
         </div>
       </section>

       {/* ══════ MOTOBOY SYSTEM SECTION ══════ */}
       <section className="py-20 px-4 bg-gradient-to-br from-background via-primary/5 to-background text-foreground overflow-hidden relative border-t border-border">
         <div className="mx-auto max-w-6xl relative z-10">
           <div className="text-center mb-16">
             <div className="inline-flex items-center gap-2 rounded-full bg-primary/20 border border-primary/30 px-4 py-1.5 text-xs font-bold text-primary mb-2">
               <Truck className="h-4 w-4" /> LOGÍSTICA INTEGRADA
             </div>
             <h2 className="text-3xl font-bold tracking-tight mb-2">
               Sistema de Motoboy <span className="text-primary italic">Integrado</span> 🛵
             </h2>
             <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-4">
               Disponível nos planos Crescimento, Apoiadores e Essencial
             </div>
             <p className="text-muted-foreground max-w-2xl mx-auto text-base font-medium">
               Sua logística sob controle absoluto. Da cozinha à porta do cliente, tudo conectado em tempo real para uma operação sem falhas.
             </p>
           </div>
 
           <div className="grid lg:grid-cols-2 gap-16 items-center">
             <div className="space-y-6">
               {motoboyWorkflow.map((item, i) => (
                 <div key={i} className="flex gap-5 p-6 rounded-[2rem] bg-card border border-border hover:shadow-md transition-all group">
                   <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                     <item.icon className={`h-7 w-7 ${item.iconColor}`} />
                   </div>
                   <div>
                     <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                     <p className="text-muted-foreground leading-relaxed text-base font-medium">{item.desc}</p>
                   </div>
                 </div>
               ))}
             </div>
 
             <div className="relative">
               <div className="aspect-[4/5] bg-gradient-to-br from-primary/20 to-orange-600/20 rounded-[3rem] border border-white/10 p-5 relative shadow-2xl">
                 {/* Mock UI for Driver App */}
                 <div className="w-full h-full bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col border border-white/5">
                   <div className="p-5 border-b border-white/10 bg-slate-900 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                         <Truck className="h-5 w-5 text-primary" />
                       </div>
                       <div>
                         <span className="font-bold text-sm block">App do Motoboy</span>
                         <span className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                           <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> ONLINE
                         </span>
                       </div>
                     </div>
                     <Bell className="h-5 w-5 text-slate-500" />
                   </div>
                   <div className="flex-1 p-6 space-y-6">
                     <div className="p-5 rounded-2xl bg-primary/10 border border-primary/20 animate-bounce-slow shadow-lg shadow-primary/5">
                       <div className="flex items-center justify-between mb-3">
                         <span className="text-[10px] uppercase font-black text-primary tracking-wider">Novo Pedido Disponível!</span>
                         <Zap className="h-4 w-4 text-primary fill-primary" />
                       </div>
                       <p className="font-black text-xl mb-1">#1024 - R$ 45,90</p>
                       <p className="text-xs text-slate-400 font-medium">Rua das Flores, 123 • 1.2km</p>
                     </div>
                     <div className="h-40 w-full bg-slate-800 rounded-2xl relative overflow-hidden group/map">
                       {/* Mini Map representation */}
                       <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover/map:scale-110 transition-transform duration-1000">
                         <Navigation className="h-16 w-16 text-primary rotate-45" />
                       </div>
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-primary rounded-full shadow-[0_0_20px_rgba(255,107,0,0.6)] border-2 border-white z-10" />
                       <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-blue-500 rounded-full border-2 border-white opacity-60" />
                     </div>
                     <div className="space-y-3">
                       <div className="h-2.5 w-3/4 bg-slate-800 rounded-full" />
                       <div className="h-2.5 w-1/2 bg-slate-800 rounded-full opacity-50" />
                     </div>
                   </div>
                   <div className="p-6 mt-auto">
                     <div className="w-full py-4 bg-primary rounded-2xl text-center font-black text-sm text-black shadow-lg shadow-primary/20">
                       ACEITAR ENTREGA
                     </div>
                   </div>
                 </div>
                 
                 {/* Floating badge */}
                 <div className="absolute -bottom-8 -right-8 bg-white text-slate-950 p-5 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-float border border-slate-100 max-w-[240px]">
                   <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                     <UserCheck className="h-6 w-6 text-green-600" />
                   </div>
                   <div>
                     <p className="text-[11px] font-black leading-tight text-slate-900">Motoboy acaba de aceitar o pedido!</p>
                     <p className="text-[9px] font-bold text-green-600 mt-0.5">RASTREAMENTO ATIVO</p>
                   </div>
                 </div>
               </div>
             </div>
           </div>
         </div>
       </section>
 
       {/* ══════ HOW IT WORKS ══════ */}
       <section id="como-funciona" className="py-24 px-4 bg-background border-t border-border">
         <div className="mx-auto max-w-6xl">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-5xl font-black text-foreground mb-4">
               Comece a vender hoje 🚀
             </h2>
             <p className="text-muted-foreground text-lg max-w-xl mx-auto font-medium">
               Do cadastro ao primeiro pedido em menos de 10 minutos. É simples e rápido.
             </p>
           </div>
           <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
             {steps.map((s, i) => (
               <div key={s.step} className="relative text-center group">
                 {i < 3 && <div className="hidden lg:block absolute top-10 left-[70%] w-[60%] h-[2px] bg-gradient-to-r from-primary/30 to-transparent" />}
                 <div className="relative mx-auto w-20 h-20 rounded-[2rem] bg-gradient-to-br from-primary to-orange-600 text-white flex items-center justify-center text-2xl font-black mb-8 shadow-2xl shadow-primary/20 group-hover:rotate-12 transition-all duration-300">
                   {s.step}
                 </div>
                 <h3 className="text-xl font-bold text-foreground mb-3">{s.title}</h3>
                 <p className="text-muted-foreground leading-relaxed font-medium">{s.desc}</p>
               </div>
             ))}
           </div>
         </div>
       </section>

      {/* ══════ FEATURES GRID ══════ */}
      <section className="py-24 md:py-32 px-4 bg-muted/20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary mb-3">Tudo incluso</p>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight text-foreground mb-4 leading-[0.95]">
              Tudo que seu <br className="md:hidden" />
              delivery precisa
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto font-medium">
              Do pedido online ao caixa presencial. Sem upgrades escondidos.
            </p>
          </div>

          {/* Bento grid assimétrico — 1 hero + médios + pequenos */}
          <div className="grid grid-cols-6 gap-4 md:gap-5 auto-rows-[minmax(160px,auto)]">
            {features.map((f, i) => {
              // Padrão bento: hero card (2x grande), 4 médios, 3 pequenos
              const layouts = [
                "col-span-6 md:col-span-4 md:row-span-2 bg-gradient-to-br from-primary/10 via-card to-card border-primary/20", // 0 hero
                "col-span-6 md:col-span-2", // 1
                "col-span-3 md:col-span-2", // 2
                "col-span-3 md:col-span-2 md:row-span-2", // 3 tall
                "col-span-6 md:col-span-4", // 4 wide
                "col-span-3 md:col-span-2", // 5
                "col-span-3 md:col-span-2", // 6
                "col-span-6 md:col-span-2", // 7
                "col-span-6 md:col-span-2", // 8
              ];
              const isHero = i === 0;
              return (
                <div
                  key={f.title}
                  className={`group relative rounded-3xl border border-border bg-card p-5 md:p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 ${layouts[i] ?? "col-span-3 md:col-span-2"}`}
                >
                  {/* Sutil gradient border on hover */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  <div className="relative flex flex-col h-full">
                    <div
                      className={`rounded-2xl bg-primary/10 flex items-center justify-center mb-4 ${
                        isHero ? "w-16 h-16" : "w-12 h-12"
                      }`}
                    >
                      <f.icon className={`text-primary ${isHero ? "h-8 w-8" : "h-6 w-6"}`} />
                    </div>
                    <h3
                      className={`font-black text-foreground mb-2 tracking-tight ${
                        isHero ? "text-2xl md:text-3xl leading-tight" : "text-base md:text-lg"
                      }`}
                    >
                      {f.title}
                    </h3>
                    <p className={`text-foreground/70 leading-relaxed font-medium ${isHero ? "text-base md:text-lg" : "text-sm"}`}>
                      {f.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

       {/* ══════ VALUE GUARANTEES (replaces fake stats) ══════ */}
       <section className="py-24 px-4 bg-muted/20 border-y border-border">
         <div className="mx-auto max-w-6xl">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-5xl font-black text-foreground mb-4">
               Por que escolher a ItaSuper? 🚀
             </h2>
             <p className="text-muted-foreground text-lg max-w-xl mx-auto font-medium">
               Não inventamos números. Mostramos o que realmente entregamos a você para o seu negócio crescer.
             </p>
           </div>
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
             {[
               { icon: DollarSign, value: "Até 0%", label: "Comissão", desc: "Fique com o lucro total das suas vendas nos planos pagos." },
               { icon: Clock, value: "10 min", label: "Configuração", desc: "Seu cardápio digital pronto para vender no mesmo dia." },
               { icon: ShieldCheck, value: "Sem Fidelidade", label: "Liberdade", desc: "Cancele quando quiser, sem multas ou taxas escondidas." },
               { icon: Globe, value: "Brasil Todo", label: "Abrangência", desc: "Nossa tecnologia funciona em qualquer cidade do país." },
             ].map((s) => (
               <div key={s.label} className="flex flex-col items-center text-center group">
                 <div className="w-20 h-20 rounded-[2rem] bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                   <s.icon className="h-10 w-10 text-primary" />
                 </div>
                 <p className="text-4xl font-black text-primary leading-tight mb-2">{s.value}</p>
                 <p className="text-xl font-bold text-foreground mb-2">{s.label}</p>
                 <p className="text-sm text-muted-foreground leading-relaxed font-medium">{s.desc}</p>
               </div>
             ))}
           </div>
         </div>
       </section>

      {/* ══════ PLANS ══════ */}

      {/* ══════ WHATSAPP AUTOMÁTICO ══════ */}
      <section className="py-20 px-4 bg-gradient-to-br from-emerald-500/5 via-background to-emerald-500/10 border-y border-border">
        <div className="mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-600 mb-6 border border-emerald-500/20">
                <MessageCircle className="h-4 w-4" />
                Novo • WhatsApp Automático
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6 leading-none">
                Seu cliente avisado <br />
                <span className="text-emerald-600">no WhatsApp.</span> Sozinho.
              </h2>
              <p className="text-xl text-muted-foreground mb-8 font-medium">
                A cada etapa do pedido, o cliente recebe uma mensagem no WhatsApp. Você não digita nada, não responde "tá pronto?" mais.
              </p>
              <div className="space-y-3">
                {[
                  { emoji: "✅", title: "Pedido recebido", desc: "Confirmação na hora, com resumo e valor." },
                  { emoji: "🍳", title: "Em preparo", desc: "Cliente sabe que a cozinha já começou." },
                  { emoji: "🛵", title: "Saiu pra entrega", desc: "Avisa quando o motoboy pegou o pedido." },
                  { emoji: "📦", title: "Entregue", desc: "Encerra com agradecimento e pedido de avaliação." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3 items-start rounded-2xl border border-border bg-card p-5 hover:border-emerald-500/30 transition-colors">
                    <span className="text-3xl shrink-0">{item.emoji}</span>
                    <div>
                      <p className="text-base font-bold text-foreground">{item.title}</p>
                      <p className="text-sm text-foreground/70 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-card border border-emerald-500/20 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground">Sua Loja</p>
                    <p className="text-[10px] text-emerald-600 font-bold">● online no WhatsApp</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[
                    { t: "✅ Pedido #1247 recebido! Total R$ 102,00 via PIX.", h: "14:02" },
                    { t: "🍳 Seu pedido está sendo preparado.", h: "14:08" },
                    { t: "🛵 Saiu pra entrega! Motoboy a caminho.", h: "14:24" },
                    { t: "📦 Pedido entregue! Obrigado pela preferência 💚", h: "14:41" },
                  ].map((m, i) => (
                    <div key={i} className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl rounded-tl-sm p-3">
                      <p className="text-xs text-foreground font-medium leading-relaxed">{m.t}</p>
                      <p className="text-[9px] text-muted-foreground text-right mt-1">{m.h} ✓✓</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ PDV — DESTAQUE ══════ */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-500/5 via-background to-primary/5 border-y border-border">
        <div className="mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-600 mb-6 border border-blue-500/20">
                <Store className="h-4 w-4" />
                Módulo PDV — Caixa Presencial
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6 leading-none">
                Delivery e balcão <br />
                <span className="text-primary">num só sistema.</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8 font-medium">
                Registre vendas presenciais com caixa digital completo. Sem mensalidade extra, incluso em todos os planos.
              </p>
              <div className="space-y-3">
                {[
                  { icon: "🖥️", title: "Abertura e fechamento de turno", desc: "Controle quem abriu, quando fechou e o saldo do caixa." },
                  { icon: "💵", title: "Cálculo de troco automático", desc: "Digite o valor recebido e o troco aparece na tela. Sem erro." },
                  { icon: "📊", title: "Relatório separado por canal", desc: "Veja o que veio de delivery e o que veio do balcão, separados." },
                  { icon: "💳", title: "Sem taxa PIX na maquininha", desc: "Use sua maquininha própria. A plataforma não cobra R$ 1,99 nesse canal." },
                ].map((item) => (
                   <div key={item.title} className="flex gap-3 items-start rounded-2xl border border-border bg-card p-5 hover:border-blue-500/20 transition-colors">
                     <span className="text-3xl shrink-0">{item.icon}</span>
                     <div>
                       <p className="text-base font-bold text-foreground">{item.title}</p>
                       <p className="text-sm text-foreground/70 mt-1 leading-relaxed">{item.desc}</p>
                     </div>
                   </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-blue-500/20 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">PDV · Turno aberto</p>
                  <p className="text-sm font-black text-foreground mt-0.5">Minha Loja</p>
                </div>
                <div className="bg-emerald-500/10 text-emerald-600 text-xs font-black px-3 py-1.5 rounded-full border border-emerald-500/20">● Aberto</div>
              </div>
              <div className="space-y-2">
                {[
                  { name: "X-Burguer Duplo", qty: "2x", price: "R$ 44,00", method: "💳" },
                  { name: "Frango Grelhado", qty: "1x", price: "R$ 28,50", method: "💵" },
                  { name: "Combo Família", qty: "1x", price: "R$ 89,90", method: "📱" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center gap-3 bg-muted/30 rounded-xl p-3">
                    <span className="text-xs font-black text-primary bg-primary/10 w-7 h-7 rounded-lg flex items-center justify-center">{item.qty}</span>
                    <p className="flex-1 text-xs font-semibold text-foreground truncate">{item.name}</p>
                    <span className="text-sm">{item.method}</span>
                    <p className="text-xs font-black text-foreground">{item.price}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="text-sm font-bold">Total do turno</span>
                <span className="text-xl font-black text-primary">R$ 162,40</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Comissão PDV</p>
                  <p className="text-base font-black text-foreground">R$ 0,00</p>
                  <p className="text-[9px] text-emerald-600 font-bold">Plano Essencial</p>
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Seu lucro</p>
                  <p className="text-base font-black text-primary">R$ 162,40</p>
                  <p className="text-[9px] text-muted-foreground">100% pra você</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="planos" className="py-20 px-4">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold tracking-tight text-center text-foreground mb-4">
            Escolha o plano ideal para sua loja
          </h2>
          <p className="text-center text-muted-foreground mb-4 max-w-2xl mx-auto text-base font-medium">
             Comissão a partir de <span className="font-bold text-primary">6%</span> — ou <span className="font-bold text-primary">zero</span> nos planos Apoiador e Essencial.
            Todos incluem cardápio completo, PIX online e notificações. Taxa PIX R$ 1,99/transação apenas nos planos Essencial e Apoiador.
          </p>
          <div className="flex justify-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600 border border-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              🎁 Plano Comissão grátis para sempre! Planos pagos com 7 dias grátis. Módulo PDV incluso em todos.
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const badgeText = plan.id === "supporter" && supporterTaken !== null
                ? `🚀 Lançamento • ${Math.max(0, 10 - supporterTaken)} vagas`
                : plan.badge;

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col rounded-[2.5rem] overflow-visible transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 border-2 h-full ${
                    plan.highlight
                      ? "border-primary shadow-2xl shadow-primary/10 scale-105 z-10"
                      : "border-border shadow-lg"
                  }`}
                >
                  {badgeText && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-lg z-20">
                      {badgeText}
                    </div>
                  )}
                  <CardContent className="p-8 flex flex-col flex-1 h-full">
                    <div className="flex items-center gap-4 mb-8">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${plan.color} text-white shadow-lg`}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-foreground">{plan.name}</h3>
                        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-tight">{plan.tagline}</p>
                      </div>
                    </div>

                    <div className="mb-8 p-6 rounded-3xl bg-muted/30 border border-border/50">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-muted-foreground leading-none">R$</span>
                        <span className="text-5xl font-black text-foreground leading-none tracking-tighter">{plan.price}</span>
                        <span className="text-sm font-bold text-muted-foreground">{plan.period}</span>
                      </div>
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <BadgePercent className="h-4 w-4 text-primary" />
                          <span className="text-sm font-black text-foreground">{plan.commission}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium ml-6">{plan.commissionLabel}</p>
                      </div>
                    </div>

                    {plan.id === "supporter" && supporterTaken !== null && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase mb-1">
                          <span className="text-primary">{supporterTaken}/10 preenchidas</span>
                          <span className="text-muted-foreground">{Math.max(0, 10 - supporterTaken)} restam</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-1000"
                            style={{ width: `${Math.min(100, (supporterTaken / 10) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground mb-8 font-medium leading-relaxed">{plan.description}</p>

                    <ul className="space-y-4 mb-10">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm font-bold text-foreground/80 group">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-white transition-colors">
                            <Check className="h-3 w-3" />
                          </div>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto space-y-4">
                      <Button
                        onClick={handleCTA}
                        className={`w-full min-h-[52px] py-4 rounded-2xl text-base font-black transition-all ${
                          plan.highlight
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40"
                            : "bg-foreground text-background hover:bg-foreground/90"
                        }`}
                      >
                        {plan.id === "commission_only" ? "Começar grátis" : "Testar grátis"}
                      </Button>

                      {plan.extraFees && plan.extraFees.length > 0 && (
                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-2">
                          {plan.extraFees.map((fee, i) => (
                            <div key={i} className="flex justify-between items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">{fee.label}</span>
                              <span className="text-[10px] font-black text-primary">{fee.value}</span>
                            </div>
                          ))}
                          {(plan as any).extraNote && (
                            <p className="text-[9px] italic text-muted-foreground/80 mt-1 leading-tight flex items-start gap-1">
                              <Info className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                              {(plan as any).extraNote}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

       {/* ══════ BENEFITS BY SEGMENT ══════ */}
       <section className="py-24 px-4 bg-muted/30">
         <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">
                Feito para o seu negócio 🚀
              </h2>
              <p className="text-muted-foreground text-base max-w-xl mx-auto font-medium">
                Seja qual for o seu segmento, a ItaSuper se adapta perfeitamente à sua rotina.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-start justify-items-center">
              {benefits.map((b) => (
                <Card key={b.segment} className="rounded-[2.5rem] border-none bg-card p-4 hover:shadow-2xl transition-all duration-300">
                  <CardContent className="pt-6">
                    <div className="text-5xl mb-6">{b.icon}</div>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-[0.2em] mb-4">{b.segment}</p>
                    <h3 className="text-lg font-semibold text-foreground mb-4 leading-tight">{b.headline}</h3>
                    <p className="text-muted-foreground leading-relaxed font-medium text-base">{b.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

           {/* Trust strip */}
           <div className="mt-12 grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="text-center rounded-2xl border border-border bg-card p-5">
              <ShieldCheck className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">Sem comissão nos principais planos</p>
              <p className="text-xs text-muted-foreground mt-1">Fique com 100% do valor dos seus produtos</p>
            </div>
             <div className="text-center rounded-2xl border border-border bg-card p-5">
               <Zap className="h-5 w-5 text-primary mx-auto mb-2" />
               <p className="text-sm font-bold text-foreground">Pronto em 10 minutos</p>
               <p className="text-xs text-muted-foreground mt-1">Do cadastro ao cardápio publicado no mesmo dia</p>
             </div>
             <div className="text-center rounded-2xl border border-border bg-card p-5">
               <Globe className="h-5 w-5 text-primary mx-auto mb-2" />
               <p className="text-sm font-bold text-foreground">Funciona em todo o Brasil</p>
               <p className="text-xs text-muted-foreground mt-1">Cardápio digital acessível por link ou QR Code</p>
             </div>
           </div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-center text-foreground mb-4">
            Perguntas frequentes
          </h2>
          <p className="text-center text-muted-foreground mb-12 text-base font-medium">
            Tire suas dúvidas antes de começar.
          </p>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-panel-${i}`}
                  className="w-full flex items-center justify-between p-6 text-left min-h-[60px]"
                >
                  <span className="font-bold text-foreground text-lg pr-4">{faq.q}</span>
                  <ChevronDown className={`h-6 w-6 text-foreground/70 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div id={`faq-panel-${i}`} role="region" className="px-6 pb-6 text-base text-foreground/80 leading-relaxed animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ GUARANTEE ══════ */}
      <section className="py-14 px-4 bg-muted/30 border-y border-border">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground mb-3">
            Sem risco. Sem surpresas.
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed text-base font-medium">
            Comece pelo plano Comissão (grátis) e migre quando quiser.
            Sem fidelidade, sem multa, sem pegadinha. Cancele a qualquer momento.
          </p>
        </div>
      </section>

      {/* ══════ FINAL CTA ══════ */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/20 pointer-events-none" />
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">
            Delivery e balcão num só lugar
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed text-base font-medium">
            Cardápio digital, PIX automático, gestão de motoboys e caixa PDV presencial.
            Tudo pronto em menos de 5 minutos.
            <span className="block mt-1 font-semibold text-primary">Comece grátis — sem cartão de crédito.</span>
          </p>
           <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
             <Button size="lg" onClick={handleCTA} className="text-base px-8 py-4 min-h-[56px] rounded-2xl shadow-lg shadow-primary/20 w-full sm:w-auto">
               Criar minha loja grátis <ArrowRight className="ml-2 h-5 w-5" />
             </Button>
             <Button size="lg" variant="outline" onClick={handleWhatsApp} className="text-base px-8 py-4 min-h-[56px] rounded-2xl w-full sm:w-auto">
               <MessageCircle className="mr-2 h-5 w-5" /> Falar no WhatsApp
             </Button>
           </div>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-12 bg-card border-t border-border px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-black text-foreground tracking-tight">ItaSuper</span>
          </div>

          <div className="flex flex-col items-center md:items-end gap-3">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
              <button onClick={() => navigate("/portal-parceiro")} className="hover:text-primary transition-colors">Login Parceiro</button>
              <button onClick={() => navigate("/cadastro-lojista")} className="hover:text-primary transition-colors">Cadastro Lojista</button>
              <button onClick={() => navigate("/termos-de-uso")} className="hover:text-primary transition-colors">Termos de Uso</button>
              <button onClick={() => navigate("/politica-de-privacidade")} className="hover:text-primary transition-colors">Política de Privacidade</button>
            </div>
            <p className="text-[11px] text-muted-foreground/60 font-medium uppercase tracking-widest">
              © {new Date().getFullYear()} ItaSuper — Todos os direitos reservados
            </p>
          </div>
        </div>
      </footer>
      <div className="py-6 border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 flex justify-center">
          <AsaasBadgeBar className="max-w-sm" />
        </div>
      </div>
      <StickyMobileCTA onClick={handleCTA} />
    </div>
  );
};

export default StoreDirectory;
