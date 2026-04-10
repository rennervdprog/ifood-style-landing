import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/* ─── hooks ─── */
function useCountUp(end: number, duration = 2000, start = false) {
  const [val, setVal] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (!start || done.current) return;
    done.current = true;
    let startTime: number;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      setVal(Math.floor(p * end));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, start]);
  return val;
}

function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─── static data ─── */
const painPoints = [
  { emoji: "📸", pain: "Manda foto do cardápio pelo WhatsApp", solution: "Link profissional com fotos e preços atualizados" },
  { emoji: "📝", pain: "Anota pedido na mão e erra", solution: "Pedidos organizados e detalhados automaticamente" },
  { emoji: "💸", pain: "Confere PIX no extrato um por um", solution: "Pagamento confirmado na hora, sem conferir nada" },
  { emoji: "🔇", pain: "Perde pedido porque não ouviu a mensagem", solution: "Alerta sonoro + notificação push no celular" },
];

const steps = [
  { step: "01", title: "Cadastre sua loja", desc: "Preencha os dados básicos e escolha seu plano." },
  { step: "02", title: "Monte seu cardápio", desc: "Adicione categorias, produtos, fotos e preços." },
  { step: "03", title: "Compartilhe o link", desc: "Envie pelo WhatsApp, redes sociais ou imprima o QR Code." },
  { step: "04", title: "Receba pedidos!", desc: "Clientes pedem pelo celular e você recebe tudo organizado." },
];

const features = [
  { icon: Smartphone, title: "Cardápio no celular", desc: "Cliente abre o link e já faz o pedido. Sem baixar nenhum app." },
  { icon: QrCode, title: "QR Code exclusivo", desc: "Imprima e cole no balcão. Cliente aponta a câmera e pede." },
  { icon: CreditCard, title: "PIX automático", desc: "Pagamento confirmado na hora. Sem conferir extrato." },
  { icon: Bell, title: "Alerta instantâneo", desc: "Novo pedido? Alerta sonoro e push notification no celular." },
  { icon: Utensils, title: "Cardápio profissional", desc: "Categorias, fotos HD, descrições e adicionais personalizáveis." },
  { icon: BarChart3, title: "Relatórios completos", desc: "Saiba quanto vendeu, produtos mais pedidos e horários de pico." },
  { icon: Gift, title: "Fidelidade & Cupons", desc: "Programa de pontos e cupons de desconto para fidelizar clientes." },
  { icon: Truck, title: "Entrega integrada", desc: "Gerencie entregas, taxas por bairro e motoboys na plataforma." },
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
    commission: "5%",
    commissionLabel: "por pedido",
    color: "from-emerald-500 to-emerald-600",
    lightBg: "bg-emerald-50",
    textColor: "text-emerald-600",
    borderColor: "border-emerald-200",
    description: "Ideal para quem está começando e quer testar sem risco.",
    features: [
      "Cardápio digital ilimitado",
      "QR Code exclusivo",
      "PIX automático",
      "Notificações em tempo real",
      "Programa de fidelidade",
      "Cupons e promoções",
      "Relatórios de vendas",
      "Suporte por WhatsApp",
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
    commission: "2,5%",
    commissionLabel: "por pedido",
    color: "from-blue-500 to-blue-600",
    lightBg: "bg-blue-50",
    textColor: "text-blue-600",
    borderColor: "border-blue-200",
    description: "Para lojas que já vendem bem e querem pagar menos comissão.",
    features: [
      "Tudo do plano Comissão",
      "Comissão reduzida (2,5%)",
      "Suporte prioritário",
      "Relatórios avançados",
      "Banners ilimitados",
      "Agendamento de pedidos",
      "Destaque na vitrine",
      "Cardápio com fotos HD",
    ],
    extraFees: [],
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
    commission: "0%",
    commissionLabel: "comissão",
    color: "from-primary to-orange-600",
    lightBg: "bg-accent",
    textColor: "text-primary",
    borderColor: "border-primary/30",
    description: "Zero comissão. Você fica com 100% do valor de cada pedido.",
    features: [
      "Tudo do plano Crescimento",
      "Zero comissão por pedido",
      "Suporte VIP prioritário",
      "Relatórios premium",
      "Prioridade em novidades",
      "Todas as ferramentas",
      "ROI garantido",
    ],
    extraFees: [
      { label: "Taxa PIX fixa", value: "R$ 1,00/transação" },
      { label: "Taxa entrega plataforma", value: "R$ 2,00/pedido" },
    ],
  },
];

