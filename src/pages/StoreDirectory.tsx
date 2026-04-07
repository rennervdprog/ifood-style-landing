import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PartnerClientView from "@/components/PartnerClientView";
import {
  Zap, Store, Bike, ShieldCheck, Smartphone, TrendingUp, Users,
  ArrowRight, CheckCircle2, Star, MapPin, Clock, CreditCard,
  BarChart3, MessageSquare, Tag, Package, Navigation, ChevronRight,
  Menu, X, DollarSign, Percent, Globe, Rocket, Heart,
  PieChart, Award, BadgeCheck, Sparkles, Timer, Flame, Play,
  ChevronDown, ArrowDown, Banknote, Target, Trophy, Headphones
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ──────────────────── Theme ──────────────────── */
const THEME = {
  primary: "#FF6B00",
  primaryDark: "#E05E00",
  primaryLight: "#FFF3E8",
  grayBg: "#F8F9FB",
  white: "#FFFFFF",
  dark: "#1C1E21",
  muted: "#606770",
  border: "#E4E6EB",
  green: "#16A34A",
  greenLight: "#F0FDF4",
} as const;

/* ──────────────────── Animated Counter ──────────────────── */
const AnimatedNumber = ({ value, suffix = "" }: { value: string; suffix?: string }) => (
  <span className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color: THEME.primary }}>
    {value}{suffix}
  </span>
);

/* ──────────────────── Navbar ──────────────────── */
const Navbar = ({ onNavigate }: { onNavigate: (path: string) => void }) => {
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
    { label: "Comissão", href: "#planos" },
    { label: "Motoboys", href: "#motoboys" },
  ];

  const scrollTo = (id: string) => {
    setOpen(false);
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className={`sticky top-0 z-50 border-b backdrop-blur-md transition-all duration-300 ${scrolled ? "shadow-md" : ""}`} style={{ background: "rgba(255,255,255,0.97)", borderColor: THEME.border }}>
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
        <button onClick={() => scrollTo("#hero")} className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: THEME.primary }}>
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight" style={{ color: THEME.dark }}>
            Ita<span style={{ color: THEME.primary }}>Super</span>
          </span>
        </button>

        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <button key={l.href} onClick={() => scrollTo(l.href)} className="text-sm font-semibold transition-colors" style={{ color: THEME.muted }}
              onMouseEnter={(e) => (e.currentTarget.style.color = THEME.primary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = THEME.muted)}
            >{l.label}</button>
          ))}
          <button onClick={() => onNavigate("/portal-parceiro")} className="text-sm font-semibold transition-colors" style={{ color: THEME.muted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = THEME.primary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = THEME.muted)}
          >Já sou parceiro</button>
          <Button className="rounded-full font-bold text-sm px-6 text-white shadow-lg" style={{ background: THEME.primary }} onClick={() => onNavigate("/cadastro-lojista")}>
            Cadastrar grátis
          </Button>
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t px-4 pb-4 pt-2 animate-in slide-in-from-top-2" style={{ borderColor: THEME.border }}>
          {links.map((l) => (
            <button key={l.href} onClick={() => scrollTo(l.href)} className="block w-full text-left py-3 text-sm font-semibold" style={{ color: THEME.muted }}>{l.label}</button>
          ))}
          <button onClick={() => { setOpen(false); onNavigate("/portal-parceiro"); }} className="block w-full text-left py-3 text-sm font-semibold" style={{ color: THEME.primary }}>Já sou parceiro</button>
          <Button className="w-full rounded-full font-bold mt-2 text-white" style={{ background: THEME.primary }} onClick={() => { setOpen(false); onNavigate("/cadastro-lojista"); }}>
            Cadastrar minha loja
          </Button>
        </div>
      )}
    </nav>
  );
};

/* ──────────────────── Section ──────────────────── */
const Section = ({ children, id, bg = THEME.white, className = "" }: { children: React.ReactNode; id?: string; bg?: string; className?: string }) => (
  <section id={id} className={`px-4 py-16 sm:py-24 ${className}`} style={{ background: bg }}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);

