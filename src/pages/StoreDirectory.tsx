import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PartnerClientView from "@/components/PartnerClientView";
import {
  Zap, Store, ShieldCheck, Smartphone, TrendingUp,
  ArrowRight, CheckCircle2, Star, MapPin, Clock, CreditCard,
  BarChart3, MessageSquare, Tag, Package,
  Menu, X, DollarSign, Globe, Rocket,
  Award, Sparkles, ChevronDown,
  ShoppingBag, Truck, Crown, BadgePercent,
   Bell, QrCode, Utensils, Gift, MessageCircle, Shield, Check,
    Navigation, UserCheck, SmartphoneNfc, Info,
  } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/* ─── hooks ─── */

/* ─── static data ─── */
 const painPoints = [
   { emoji: "📸", pain: "Manda foto do cardápio pelo WhatsApp", solution: "Cardápio digital profissional com fotos HD e preços sempre atualizados" },
   { emoji: "📝", pain: "Anota pedido na mão e erra o endereço", solution: "Pedidos organizados automaticamente com endereço via GPS integrado" },
   { emoji: "💸", pain: "Confere PIX no extrato manual um por um", solution: "Pagamento PIX confirmado instantaneamente pelo sistema" },
   { emoji: "🔇", pain: "Perde pedidos por não ver as mensagens", solution: "Alertas sonoros e notificações push para você nunca perder uma venda" },
 ];

const steps = [
   { step: "01", title: "Cadastre sua loja", desc: "Crie sua conta em minutos e escolha o plano ideal para seu momento." },
   { step: "02", title: "Monte seu cardápio", desc: "Adicione seus produtos, fotos e preços de forma simples e rápida." },
   { step: "03", title: "Divulgue seu link", desc: "Compartilhe seu link exclusivo no WhatsApp, Instagram e use QR Codes." },
   { step: "04", title: "Venda muito mais!", desc: "Receba pedidos organizados, pagamentos automáticos e gerencie entregas." },
 ];
 
 /* ─── Motoboy Data ─── */
 const motoboyWorkflow = [
   { 
     icon: Bell, 
     title: "Notificação Sonora", 
     desc: "Assim que você marca o pedido como pronto, o app do motoboy apita instantaneamente avisando que há uma entrega disponível.",
     color: "bg-blue-500/10",
     iconColor: "text-blue-500"
   },
   { 
     icon: MapPin, 
     title: "Rastreamento GPS", 
     desc: "O cliente acompanha o motoboy em tempo real no mapa. Menos ansiedade para o cliente, menos mensagens no seu WhatsApp.",
     color: "bg-green-500/10",
     iconColor: "text-green-500"
   },
   { 
     icon: Smartphone, 
     title: "Confirmação por PIN", 
     desc: "Segurança total: a entrega só é finalizada quando o motoboy digita o código PIN que está no celular do cliente.",
     color: "bg-orange-500/10",
     iconColor: "text-orange-500"
   },
   { 
     icon: BarChart3, 
     title: "Acerto Financeiro", 
     desc: "Relatórios automáticos de quanto cada motoboy entregou e quanto ele deve prestar contas no final do turno.",
     color: "bg-purple-500/10",
     iconColor: "text-purple-500"
   },
 ];
 
 const features = [
  { icon: Smartphone, title: "Cardápio Digital", desc: "Link profissional com fotos em alta definição. Seus clientes pedem pelo celular sem instalar nada." },
  { icon: CreditCard, title: "PIX Automático", desc: "QR Code gerado na hora. Confirmação instantânea no seu painel — sem conferir extrato." },
  { icon: Truck, title: "Gestão de Motoboys", desc: "Alerta sonoro para o entregador, rastreamento em tempo real e código PIN de confirmação." },
  { icon: BarChart3, title: "Relatórios Completos", desc: "Vendas por dia, produtos mais pedidos, ticket médio e financeiro completo — delivery e PDV separados." },
  { icon: Bell, title: "Notificações em Tempo Real", desc: "Push no celular para novos pedidos. Nunca mais perde um pedido por falta de alerta." },
  { icon: Package, title: "Impressão de Comandas", desc: "Imprima pedidos automaticamente na cozinha. Organize a produção sem confusão." },
  { icon: ShieldCheck, title: "Segurança Total", desc: "Dados criptografados, controle de acesso por perfil (lojista/motoboy/cliente) e pagamentos via Asaas." },
  { icon: Store, title: "PDV — Caixa Presencial", desc: "Venda no balcão com caixa digital, controle de troco, sangria/suprimento e relatório de turno. Sem taxa PIX." },
];