const testimonials = [
  { name: "Maria S.", store: "Pizzaria do Sabor", text: "Meus clientes adoram pedir pelo cardápio digital. Não preciso mais anotar pedido por WhatsApp!", rating: 5, orders: "4.800+ pedidos" },
  { name: "João P.", store: "Hamburgueria Top", text: "Com o plano Essencial, cada pedido é lucro puro. O cardápio se paga no primeiro dia!", rating: 5, orders: "6.200+ pedidos" },
  { name: "Ana L.", store: "Doceria da Ana", text: "Montei meu cardápio em 10 minutos. É muito mais prático que mandar foto no WhatsApp.", rating: 5, orders: "3.500+ pedidos" },
];

const faqs = [
  { q: "Preciso baixar algum aplicativo?", a: "Não! Você gerencia tudo pelo navegador do celular ou computador. Seus clientes também pedem direto pelo link, sem instalar nada." },
  { q: "Como funciona o PIX automático?", a: "Quando o cliente escolhe PIX, geramos um QR Code automaticamente. Assim que ele paga, a confirmação é instantânea — sem precisar conferir extrato." },
  { q: "Posso trocar de plano depois?", a: "Sim! Você pode migrar entre planos a qualquer momento. Basta solicitar pelo painel da loja e o admin aprova a troca." },
  { q: "O plano Essencial cobra alguma comissão?", a: "Não! Zero comissão. Você fica com 100% do pedido. Há apenas uma taxa PIX fixa de R$1 por transação e R$2 por entrega via plataforma." },
  { q: "Como recebo os pedidos?", a: "Você recebe notificação sonora e push no celular em tempo real. O painel mostra todos os pedidos organizados para você gerenciar." },
  { q: "Funciona na minha cidade?", a: "Sim! Em todo o Brasil. Use como cardápio digital com entregador próprio em qualquer lugar." },
  { q: "Tem contrato ou multa?", a: "Não. Cancele quando quiser, sem multa e sem fidelidade." },
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
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-foreground">
            Ita<span className="text-primary">Super</span>
          </span>
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
              <Button className="rounded-full font-bold text-sm px-6" onClick={() => onNavigate("/cadastro-lojista")}>
                Cadastrar grátis
              </Button>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label={open ? "Fechar menu" : "Abrir menu"}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
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
              <button onClick={() => { setOpen(false); onNavigate("/portal-parceiro"); }} className="block w-full text-left py-3 text-sm font-semibold text-primary">
                Já sou parceiro
              </button>
              <Button className="w-full rounded-full font-bold mt-2" onClick={() => { setOpen(false); onNavigate("/cadastro-lojista"); }}>
                Cadastrar minha loja
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

  const storesCount = 127;
  const ordersCount = 48;
  const clientsCount = 12;
  const satisfactionCount = 98;

  const handleCTA = () => navigate("/cadastro-lojista");
  const handleWhatsApp = () =>
    window.open("https://wa.me/5514998765432?text=Olá! Tenho interesse em cadastrar minha loja na plataforma.", "_blank");

  useEffect(() => {
    document.title = "ItaSuper — Delivery em Itatinga/SP | Peça Agora";
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
        const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
        if (cancelled) return;
        if (profile?.role === "lojista") { navigate("/admin", { replace: true }); return; }
        if (profile?.role === "motoboy") { setPartnerRole(profile.role); }
        else { setPartnerRole(null); }
      } catch (e) { console.error("StoreDirectory role check error:", e); }
      if (!cancelled) setRoleChecked(true);
    };
    setRoleChecked(false);
    check();
    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  if (!authLoading && roleChecked && partnerRole) return <PartnerClientView />;
  if (authLoading || !roleChecked) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar onNavigate={navigate} isLoggedIn={!!user} />

      {/* ══════ HERO ══════ */}
      <section id="hero" className="relative py-20 md:py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/20 pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-accent/30 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary mb-8 animate-fade-in">
            <MapPin className="h-4 w-4" />
            Cardápio digital para todo o Brasil
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-6 animate-fade-in">
            Delivery digital{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-primary">para sua loja.</span>
              <span className="absolute bottom-1 left-0 w-full h-3 bg-primary/15 -z-0 rounded" />
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in leading-relaxed">
            Cardápio profissional, pedidos organizados e pagamentos automáticos.
            <span className="block mt-2 text-primary font-semibold">A partir de R$ 0/mês. Planos pagos com 7 dias grátis!</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in">
            <Button size="lg" onClick={handleCTA} className="text-base px-8 py-6 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
              <Store className="mr-2 h-5 w-5" />
              Cadastrar minha loja — É grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleWhatsApp} className="text-base px-8 py-6 rounded-2xl">
              <MessageCircle className="mr-2 h-5 w-5" /> Tirar dúvidas
            </Button>
          </div>

          {/* social proof */}
          <div className="mt-10 flex items-center justify-center gap-3 text-sm text-muted-foreground animate-fade-in">
            <div className="flex -space-x-2">
              {["M", "J", "A", "R"].map((letter, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-bold text-primary">
                  {letter}
                </div>
              ))}
            </div>
            <span>+127 lojas já usam • 48.000+ pedidos recebidos</span>
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
      <section id="vantagens" className="py-16 px-4 border-y border-border bg-muted/30">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
            Você ainda faz isso? 🤔
          </h2>
          <p className="text-center text-muted-foreground mb-10 max-w-xl mx-auto">
            Se identificou com algum desses problemas? Tem solução.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {painPoints.map((item) => (
              <div key={item.pain} className="group flex gap-4 items-start rounded-2xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
                <span className="text-3xl flex-shrink-0">{item.emoji}</span>
                <div>
                  <p className="text-sm text-muted-foreground line-through mb-1">{item.pain}</p>
                  <p className="text-sm font-semibold text-primary">{item.solution}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section id="como-funciona" className="py-20 px-4">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Funciona em 4 passos simples
          </h2>
          <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto">
            Do cadastro ao primeiro pedido em menos de 10 minutos.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={s.step} className="relative text-center group">
                {i < 3 && (
                  <div className="hidden lg:block absolute top-6 left-[60%] w-[80%] h-px bg-border" />
                )}
                <div className="relative mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-orange-600 text-primary-foreground flex items-center justify-center text-lg font-bold mb-4 shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                  {s.step}
                </div>
                <h3 className="font-bold text-foreground mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* location note */}
          <div className="max-w-3xl mx-auto mt-12 rounded-xl bg-primary/5 border border-primary/10 p-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 text-sm">
            <span className="text-muted-foreground"><MapPin className="h-3.5 w-3.5 inline mr-1 text-primary" /><strong className="text-foreground">Itatinga/SP</strong> — entrega disponível na região</span>
            <span className="text-muted-foreground"><MapPin className="h-3.5 w-3.5 inline mr-1 text-primary" /><strong className="text-foreground">Brasil</strong> — use seu próprio entregador</span>
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
            Praticidade total para você e para seu cliente. Incluso em todos os planos.
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

      {/* ══════ STATS ══════ */}
      <section className="py-14 border-y border-border">
        <div className="mx-auto max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-4">
          {[
            { value: `${storesCount}+`, label: "Lojas cadastradas", icon: Store },
            { value: `${ordersCount}k+`, label: "Pedidos entregues", icon: Package },
            { value: `${clientsCount}k+`, label: "Clientes ativos", icon: ShoppingBag },
            { value: `${satisfactionCount}%`, label: "Satisfação dos lojistas", icon: Star },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-3xl md:text-4xl font-extrabold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════ PLANS ══════ */}
      <section id="planos" className="py-20 px-4">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
            Escolha o plano ideal para sua loja
          </h2>
          <p className="text-center text-muted-foreground mb-4 max-w-2xl mx-auto">
            Todos os planos incluem cardápio digital completo, PIX online e notificações.
            Comece grátis e migre quando quiser.
          </p>
          <div className="flex justify-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600 border border-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              🎁 7 dias grátis nos planos Essencial e Crescimento!
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col rounded-3xl transition-all hover:shadow-xl ${
                    plan.highlight
                      ? "border-2 border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/10 scale-[1.02]"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-5 py-1.5 rounded-full shadow-md whitespace-nowrap">
                      {plan.badge}
                    </div>
                  )}
                  <CardContent className="flex flex-col flex-1 p-6 pt-8">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                      <Icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">{plan.tagline}</p>

                    <div className="mb-2">
                      <span className="text-4xl font-extrabold text-foreground">R$ {plan.price}</span>
                      <span className="text-muted-foreground text-sm">{plan.period}</span>
                    </div>

                    <div className={`inline-flex items-center rounded-xl ${plan.lightBg} px-3 py-2 text-sm font-bold ${plan.textColor} mb-2 w-fit`}>
                      <BadgePercent className="h-4 w-4 mr-1.5" />
                      {plan.commission} {plan.commissionLabel}
                    </div>

                    {plan.extraFees.length > 0 && (
                      <div className="space-y-1 mb-4">
                        {plan.extraFees.map((fee) => (
                          <p key={fee.label} className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                            {fee.label}: <span className="font-semibold">{fee.value}</span>
                          </p>
                        ))}
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{plan.description}</p>

                    <ul className="space-y-2.5 flex-1 mb-6">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={handleCTA}
                      className={`w-full rounded-2xl py-5 text-base font-semibold ${plan.highlight ? "shadow-lg shadow-primary/20" : ""}`}
                      variant={plan.highlight ? "default" : "outline"}
                    >
                      {plan.price === "0" ? "Começar grátis" : "Escolher plano"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════ TESTIMONIALS ══════ */}
      <section className="py-20 px-4 bg-muted/20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Quem usa, recomenda
          </h2>
          <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto">
            Veja o que nossos lojistas dizem sobre a plataforma.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="border-border rounded-2xl hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground italic leading-relaxed mb-4">"{t.text}"</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.store}</p>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full">
                      {t.orders}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Perguntas frequentes
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Tire suas dúvidas antes de começar.
          </p>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-semibold text-foreground text-sm pr-4">{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed animate-fade-in">
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
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Sem risco. Sem surpresas.
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Comece pelo plano Comissão (grátis) e migre quando quiser.
            Sem fidelidade, sem multa, sem pegadinha. Cancele a qualquer momento.
          </p>
        </div>
      </section>

      {/* ══════ FINAL CTA ══════ */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/20 pointer-events-none" />
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Seu cardápio digital pronto em 5 minutos
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Cadastre sua loja agora e comece a receber pedidos pelo celular ainda hoje.
            <span className="block mt-1 font-semibold text-primary">É grátis para começar!</span>
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={handleCTA} className="text-base px-8 py-6 rounded-2xl shadow-lg shadow-primary/20">
              Criar meu cardápio grátis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleWhatsApp} className="text-base px-8 py-6 rounded-2xl">
              <MessageCircle className="mr-2 h-5 w-5" /> Falar no WhatsApp
            </Button>
          </div>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border px-4">
        <p className="font-semibold text-foreground mb-1">ItaSuper</p>
        <p>© {new Date().getFullYear()} — Todos os direitos reservados.</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs">
          <button onClick={() => navigate("/portal-parceiro")} className="hover:text-primary transition-colors">Login Parceiro</button>
          <span>•</span>
          <button onClick={() => navigate("/cadastro-lojista")} className="hover:text-primary transition-colors">Cadastro Lojista</button>
          <span>•</span>
          <a href="/termos-de-uso" className="hover:text-primary transition-colors">Termos de Uso</a>
          <span>•</span>
          <a href="/politica-de-privacidade" className="hover:text-primary transition-colors">Política de Privacidade</a>
        </div>
      </footer>
    </div>
  );
};

export default StoreDirectory;
