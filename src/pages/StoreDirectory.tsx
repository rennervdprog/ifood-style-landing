import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PartnerClientView from "@/components/PartnerClientView";
import {
  Zap, Store, Bike, ShieldCheck, Smartphone, TrendingUp, Users,
  ArrowRight, CheckCircle2, Star, MapPin, Clock, CreditCard,
  BarChart3, MessageSquare, Tag, Package, Navigation, ChevronRight,
  Menu, X, Mail, DollarSign, Percent, Globe, Rocket, Heart,
  PieChart, Award, BadgeCheck, Sparkles, Timer, Flame
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
} as const;

/* ──────────────────── Navbar ──────────────────── */
const Navbar = ({ onNavigate }: { onNavigate: (path: string) => void }) => {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Como funciona", href: "#como-funciona" },
    { label: "Planos", href: "#planos" },
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Para Motoboys", href: "#motoboys" },
  ];

  const scrollTo = (id: string) => {
    setOpen(false);
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ background: "rgba(255,255,255,0.97)", borderColor: THEME.border }}>
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
          <Button className="rounded-full font-bold text-sm px-6 text-white" style={{ background: THEME.primary }} onClick={() => onNavigate("/cadastro-lojista")}>
            Cadastrar minha loja
          </Button>
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t px-4 pb-4 pt-2" style={{ borderColor: THEME.border }}>
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