const SectionLabel = ({ text, color = THEME.primary }: { text: string; color?: string }) => (
  <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color }}>{text}</p>
);

/* ──────────────────── Main Component ──────────────────── */
const StoreDirectory = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [partnerRole, setPartnerRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);

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
        if (profile && (profile.role === "lojista" || profile.role === "motoboy")) {
          setPartnerRole(profile.role);
        } else {
          setPartnerRole(null);
        }
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

  /* ── Data ── */
  const painPoints = [
    { icon: MessageSquare, problem: "Pedidos perdidos no WhatsApp", solution: "Sistema organizado que recebe, notifica e rastreia cada pedido" },
    { icon: Banknote, problem: "Sem controle financeiro", solution: "Painel com vendas, comissões e relatórios em tempo real" },
    { icon: Target, problem: "Clientes não te encontram", solution: "Cardápio digital profissional com link próprio" },
  ];

  const howItWorks = [
    { step: "1", icon: Store, title: "Cadastre em 2 minutos", desc: "Preencha seus dados e crie sua loja. Sem burocracia, sem contrato.", highlight: "Gratuito" },
    { step: "2", icon: Smartphone, title: "Monte seu cardápio", desc: "Adicione produtos com fotos e preços. Organize por categorias.", highlight: "Sem limite" },
    { step: "3", icon: Package, title: "Receba pedidos", desc: "Clientes pedem pelo app. Notificação instantânea no seu celular.", highlight: "Tempo real" },
    { step: "4", icon: DollarSign, title: "Receba e lucre", desc: "Pagamento direto na sua conta. Comissão transparente e justa.", highlight: "Sem surpresas" },
  ];

  const features = [
    { icon: Smartphone, title: "Cardápio Profissional", desc: "Menu com fotos, categorias, adicionais e personalização completa", tag: "Visual" },
    { icon: Package, title: "Gestão de Pedidos", desc: "Receba, confirme e acompanhe cada pedido em tempo real", tag: "Operação" },
    { icon: BarChart3, title: "Painel Financeiro", desc: "Vendas, comissões e repasses — tudo transparente", tag: "Finanças" },
    { icon: Tag, title: "Cupons & Promoções", desc: "Crie campanhas de desconto para atrair mais clientes", tag: "Marketing" },
    { icon: MessageSquare, title: "Chat com Cliente", desc: "Converse durante o pedido sem sair do app", tag: "Comunicação" },
    { icon: Clock, title: "Horários Flexíveis", desc: "Configure por dia da semana. Abra e feche quando quiser", tag: "Controle" },
    { icon: CreditCard, title: "PIX, Dinheiro & Cartão", desc: "Aceite todas as formas de pagamento", tag: "Pagamento" },
    { icon: ShieldCheck, title: "Entrega Segura", desc: "Código de coleta e PIN para cada entrega", tag: "Segurança" },
    { icon: Globe, title: "Qualquer Cidade", desc: "Funciona em todo o Brasil como cardápio digital", tag: "Abrangência" },
  ];

  const motoboyBenefits = [
    { icon: Banknote, value: "R$", title: "Ganho por entrega", desc: "Valor claro e transparente por cada corrida" },
    { icon: Clock, value: "0", title: "Horário fixo", desc: "Você decide quando e quanto quer rodar" },
    { icon: Navigation, value: "GPS", title: "Corridas automáticas", desc: "Receba entregas sem precisar procurar" },
    { icon: TrendingUp, value: "📊", title: "Painel completo", desc: "Histórico de ganhos e saques rápidos" },
  ];

  const testimonials = [
    { name: "Carlos", business: "Espetinhos do Carlão", role: "lojista", stars: 5, text: "Antes eu perdia pedidos no WhatsApp. Agora recebo tudo organizado e minhas vendas aumentaram 40%.", highlight: "+40% vendas" },
    { name: "Fernanda", business: "Doces da Fê", role: "lojista", stars: 5, text: "O cardápio digital ficou lindo! Meus clientes adoram pedir pelo app.", highlight: "Cardápio profissional" },
    { name: "Lucas", business: "Motoboy parceiro", role: "motoboy", stars: 5, text: "Ganho bem, escolho meus horários e o pagamento cai certinho.", highlight: "Horário flexível" },
    { name: "Dona Maria", business: "Marmitas da Maria", role: "lojista", stars: 5, text: "Sou lojista há 30 anos e nunca pensei que ia ter um app. Foi muito fácil!", highlight: "Fácil de usar" },
  ];

  const faq = [
    { q: "Preciso pagar algo para cadastrar?", a: "Nada! O cadastro é 100% gratuito. Sem mensalidade, sem taxa de adesão. Você só paga 15% quando efetivamente vende e entrega." },
    { q: "Como funciona a comissão de 15%?", a: "A comissão é calculada sobre o valor dos produtos. Ela cobre toda a tecnologia, sistema de pagamentos, suporte e infraestrutura. Delivery fee não entra no cálculo." },
    { q: "Posso usar em qualquer cidade?", a: "Sim! Qualquer loja do Brasil pode se cadastrar e usar como cardápio digital. A logística com motoboys da plataforma está disponível nas cidades com operação ativa." },
    { q: "Como recebo meu dinheiro?", a: "Pagamentos PIX vão direto para sua conta via split automático. Para dinheiro/cartão na entrega, o valor fica com você e a comissão é cobrada separadamente de forma transparente." },
    { q: "Quanto tempo para começar a vender?", a: "Após cadastro e aprovação (geralmente em até 24h), você monta seu cardápio e começa a receber pedidos imediatamente." },
    { q: "Posso cancelar a qualquer momento?", a: "Sim! Sem contrato, sem multa, sem fidelidade. Se não estiver satisfeito, pode sair quando quiser." },
  ];

  return (
    <div className="min-h-screen" style={{ background: THEME.white, color: THEME.dark }}>
      <Navbar onNavigate={navigate} />

      {/* ═══ HERO — Impactful ═══ */}
      <section id="hero" className="relative overflow-hidden px-4 pt-12 pb-16 sm:pt-20 sm:pb-24" style={{ background: `linear-gradient(135deg, ${THEME.dark} 0%, #2D1810 50%, ${THEME.primaryDark} 100%)` }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 70% 30%, rgba(255,107,0,0.4), transparent 50%), radial-gradient(circle at 20% 80%, rgba(255,107,0,0.2), transparent 50%)" }} />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center">
            {/* Urgency badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-8 animate-pulse" style={{ background: "rgba(255,107,0,0.2)", color: THEME.primary, border: `1px solid rgba(255,107,0,0.3)` }}>
              <Flame className="h-4 w-4" />
              Vagas limitadas na sua cidade — Garanta sua loja
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-white">
              Sua loja{" "}
              <span className="relative">
                <span style={{ color: THEME.primary }}>vendendo online</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none"><path d="M2 10C50 2 150 2 298 10" stroke={THEME.primary} strokeWidth="3" strokeLinecap="round"/></svg>
              </span>
              <br />
              em menos de 24 horas.
            </h1>

            <p className="text-lg sm:text-xl mt-6 leading-relaxed max-w-2xl mx-auto text-white/70">
              Enquanto você lê isso, seus concorrentes já estão recebendo pedidos pelo celular.
              <span className="text-white font-semibold"> Zero investimento. Zero mensalidade. </span>
              Comece agora e pague apenas quando vender.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
              <Button size="lg" className="gap-2 rounded-full font-bold text-base px-10 py-6 text-white shadow-2xl transition-all hover:scale-105 hover:shadow-orange-500/30" style={{ background: THEME.primary, fontSize: "1.05rem" }}
                onClick={() => navigate("/cadastro-lojista")}
              >
                <Store className="h-5 w-5" />
                Cadastrar minha loja — É grátis
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button size="lg" className="gap-2 rounded-full font-bold text-base px-8 py-6 transition-all hover:scale-105" style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}
                onClick={() => navigate("/cadastro-entregador")}
              >
                <Bike className="h-5 w-5" />
                Quero ser motoboy
              </Button>
            </div>

            {/* Trust bar */}
            <div className="flex flex-wrap items-center gap-6 justify-center mt-10">
              {[
                { icon: CheckCircle2, text: "Sem cartão de crédito" },
                { icon: Timer, text: "Aprovação em 24h" },
                { icon: ShieldCheck, text: "Cancele quando quiser" },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-1.5 text-sm font-medium text-white/60">
                  <t.icon className="h-4 w-4" style={{ color: THEME.primary }} />
                  {t.text}
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-14 grid grid-cols-3 gap-4 max-w-lg mx-auto">
            {[
              { value: "50+", label: "Lojistas ativos" },
              { value: "1.2k", label: "Pedidos entregues" },
              { value: "4.9", label: "Avaliação ★" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-black" style={{ color: THEME.primary }}>{s.value}</div>
                <div className="text-xs font-medium text-white/50 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-6 w-6 text-white/30" />
        </div>
      </section>

      {/* ═══ PAIN POINTS — "Você se identifica?" ═══ */}
      <Section id="vantagens" bg={THEME.white}>
        <div className="text-center mb-12">
          <SectionLabel text="Você se identifica?" />
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: THEME.dark }}>
            Problemas que acabam <span style={{ color: THEME.primary }}>hoje</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {painPoints.map((p, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border transition-all hover:shadow-xl hover:-translate-y-1 group" style={{ borderColor: THEME.border }}>
              {/* Problem */}
              <div className="p-5 border-b" style={{ background: "#FEF2F2", borderColor: "#FECACA" }}>
                <div className="flex items-center gap-2 mb-2">
                  <X className="h-5 w-5 text-red-500" />
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Problema</span>
                </div>
                <p className="font-bold text-sm" style={{ color: THEME.dark }}>{p.problem}</p>
              </div>
              {/* Solution */}
              <div className="p-5" style={{ background: THEME.greenLight }}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5" style={{ color: THEME.green }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: THEME.green }}>Com ItaSuper</span>
                </div>
                <p className="text-sm font-medium" style={{ color: THEME.dark }}>{p.solution}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ COMO FUNCIONA ═══ */}
      <Section id="como-funciona" bg={THEME.grayBg}>
        <div className="text-center mb-14">
          <SectionLabel text="4 passos simples" />
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: THEME.dark }}>
            Do cadastro ao primeiro pedido
          </h2>
          <p className="text-base mt-2" style={{ color: THEME.muted }}>Sem burocracia. Sem contrato. Sem surpresas.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {howItWorks.map((s, i) => (
            <div key={s.step} className="relative rounded-2xl p-6 border text-center group transition-all hover:shadow-lg hover:-translate-y-1" style={{ background: THEME.white, borderColor: THEME.border }}>
              {/* Step number */}
              <div className="relative mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: THEME.primaryLight }}>
                <s.icon className="h-6 w-6" style={{ color: THEME.primary }} />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: THEME.primary }}>{s.step}</span>
              </div>
              <h3 className="font-bold text-sm mb-1" style={{ color: THEME.dark }}>{s.title}</h3>
              <p className="text-xs leading-relaxed mb-3" style={{ color: THEME.muted }}>{s.desc}</p>
              <span className="inline-block text-[10px] font-bold px-3 py-1 rounded-full" style={{ background: THEME.primaryLight, color: THEME.primary }}>{s.highlight}</span>
              {i < howItWorks.length - 1 && (
                <ArrowRight className="hidden lg:block absolute top-1/2 -right-4 h-5 w-5 -translate-y-1/2" style={{ color: THEME.border }} />
              )}
            </div>
          ))}
        </div>

        {/* CTA inline */}
        <div className="text-center mt-10">
          <Button size="lg" className="gap-2 rounded-full font-bold px-10 text-white shadow-lg transition-all hover:shadow-xl hover:scale-105" style={{ background: THEME.primary }}
            onClick={() => navigate("/cadastro-lojista")}
          >
            Começar agora — é grátis
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </Section>

      {/* ═══ COMISSÃO — Crystal Clear ═══ */}
      <Section id="planos" bg={THEME.white}>
        <div className="text-center mb-10">
          <SectionLabel text="Transparência total" />
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: THEME.dark }}>
            Quanto custa? <span style={{ color: THEME.primary }}>Só 15% por venda.</span>
          </h2>
          <p className="text-base mt-3 max-w-xl mx-auto" style={{ color: THEME.muted }}>
            Sem vendas = sem custos. Simples assim.
          </p>
        </div>

        {/* Price card */}
        <div className="max-w-md mx-auto">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{ border: `3px solid ${THEME.primary}` }}>
            {/* Header */}
            <div className="px-6 pt-8 pb-6 text-center" style={{ background: `linear-gradient(135deg, ${THEME.dark}, #2D1810)` }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4" style={{ background: THEME.primary, color: "white" }}>
                <Flame className="h-3 w-3" />
                Promoção de lançamento
              </div>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl font-bold line-through text-white/40">18%</span>
                <span className="text-6xl font-black text-white">15<span className="text-3xl">%</span></span>
              </div>
              <p className="text-white/60 text-sm mt-2">por pedido entregue</p>
              <p className="text-xs font-bold mt-3 px-3 py-1.5 rounded-full inline-block" style={{ background: "rgba(255,107,0,0.2)", color: THEME.primary }}>
                🔥 Economize 3% — oferta limitada
              </p>
            </div>

            {/* Features */}
            <div className="px-6 py-6" style={{ background: THEME.white }}>
              <ul className="space-y-3">
                {[
                  "Cardápio digital profissional",
                  "Gestão de pedidos em tempo real",
                  "Chat direto com o cliente",
                  "Cupons e promoções",
                  "Relatórios financeiros",
                  "PIX, dinheiro e cartão",
                  "Horários flexíveis",
                  "Suporte dedicado",
                  "Entrega com motoboy próprio ou da plataforma",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: THEME.dark }}>
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: THEME.green }} />
                    {f}
                  </li>
                ))}
              </ul>

              <Button className="w-full rounded-full font-bold text-base py-6 mt-6 text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]" style={{ background: THEME.primary }}
                onClick={() => navigate("/cadastro-lojista")}
              >
                Cadastrar grátis agora
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>

              <div className="flex items-center justify-center gap-4 mt-4 text-xs" style={{ color: THEME.muted }}>
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" style={{ color: THEME.green }} /> Sem mensalidade</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" style={{ color: THEME.green }} /> Sem contrato</span>
              </div>
            </div>
          </div>
        </div>

        {/* Commission breakdown */}
        <div className="mt-12 max-w-3xl mx-auto grid sm:grid-cols-3 gap-5">
          {[
            { icon: DollarSign, title: "Só quando vende", desc: "Sem vendas, zero custos. Você paga comissão apenas sobre pedidos entregues com sucesso." },
            { icon: Percent, title: "Zero taxas ocultas", desc: "Sem mensalidade, adesão ou multa. O que você vê é exatamente o que paga." },
            { icon: BarChart3, title: "Controle total", desc: "Painel com cada venda, comissão e repasse detalhados em tempo real." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl p-5 border transition-all hover:shadow-md" style={{ borderColor: THEME.border }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: THEME.primaryLight }}>
                <item.icon className="h-5 w-5" style={{ color: THEME.primary }} />
              </div>
              <h4 className="font-bold text-sm mb-1" style={{ color: THEME.dark }}>{item.title}</h4>
              <p className="text-xs leading-relaxed" style={{ color: THEME.muted }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ FUNCIONALIDADES ═══ */}
      <Section id="funcionalidades" bg={THEME.grayBg}>
        <div className="text-center mb-14">
          <SectionLabel text="Tudo incluso" />
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: THEME.dark }}>
            Ferramentas que grandes redes usam
          </h2>
          <p className="text-base mt-2" style={{ color: THEME.muted }}>Agora disponíveis para sua loja, sem custo extra.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl p-5 border transition-all hover:shadow-lg hover:-translate-y-0.5 group" style={{ background: THEME.white, borderColor: THEME.border }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: THEME.primaryLight }}>
                  <f.icon className="h-5 w-5" style={{ color: THEME.primary }} />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: THEME.grayBg, color: THEME.muted }}>{f.tag}</span>
              </div>
              <h4 className="font-bold text-sm mb-1" style={{ color: THEME.dark }}>{f.title}</h4>
              <p className="text-xs leading-relaxed" style={{ color: THEME.muted }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ MOTOBOYS — Impactful ═══ */}
      <Section id="motoboys" bg={THEME.white}>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <SectionLabel text="Para Motoboys" />
            <h2 className="text-2xl sm:text-3xl font-black mb-4" style={{ color: THEME.dark }}>
              Ganhe dinheiro{" "}
              <span style={{ color: THEME.primary }}>no seu tempo.</span>
            </h2>
            <p className="text-base mb-8" style={{ color: THEME.muted }}>
              Sem patrão, sem horário fixo, sem vínculo. Rode quando quiser e ganhe por cada entrega.
              Atualmente operando em <strong style={{ color: THEME.primary }}>Itatinga/SP</strong>.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {motoboyBenefits.map((b) => (
                <div key={b.title} className="rounded-xl p-4 border transition-all hover:shadow-md" style={{ borderColor: THEME.border }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2" style={{ background: THEME.primaryLight }}>
                    <b.icon className="h-5 w-5" style={{ color: THEME.primary }} />
                  </div>
                  <h4 className="font-bold text-xs mb-0.5" style={{ color: THEME.dark }}>{b.title}</h4>
                  <p className="text-[11px] leading-relaxed" style={{ color: THEME.muted }}>{b.desc}</p>
                </div>
              ))}
            </div>

            <Button size="lg" className="gap-2 rounded-full font-bold px-10 text-white shadow-lg transition-all hover:shadow-xl hover:scale-105" style={{ background: THEME.primary }}
              onClick={() => navigate("/cadastro-entregador")}
            >
              <Bike className="h-5 w-5" />
              Cadastrar como motoboy
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Visual card */}
          <div className="relative">
            <div className="rounded-3xl p-8 text-center" style={{ background: `linear-gradient(135deg, ${THEME.dark}, #2D1810)` }}>
              <Bike className="h-16 w-16 mx-auto mb-4" style={{ color: THEME.primary }} />
              <h3 className="text-2xl font-black text-white mb-2">Entregador ItaSuper</h3>
              <p className="text-white/60 text-sm mb-6">Faça entregas, ganhe dinheiro</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Liberdade", icon: "🏍️" },
                  { label: "Ganhos", icon: "💰" },
                  { label: "Segurança", icon: "🔒" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <div className="text-xs font-medium text-white/70">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ DEPOIMENTOS ═══ */}
      <Section bg={THEME.grayBg}>
        <div className="text-center mb-14">
          <SectionLabel text="Quem já usa, aprova" />
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: THEME.dark }}>
            Resultados reais
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {testimonials.map((t, i) => (
            <div key={i} className="rounded-2xl p-6 border relative overflow-hidden transition-all hover:shadow-lg" style={{ borderColor: THEME.border, background: THEME.white }}>
              {/* Highlight badge */}
              <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: THEME.primaryLight, color: THEME.primary }}>
                {t.highlight}
              </div>
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: THEME.muted }}>"{t.text}"</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: t.role === "motoboy" ? THEME.green : THEME.primary }}>
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: THEME.dark }}>{t.name}</p>
                  <p className="text-xs" style={{ color: THEME.muted }}>{t.business}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ FAQ ═══ */}
      <Section bg={THEME.white}>
        <div className="text-center mb-14">
          <SectionLabel text="Dúvidas?" />
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: THEME.dark }}>
            Perguntas frequentes
          </h2>
        </div>

        <div className="max-w-2xl mx-auto space-y-3">
          {faq.map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </Section>

      {/* ═══ CTA FINAL — Urgency ═══ */}
      <section className="px-4 py-16 sm:py-24 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${THEME.dark} 0%, #2D1810 50%, ${THEME.primaryDark} 100%)` }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, rgba(255,107,0,0.4), transparent 50%)" }} />
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6" style={{ background: "rgba(255,107,0,0.2)", color: THEME.primary }}>
            <Rocket className="h-4 w-4" />
            Não fique para trás
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-4">
            Cada dia sem o ItaSuper é um{" "}
            <span style={{ color: THEME.primary }}>cliente perdido.</span>
          </h2>
          <p className="text-base text-white/70 mb-10 max-w-xl mx-auto">
            Seus concorrentes já estão online. Cadastre-se agora e comece a receber pedidos em até 24 horas. Grátis. Sem risco.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="gap-2 rounded-full font-bold text-base px-10 py-6 shadow-2xl transition-all hover:scale-105" style={{ background: THEME.primary, color: "white" }}
              onClick={() => navigate("/cadastro-lojista")}
            >
              <Store className="h-5 w-5" />
              Cadastrar minha loja — É grátis
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button size="lg" className="gap-2 rounded-full font-bold text-base px-8 py-6 transition-all hover:scale-105" style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}
              onClick={() => navigate("/cadastro-entregador")}
            >
              <Bike className="h-5 w-5" />
              Ser motoboy
            </Button>
          </div>
          <p className="text-sm text-white/40 mt-8">
            Já é parceiro?{" "}
            <button onClick={() => navigate("/portal-parceiro")} className="text-white/80 font-bold underline underline-offset-4 hover:text-white transition-colors">
              Faça login aqui
            </button>
          </p>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="px-4 py-10 border-t" style={{ borderColor: THEME.border }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: THEME.primary }}>
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-extrabold" style={{ color: THEME.dark }}>
                Ita<span style={{ color: THEME.primary }}>Super</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-6 justify-center">
              {[
                { label: "Cadastro Lojista", path: "/cadastro-lojista" },
                { label: "Cadastro Motoboy", path: "/cadastro-entregador" },
                { label: "Login Parceiro", path: "/portal-parceiro" },
              ].map((l) => (
                <button key={l.path} onClick={() => navigate(l.path)} className="text-sm font-semibold transition-colors" style={{ color: THEME.muted }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = THEME.primary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = THEME.muted)}
                >{l.label}</button>
              ))}
            </div>
          </div>
          <div className="mt-8 pt-6 text-center border-t" style={{ borderColor: THEME.border }}>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>
              © {new Date().getFullYear()} <strong>ItaSuper</strong> — Plataforma de delivery para lojistas e motoboys de todo o Brasil
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* ──────────────────── FAQ Item ──────────────────── */
const FaqItem = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border overflow-hidden transition-all" style={{ background: THEME.white, borderColor: open ? THEME.primary : THEME.border }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left">
        <span className="font-bold text-sm pr-4" style={{ color: THEME.dark }}>{question}</span>
        <ChevronRight className={`h-5 w-5 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`} style={{ color: open ? THEME.primary : THEME.muted }} />
      </button>
      {open && (
        <div className="px-5 pb-5 -mt-1">
          <p className="text-sm leading-relaxed" style={{ color: THEME.muted }}>{answer}</p>
        </div>
      )}
    </div>
  );
};

export default StoreDirectory;