const plans = [
  {
    id: "commission_only",
    name: "Comissão",
    tagline: "Comece sem investir nada",
    price: "0",
    period: "/mês",
    icon: Rocket,
    highlight: false,
    badge: null,
     commission: "6% + R$ 2",
    commissionLabel: "por entrega (pago pelo cliente)",
    color: "from-emerald-500 to-emerald-600",
    lightBg: "bg-emerald-50",
    textColor: "text-emerald-600",
    borderColor: "border-emerald-200",
      description: "Ideal para quem está começando e quer testar sem risco. Pague apenas uma comissão de 6% sobre o que vender.",
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
    extraFees: [],
  },
  {
    id: "hybrid",
    name: "Crescimento",
    tagline: "Comissão menor, mais recursos",
    price: "100",
    period: "/mês",
    icon: TrendingUp,
    highlight: false,
    badge: null,
    commission: "2,5% + R$ 2",
    commissionLabel: "por entrega (pago pelo cliente)",
    color: "from-blue-500 to-blue-600",
    lightBg: "bg-blue-50",
    textColor: "text-blue-600",
    borderColor: "border-blue-200",
     description: "Para lojas em expansão que buscam reduzir custos de comissão e ter mais controle profissional.",
    features: [
      "Tudo do plano Comissão",
      "Comissão reduzida para 2,5%",
      "PDV — Caixa presencial (1% comissão)",
      "Banners ilimitados na loja",
      "Agendamento de pedidos",
      "Destaque na vitrine",
      "Programa de fidelidade",
      "Suporte prioritário",
    ],
    extraFees: [],
  },
  {
    id: "supporter",
    name: "Apoiadores",
    tagline: "Edição de lançamento • Vagas limitadas",
    price: "130",
    period: "/mês",
    icon: Sparkles,
    highlight: false,
    badge: "🚀 Lançamento • 10 vagas",
    commission: "R$ 1,99",
    commissionLabel: "taxa pix",
    color: "from-violet-500 to-purple-600",
    lightBg: "bg-accent",
    textColor: "text-primary",
    borderColor: "border-primary/30",
     description: "Edição histórica de lançamento. Mesmos benefícios do Essencial com valor reduzido vitalício para os primeiros.",
    features: [
      "Tudo do plano Essencial",
      "Zero comissão delivery (0%)",
      "PDV — Caixa presencial (0% comissão)",
      "Valor mensal fixo vitalício",
      "Selo exclusivo de Apoiador",
      "Acesso antecipado a novidades",
      "Apenas 10 vagas disponíveis",
    ],
    extraFees: [
       { label: "Taxa PIX", value: "R$ 1,99/transação" },
        { label: "Taxa Entrega", value: "R$ 2,00 (pago pelo cliente somado à sua taxa)" },
    ],
    extraNote: "A taxa de entrega é somada à definida por você. Ex: Você define R$ 3,00, o cliente paga R$ 5,00 (R$ 3 seu + R$ 2 plataforma).",
  },
  {
    id: "fixed",
    name: "Essencial",
    tagline: "Lucro máximo em cada pedido",
    price: "180",
    period: "/mês",
    icon: Crown,
    highlight: true,
    badge: "⭐ Mais escolhido",
    commission: "R$ 1,99",
    commissionLabel: "taxa pix",
    color: "from-primary to-orange-600",
    lightBg: "bg-accent",
    textColor: "text-primary",
    borderColor: "border-primary/30",
     description: "Fique com 100% do valor dos seus produtos. Gestão total e integração logística inteligente.",
    features: [
      "Todas as ferramentas inclusas",
      "Zero comissão por venda (0%)",
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
    extraNote: "A taxa de entrega é somada à definida por você. Ex: Você define R$ 3,00, o cliente paga R$ 5,00 (R$ 3 seu + R$ 2 plataforma).",
  },
];

const benefits = [
  {
    icon: "🍕",
    segment: "Pizzarias & Hamburguerias",
    headline: "Chega de erros nos pedidos",
    text: "Bordas recheadas, adicionais e pizzas meio-a-meio organizadas automaticamente. Comanda impressa direto na cozinha.",
  },
  {
    icon: "🛒",
    segment: "Mercados & Adegas",
    headline: "Cardápio com centenas de itens",
    text: "Cadastre produtos rapidamente por categoria. Clientes pedem pelo link sem precisar ligar ou mandar mensagem.",
  },
  {
    icon: "🍰",
    segment: "Docerias & Padarias",
    headline: "Agendamento inteligente",
    text: "Clientes agendam a retirada ou entrega com antecedência. Organize sua produção do dia sem caos no WhatsApp.",
  },
  {
    icon: "🍺",
    segment: "Bares & Restaurantes",
    headline: "Delivery + Balcão no mesmo sistema",
    text: "Receba pedidos online e use o PDV para registrar vendas presenciais. Caixa único, relatório unificado.",
  },
  {
    icon: "💈",
    segment: "Lojas & Serviços",
    headline: "Venda sem delivery",
    text: "Use o cardápio digital como vitrine de produtos e o PDV para vendas no balcão. Sem precisar de motoboy.",
  },
];

const faqs = [
  { q: "Preciso baixar algum aplicativo?", a: "Não! Você gerencia tudo pelo navegador do celular ou computador. Seus clientes pedem pelo link da loja, sem instalar nada." },
  { q: "Como funciona o PIX automático?", a: "Quando o cliente escolhe PIX, geramos um QR Code automaticamente. A confirmação é instantânea no seu painel — sem conferir extrato." },
  { q: "O plano Essencial cobra comissão?", a: "Não! Zero comissão sobre as vendas. Há apenas R$ 1,99 por transação PIX online (descontado automaticamente do repasse) e R$ 2,00 por entrega, somado à sua taxa — pago pelo cliente no checkout. Nos planos Crescimento e Comissão não há cobrança de R$ 1,99 de PIX: a comissão percentual já cobre esses custos." },
  { q: "O que é o módulo PDV?", a: "É um caixa registradora digital integrado ao sistema. Você abre e fecha turnos, registra vendas no balcão com maquininha própria (sem taxa PIX), calcula troco automaticamente e acompanha relatórios separados de delivery e presencial. Incluso em todos os planos." },
  { q: "Posso usar sem motoboy próprio?", a: "Sim! No modo cardápio digital, você recebe os pedidos e usa sua própria equipe de entrega. A plataforma funciona em todo o Brasil mesmo sem usar a logística da plataforma." },
  { q: "Como recebo os pedidos?", a: "Notificação sonora e push no celular em tempo real. O painel organiza os pedidos por status: pendente, preparando, saiu para entrega e finalizado." },
  { q: "Funciona na minha cidade?", a: "Sim! Atendemos lojistas em todo o Brasil — capitais, cidades do interior e municípios pequenos. A plataforma foi desenvolvida justamente para quem não tem acesso aos grandes marketplaces." },
  { q: "Posso trocar de plano?", a: "Sim, a qualquer momento. Basta solicitar pelo painel e o administrador realiza a migração. Nenhuma penalidade e sem perder o histórico de pedidos." },
  { q: "Quanto economizo em relação aos grandes apps?", a: "Os grandes marketplaces cobram entre 12% e 30% por pedido, além de cobranças por destaque e publicidade. No ItaSuper você paga 6% (plano Comissão) ou 0% (planos pagos), com taxas fixas e transparentes." },
  { q: "Tem contrato ou fidelidade?", a: "Não. Cancele quando quiser, sem multa e sem fidelidade mínima." },
];

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
    <nav className={`sticky top-0 z-50 border-b border-border backdrop-blur-md transition-all duration-300 bg-background/95 ${scrolled ? "shadow-md" : ""}`}>
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
        <button onClick={() => scrollTo("#hero")} className="flex items-center gap-2" aria-label="Ir para o início">
          <img
            src="/itasuper-logo-horizontal.webp"
            alt="ItaSuper"
            width={240}
            height={68}
            decoding="async"
            fetchPriority="high"
            className="h-14 md:h-16 w-auto object-contain"
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
              <Button variant="outline" className="rounded-full font-bold text-sm px-5" onClick={() => onNavigate("/auth")}>
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
              className="rounded-full font-bold text-xs px-4 h-9"
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
            <Button className="w-full rounded-full font-bold mt-2 gap-2" onClick={() => { setOpen(false); onNavigate("/pedidos"); }}>
              <ShoppingBag className="h-4 w-4" /> Meus Pedidos
            </Button>
          ) : (
            <>
              <button onClick={() => { setOpen(false); onNavigate("/portal-parceiro"); }} className="block w-full text-left py-3 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">
                Já sou parceiro
              </button>
              <Button className="w-full rounded-full font-bold mt-2" onClick={() => { setOpen(false); onNavigate("/cadastro-lojista"); }}>
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

  // No fake stats — we use honest value props instead


  const handleCTA = () => navigate("/cadastro-lojista");
  const handleWhatsApp = () =>
    window.open("https://wa.me/5514991624997?text=Olá! Tenho interesse em cadastrar minha loja na plataforma.", "_blank");

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
      <Navbar onNavigate={navigate} isLoggedIn={!!user} />

      {/* ══════ HERO ══════ */}
       <section id="hero" className="relative py-24 md:py-32 px-4 overflow-hidden border-b border-border">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_50%),radial-gradient(circle_at_bottom_left,hsl(var(--accent)/0.3),transparent_50%)] pointer-events-none" />
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-primary/[0.03] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary mb-8 animate-fade-in">
            <Globe className="h-4 w-4" />
            Plataforma disponível para todo o Brasil 🇧🇷
          </div>

           <h1 className="text-6xl lg:text-8xl font-black tracking-tight text-foreground leading-[0.9] mb-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
             Delivery e balcão <br className="hidden md:block" />
             com total <span className="text-primary relative inline-block">liberdade<span className="absolute -bottom-2 left-0 w-full h-3 bg-primary/20 -z-10 rounded-full" /></span>.
           </h1>

           <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
             Cardápio digital, <span className="text-foreground font-bold">PIX automático</span>, gestão de motoboys e <span className="text-foreground font-bold">caixa presencial (PDV)</span>. Delivery e balcão num só sistema — sem pagar comissão para os grandes apps.
          </p>

           <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in zoom-in-95 duration-1000 delay-300">
             <Button size="lg" onClick={handleCTA} className="text-lg px-10 py-7 rounded-2xl shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-1 active:scale-95 font-black">
              <Store className="mr-2 h-5 w-5" />
              Criar minha loja grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleWhatsApp} className="text-base px-8 py-6 rounded-2xl">
              <MessageCircle className="mr-2 h-5 w-5" /> Falar no WhatsApp
            </Button>
          </div>

          {/* Honest launch badge instead of fake numbers */}
           <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
             <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-2 text-sm font-semibold text-primary">
               <ShieldCheck className="h-4 w-4" />
               Delivery próprio • Sem depender dos grandes apps
             </div>
             <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/20 px-4 py-2 text-sm font-semibold text-blue-600">
               <Store className="h-4 w-4" />
               PDV integrado • Venda no balcão também
             </div>
           </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center gap-6 justify-center mt-8 text-sm text-muted-foreground">
            {[
              { icon: CheckCircle2, text: "Sem cartão de crédito" },
              { icon: Clock, text: "Aprovação em 24h" },
              { icon: ShieldCheck, text: "Cancele quando quiser" },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <t.icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{t.text}</span>
              </div>
            ))}
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
                     <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                       {item.emoji}
                     </div>
                     <div>
                       <p className="text-sm text-muted-foreground line-through mb-1">{item.pain}</p>
                       <p className="text-base font-bold text-primary">{item.solution}</p>
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
      <section className="py-20 px-4 bg-muted/20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Tudo que seu delivery precisa
          </h2>
          <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto">
            Do pedido online ao caixa presencial. Tudo incluso em todos os planos.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-5 hover:shadow-md hover:-translate-y-1 transition-all">
                <div className="rounded-xl bg-primary/10 w-11 h-11 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
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
                  <div key={item.title} className="flex gap-3 items-start rounded-2xl border border-border bg-card p-4 hover:border-blue-500/20 transition-colors">
                    <span className="text-2xl shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
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
                  className={`relative flex flex-col rounded-[2.5rem] overflow-visible transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 border-2 ${
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
                        className={`w-full py-7 rounded-2xl text-base font-black transition-all ${
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
            <div className="grid sm:grid-cols-3 gap-8">
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
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-semibold text-foreground text-sm pr-4">{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div id={`faq-panel-${i}`} role="region" className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed animate-fade-in">
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
            <Button size="lg" onClick={handleCTA} className="text-base px-8 py-6 rounded-2xl shadow-lg shadow-primary/20">
              Criar minha loja grátis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleWhatsApp} className="text-base px-8 py-6 rounded-2xl">
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
    </div>
  );
};

export default StoreDirectory;