const SectionLabel = ({ text }: { text: string }) => (
  <p className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: THEME.primary }}>{text}</p>
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
  const commissionPlan = {
    name: "Cardápio Digital",
    icon: Smartphone,
    price: "15%",
    commission: "por pedido entregue",
    desc: "Tudo que sua loja precisa para vender online",
    features: [
      "Cardápio digital profissional",
      "Gestão de pedidos em tempo real",
      "Chat direto com o cliente",
      "Cupons e promoções personalizadas",
      "Relatórios financeiros completos",
      "Pagamento PIX, dinheiro e cartão",
      "Horários de funcionamento flexíveis",
      "Entrega com motoboy próprio ou da plataforma*",
    ],
    cta: "Começar agora",
  };

  const howItWorks = [
    { step: "1", icon: Store, title: "Cadastre sua loja", desc: "Informe seu CEP. Identificamos sua cidade e criamos seu cardápio digital automaticamente." },
    { step: "2", icon: Smartphone, title: "Monte seu cardápio", desc: "Adicione produtos, fotos e preços. Organize por categorias direto no painel." },
    { step: "3", icon: Package, title: "Receba pedidos", desc: "Clientes pedem pelo app. Você confirma e prepara. Notificação em tempo real." },
    { step: "4", icon: Bike, title: "Entrega garantida", desc: "Em cidades com operação ativa, nossos motoboys fazem a entrega. Nas demais, use seu próprio entregador." },
  ];

  const features = [
    { icon: Smartphone, title: "Cardápio Profissional", desc: "Menu online com fotos, categorias, adicionais e personalização completa" },
    { icon: Package, title: "Gestão de Pedidos", desc: "Receba, confirme e acompanhe cada pedido em tempo real" },
    { icon: BarChart3, title: "Relatórios Financeiros", desc: "Vendas, comissões e entregas — tudo transparente" },
    { icon: Tag, title: "Cupons e Promoções", desc: "Crie campanhas de desconto e cupons de primeira compra" },
    { icon: MessageSquare, title: "Chat Integrado", desc: "Converse com o cliente durante o pedido sem sair do app" },
    { icon: Clock, title: "Horários Flexíveis", desc: "Configure horários de funcionamento por dia da semana" },
    { icon: CreditCard, title: "Pagamento Flexível", desc: "PIX, dinheiro e cartão na entrega" },
    { icon: ShieldCheck, title: "Entrega Segura", desc: "Código de coleta e PIN para segurança máxima" },
    { icon: Globe, title: "Qualquer Cidade", desc: "Funciona como cardápio digital em todo o Brasil" },
  ];

  const motoboyFeatures = [
    { icon: Navigation, title: "Corridas Automáticas", desc: "Receba entregas da sua cidade sem precisar procurar" },
    { icon: CreditCard, title: "Ganhos Transparentes", desc: "Veja exatamente quanto ganha por cada entrega" },
    { icon: Clock, title: "Horário Flexível", desc: "Você decide quando quer rodar — sem horário fixo" },
    { icon: TrendingUp, title: "Painel de Ganhos", desc: "Histórico completo de corridas, ganhos e saques" },
    { icon: MapPin, title: "Sua Cidade", desc: "Entregas sempre perto de você, na sua região" },
    { icon: ShieldCheck, title: "Saques Rápidos", desc: "Solicite saques quando quiser, direto na sua conta" },
  ];

  const testimonials = [
    { name: "Carlos — Espetinhos do Carlão", stars: 5, text: "Antes eu perdia pedidos no WhatsApp. Agora recebo tudo organizado e o motoboy chega rápido. Minhas vendas aumentaram 40%." },
    { name: "Fernanda — Doces da Fê", stars: 5, text: "O cardápio digital ficou lindo! Meus clientes adoram pedir pelo app. E o suporte é muito atencioso." },
    { name: "Lucas — Motoboy", stars: 5, text: "Comecei a rodar pelo ItaSuper há 2 meses. Ganho bem, escolho meus horários e o pagamento cai certinho." },
    { name: "Dona Maria — Marmitas da Maria", stars: 5, text: "Sou lojista há 30 anos e nunca pensei que iria ter um app. Foi muito fácil de usar. Recomendo!" },
  ];

  const faq = [
    { q: "Preciso pagar algo para cadastrar minha loja?", a: "O cadastro é 100% gratuito e sem mensalidade. Cobramos apenas 15% de comissão sobre cada pedido entregue, independente do plano escolhido." },
    { q: "Como funciona a comissão de 15%?", a: "A comissão é calculada sobre o valor dos produtos do pedido. Ela cobre toda a tecnologia, suporte, sistema de pagamentos e infraestrutura da plataforma." },
    { q: "Qual a diferença entre os planos?", a: "Ambos cobram 15% por pedido. A diferença é que no Plataforma Completa, nossos motoboys fazem a entrega. No Cardápio Digital, você usa seus próprios entregadores." },
    { q: "Posso usar o ItaSuper em qualquer cidade?", a: "Sim! Qualquer loja do Brasil pode se cadastrar. A logística com motoboys da plataforma está disponível nas cidades com operação ativa." },
    { q: "Como recebo o pagamento dos pedidos?", a: "O cliente paga via PIX, dinheiro ou cartão na entrega. O valor vai direto para você. A comissão é cobrada separadamente de forma transparente." },
    { q: "Quanto tempo leva para começar a vender?", a: "Após cadastro e aprovação (geralmente em até 24h), você monta seu cardápio e começa a receber pedidos imediatamente." },
  ];

  return (
    <div className="min-h-screen" style={{ background: THEME.white, color: THEME.dark }}>
      <Navbar onNavigate={navigate} />

      {/* ═══ HERO ═══ */}
      <section id="hero" className="relative overflow-hidden px-4 pt-16 pb-12 sm:pt-24 sm:pb-20" style={{ background: `linear-gradient(180deg, ${THEME.primaryLight} 0%, ${THEME.white} 100%)` }}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-6" style={{ background: THEME.white, color: THEME.primary, border: `1px solid ${THEME.border}` }}>
            <Flame className="h-4 w-4" />
            Promoção de lançamento — comissão reduzida
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]" style={{ color: THEME.dark }}>
            Seus clientes querem pedir.{" "}
            <span style={{ color: THEME.primary }}>Sua loja precisa estar lá.</span>
          </h1>
          <p className="text-base sm:text-lg mt-5 leading-relaxed max-w-2xl mx-auto" style={{ color: THEME.muted }}>
            Enquanto você lê isso, alguém na sua cidade está procurando onde pedir comida.
            Com o ItaSuper, sua loja aparece, recebe pedidos e entrega — tudo pelo celular.
            Sem mensalidade. Sem contrato. Apenas 15% por pedido entregue.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Button size="lg" className="gap-2 rounded-full font-bold text-base px-8 text-white shadow-lg transition-all hover:shadow-xl" style={{ background: THEME.primary }}
              onMouseEnter={(e) => (e.currentTarget.style.background = THEME.primaryDark)}
              onMouseLeave={(e) => (e.currentTarget.style.background = THEME.primary)}
              onClick={() => navigate("/cadastro-lojista")}
            >
              <Store className="h-5 w-5" />
              Cadastrar minha loja agora
            </Button>
            <Button size="lg" className="gap-2 rounded-full font-bold text-base px-8 transition-all shadow-md hover:shadow-lg" style={{ background: THEME.white, color: THEME.primary, border: `2px solid ${THEME.primary}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = THEME.primaryLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = THEME.white; }}
              onClick={() => navigate("/cadastro-entregador")}
            >
              <Bike className="h-5 w-5" />
              Quero ser motoboy
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center gap-6 justify-center mt-10">
            {[
              { icon: CheckCircle2, text: "Cadastro gratuito" },
              { icon: Globe, text: "Qualquer cidade do Brasil" },
              { icon: Timer, text: "Pronto em 24h" },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: THEME.muted }}>
                <t.icon className="h-4 w-4" style={{ color: THEME.primary }} />
                {t.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF BAR ═══ */}
      <div className="py-4 border-y" style={{ borderColor: THEME.border, background: THEME.white }}>
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-8 px-4">
          {[
            { value: "50+", label: "Lojistas ativos" },
            { value: "1.200+", label: "Pedidos entregues" },
            { value: "4.9★", label: "Avaliação média" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-xl font-black" style={{ color: THEME.primary }}>{s.value}</span>
              <span className="text-xs font-semibold" style={{ color: THEME.muted }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ COMO FUNCIONA ═══ */}
      <Section id="como-funciona" bg={THEME.white}>
        <div className="text-center mb-14">
          <SectionLabel text="Simples assim" />
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: THEME.dark }}>
            Do cadastro ao primeiro pedido em 4 passos
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {howItWorks.map((s, i) => (
            <div key={s.step} className="relative text-center group">
              <div className="relative mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: THEME.primaryLight }}>
                <s.icon className="h-7 w-7" style={{ color: THEME.primary }} />
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: THEME.primary }}>{s.step}</span>
              </div>
              <h3 className="font-bold text-base mb-1" style={{ color: THEME.dark }}>{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: THEME.muted }}>{s.desc}</p>
              {i < howItWorks.length - 1 && (
                <ArrowRight className="hidden lg:block absolute top-8 -right-4 h-5 w-5" style={{ color: THEME.border }} />
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ PLANOS E COMISSÃO ═══ */}
      <Section id="planos" bg={THEME.grayBg}>
        <div className="text-center mb-14">
          <SectionLabel text="Comissão" />
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: THEME.dark }}>
            Simples, transparente e sem surpresas
          </h2>
          <p className="text-base mt-3 max-w-xl mx-auto" style={{ color: THEME.muted }}>
            Sem mensalidade. Sem taxa de adesão. Você só paga quando vende.
          </p>
        </div>

        <div className="max-w-lg mx-auto">
          <div className="relative rounded-2xl border-2 p-6 sm:p-8 transition-all hover:shadow-lg" style={{
            background: THEME.white,
            borderColor: THEME.primary,
          }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap" style={{ background: THEME.primary }}>
              Plano único
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: THEME.primaryLight }}>
                <commissionPlan.icon className="h-6 w-6" style={{ color: THEME.primary }} />
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{ color: THEME.dark }}>{commissionPlan.name}</h3>
                <p className="text-xs" style={{ color: THEME.muted }}>{commissionPlan.desc}</p>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-lg font-bold line-through mr-2" style={{ color: "#B0B3B8" }}>18%</span>
              <span className="text-4xl font-black" style={{ color: THEME.primary }}>{commissionPlan.price}</span>
              <span className="text-sm font-semibold ml-1" style={{ color: THEME.muted }}>{commissionPlan.commission}</span>
              <div className="mt-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}>
                  🔥 Oferta de lançamento — economize 3%
                </span>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {commissionPlan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm" style={{ color: THEME.dark }}>
                  <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: THEME.primary }} />
                  {f}
                </li>
              ))}
            </ul>

            <Button className="w-full rounded-full font-bold text-sm py-5 text-white" style={{ background: THEME.primary }}
              onClick={() => navigate("/cadastro-lojista")}
            >
              {commissionPlan.cta}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <p className="text-xs text-center mt-4" style={{ color: THEME.muted }}>
              *Motoboys da plataforma disponíveis em cidades com operação ativa
            </p>
          </div>
        </div>

        {/* Commission explanation */}
        <div className="mt-12 max-w-3xl mx-auto rounded-2xl p-6 border" style={{ background: THEME.white, borderColor: THEME.border }}>
          <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: THEME.dark }}>
            <PieChart className="h-5 w-5" style={{ color: THEME.primary }} />
            Entenda a comissão de 15%
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: DollarSign, title: "Só quando vende", desc: "Sem vendas = sem custos. A comissão é cobrada apenas sobre pedidos efetivamente entregues." },
              { icon: Percent, title: "Zero taxas escondidas", desc: "Sem mensalidade, sem taxa de adesão, sem multa por cancelamento. Transparência total." },
              { icon: BarChart3, title: "Controle no painel", desc: "Acompanhe vendas, comissões e repasses em tempo real. Cada centavo detalhado." },
            ].map((item) => (
              <div key={item.title} className="flex flex-col gap-2">
                <item.icon className="h-5 w-5" style={{ color: THEME.primary }} />
                <h4 className="font-bold text-sm" style={{ color: THEME.dark }}>{item.title}</h4>
                <p className="text-xs leading-relaxed" style={{ color: THEME.muted }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══ FUNCIONALIDADES ═══ */}
      <Section id="funcionalidades" bg={THEME.white}>
        <div className="text-center mb-14">
          <SectionLabel text="Tudo incluso" />
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: THEME.dark }}>
            Ferramentas que grandes redes usam — agora na sua mão
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl p-5 border transition-all hover:shadow-lg hover:-translate-y-0.5 group" style={{ background: THEME.white, borderColor: THEME.border }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-colors" style={{ background: THEME.primaryLight }}>
                <f.icon className="h-5 w-5" style={{ color: THEME.primary }} />
              </div>
              <h4 className="font-bold text-sm mb-1" style={{ color: THEME.dark }}>{f.title}</h4>
              <p className="text-xs leading-relaxed" style={{ color: THEME.muted }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ MOTOBOYS ═══ */}
      <Section id="motoboys" bg={THEME.grayBg}>
        <div className="text-center mb-14">
          <SectionLabel text="Para Motoboys" />
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: THEME.dark }}>
            Ganhe dinheiro fazendo entregas na sua cidade
          </h2>
          <p className="text-base mt-3 max-w-xl mx-auto" style={{ color: THEME.muted }}>
            Sem vínculo, sem horário fixo. Rode quando quiser e ganhe por entrega.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {motoboyFeatures.map((f) => (
            <div key={f.title} className="rounded-2xl p-5 border transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ background: THEME.white, borderColor: THEME.border }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: THEME.primaryLight }}>
                <f.icon className="h-5 w-5" style={{ color: THEME.primary }} />
              </div>
              <h4 className="font-bold text-sm mb-1" style={{ color: THEME.dark }}>{f.title}</h4>
              <p className="text-xs leading-relaxed" style={{ color: THEME.muted }}>{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button size="lg" className="gap-2 rounded-full font-bold text-base px-8 text-white" style={{ background: THEME.primary }}
            onMouseEnter={(e) => (e.currentTarget.style.background = THEME.primaryDark)}
            onMouseLeave={(e) => (e.currentTarget.style.background = THEME.primary)}
            onClick={() => navigate("/cadastro-entregador")}
          >
            <Bike className="h-5 w-5" />
            Quero ser motoboy
          </Button>
          <p className="text-xs mt-3" style={{ color: THEME.muted }}>
            Disponível em cidades com operação ativa. <strong>Itatinga/SP</strong> aberta agora.
          </p>
        </div>
      </Section>

      {/* ═══ DEPOIMENTOS ═══ */}
      <Section bg={THEME.white}>
        <div className="text-center mb-14">
          <SectionLabel text="Quem já usa" />
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: THEME.dark }}>
            Resultados reais de quem confiou no ItaSuper
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {testimonials.map((t, i) => (
            <div key={i} className="rounded-2xl p-6 border relative overflow-hidden" style={{ borderColor: THEME.border }}>
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: THEME.muted }}>"{t.text}"</p>
              <p className="text-sm font-bold" style={{ color: THEME.dark }}>{t.name}</p>
              <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-30" style={{ background: THEME.primaryLight }} />
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ FAQ ═══ */}
      <Section bg={THEME.grayBg}>
        <div className="text-center mb-14">
          <SectionLabel text="Tire suas dúvidas" />
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

      {/* ═══ CTA FINAL ═══ */}
      <section className="px-4 py-16 sm:py-24" style={{ background: THEME.primary }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
            Cada minuto sem o ItaSuper é um pedido que você perde.
          </h2>
          <p className="text-base text-white/80 mb-8 max-w-xl mx-auto">
            Cadastre-se agora e comece a receber pedidos em até 24h.
            Sem contrato. Sem mensalidade. Cancele quando quiser.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="gap-2 rounded-full font-bold text-base px-8 shadow-lg transition-all hover:shadow-xl" style={{ background: THEME.white, color: THEME.primary }}
              onMouseEnter={(e) => { e.currentTarget.style.background = THEME.grayBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = THEME.white; }}
              onClick={() => navigate("/cadastro-lojista")}
            >
              <Store className="h-5 w-5" />
              Cadastrar minha loja agora
            </Button>
            <Button size="lg" variant="outline" className="gap-2 rounded-full font-bold text-base px-8 text-white transition-all" style={{ borderColor: "rgba(255,255,255,0.5)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              onClick={() => navigate("/cadastro-entregador")}
            >
              <Bike className="h-5 w-5" />
              Ser motoboy
            </Button>
          </div>
          <p className="text-sm text-white/60 mt-8">
            Já é parceiro?{" "}
            <button onClick={() => navigate("/portal-parceiro")} className="text-white font-bold underline underline-offset-4 hover:text-white/90">
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
              © {new Date().getFullYear()} <strong>ItaSuper</strong> — Cardápio digital para lojistas de todo o Brasil
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
    <div className="rounded-2xl border overflow-hidden transition-all" style={{ background: THEME.white, borderColor: THEME.border }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left">
        <span className="font-bold text-sm pr-4" style={{ color: THEME.dark }}>{question}</span>
        <ChevronRight className={`h-5 w-5 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`} style={{ color: THEME.muted }} />
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
