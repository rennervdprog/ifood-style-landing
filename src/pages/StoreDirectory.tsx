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
  ChevronDown, ArrowDown, Banknote, Target, Trophy, Headphones,
  ShoppingBag, LayoutDashboard, Truck
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

/* ──────────────────── Navbar ──────────────────── */
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
          {isLoggedIn ? (
            <Button className="rounded-full font-bold text-sm px-6 text-white shadow-lg gap-2" style={{ background: THEME.primary }} onClick={() => onNavigate("/pedidos")}>
              <ShoppingBag className="h-4 w-4" />
              Meus Pedidos
            </Button>
          ) : (
            <>
              <button onClick={() => onNavigate("/portal-parceiro")} className="text-sm font-semibold transition-colors" style={{ color: THEME.muted }}
                onMouseEnter={(e) => (e.currentTarget.style.color = THEME.primary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = THEME.muted)}
              >Já sou parceiro</button>
              <Button className="rounded-full font-bold text-sm px-6 text-white shadow-lg" style={{ background: THEME.primary }} onClick={() => onNavigate("/cadastro-lojista")}>
                Cadastrar grátis
              </Button>
            </>
          )}
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
          {isLoggedIn ? (
            <Button className="w-full rounded-full font-bold mt-2 text-white gap-2" style={{ background: THEME.primary }} onClick={() => { setOpen(false); onNavigate("/pedidos"); }}>
              <ShoppingBag className="h-4 w-4" />
              Meus Pedidos
            </Button>
          ) : (
            <>
              <button onClick={() => { setOpen(false); onNavigate("/portal-parceiro"); }} className="block w-full text-left py-3 text-sm font-semibold" style={{ color: THEME.primary }}>Já sou parceiro</button>
              <Button className="w-full rounded-full font-bold mt-2 text-white" style={{ background: THEME.primary }} onClick={() => { setOpen(false); onNavigate("/cadastro-lojista"); }}>
                Cadastrar minha loja
              </Button>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

/* ──────────────────── Section ──────────────────── */
const Section = ({ children, id, bg = THEME.white, className = "" }: { children: React.ReactNode; id?: string; bg?: string; className?: string }) => (
  <section id={id} className={`px-4 py-20 sm:py-32 ${className}`} style={{ background: bg }}>
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
        if (profile?.role === "lojista") {
          navigate("/admin", { replace: true });
          return;
        }
        if (profile?.role === "motoboy") {
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
    { icon: MessageSquare, title: "Chega de perder pedidos", desc: "Pedidos organizados com notificação instantânea. Nada mais perdido no WhatsApp." },
    { icon: BarChart3, title: "Financeiro na sua mão", desc: "Acompanhe vendas, repasses e comissões em tempo real pelo celular." },
    { icon: Globe, title: "Seu cardápio digital", desc: "Link exclusivo da sua loja, bonito e profissional — funciona em qualquer cidade." },
  ];

  const howItWorks = [
    { step: "1", icon: Store, title: "Cadastre em 2 minutos", desc: "Preencha seus dados e escolha seu plano." },
    { step: "2", icon: Smartphone, title: "Monte seu cardápio", desc: "Adicione produtos com fotos, preços e adicionais." },
    { step: "3", icon: Package, title: "Receba pedidos", desc: "Notificação instantânea no celular a cada novo pedido." },
    { step: "4", icon: DollarSign, title: "Receba e lucre", desc: "Dinheiro, cartão ou PIX — direto na sua conta." },
  ];

  const features = [
    { icon: Smartphone, title: "Cardápio Profissional", desc: "Menu com fotos, categorias, adicionais e personalização completa" },
    { icon: Package, title: "Gestão de Pedidos", desc: "Receba, confirme e acompanhe cada pedido em tempo real" },
    { icon: BarChart3, title: "Painel Financeiro", desc: "Vendas, comissões e repasses — tudo transparente" },
    { icon: Tag, title: "Cupons Ilimitados", desc: "Crie cupons de desconto para atrair e fidelizar clientes" },
    { icon: Clock, title: "Horários Flexíveis", desc: "Configure por dia da semana. Abra e feche quando quiser" },
    { icon: CreditCard, title: "Dinheiro, Cartão & PIX", desc: "Aceite todos os meios de pagamento. PIX integrado em todos os planos*" },
    { icon: ShieldCheck, title: "Entrega Segura", desc: "Código de coleta e PIN para cada entrega — segurança total" },
    { icon: Award, title: "Programa de Fidelidade", desc: "Clientes acumulam pontos e trocam por descontos. Configure no painel" },
    { icon: Globe, title: "Qualquer Cidade do Brasil", desc: "Use como cardápio digital com entregador próprio em qualquer lugar" },
  ];

  const motoboyBenefits = [
    { icon: Banknote, value: "R$", title: "Ganho por entrega", desc: "Valor claro e transparente por cada corrida" },
    { icon: Clock, value: "0", title: "Horário fixo", desc: "Você decide quando e quanto quer rodar" },
    { icon: Navigation, value: "GPS", title: "Corridas automáticas", desc: "Receba entregas sem precisar procurar" },
    { icon: TrendingUp, value: "📊", title: "Painel completo", desc: "Histórico de ganhos e saques rápidos" },
  ];

  const testimonials = [
    { name: "Lojista", business: "Restaurante parceiro", role: "lojista", stars: 5, text: "Antes eu perdia pedidos no WhatsApp. Agora recebo tudo organizado e consigo focar na cozinha." },
    { name: "Lojista", business: "Doceria parceira", role: "lojista", stars: 5, text: "O cardápio digital ficou lindo e profissional. Meus clientes adoram pedir pelo link." },
    { name: "Motoboy", business: "Entregador parceiro", role: "motoboy", stars: 5, text: "Escolho meus horários, ganho por entrega e o pagamento é transparente." },
  ];

  const faq = [
    {
      q: "Quais são os planos?",
      a: "Plano Essencial: R$180/mês + R$1 por pedido PIX + R$2 por entrega. Plano Crescimento: R$100/mês + 2,5% por pedido (PIX já incluso). Ambos com 7 dias grátis e todas as ferramentas."
    },
    {
      q: "Qual a diferença entre eles?",
      a: "No Essencial você paga mensalidade maior e taxas fixas pequenas (R$1 + R$2). No Crescimento você paga mensalidade menor e uma taxa percentual de 2,5% por pedido, sem cobranças extras. As ferramentas são as mesmas."
    },
    {
      q: "O que significa R$1 + R$2 no Essencial?",
      a: "R$1 é a taxa operacional do PIX por pedido. R$2 é o split de plataforma por entrega. Só são cobrados quando o cliente paga via PIX. Pedidos em dinheiro ou cartão não têm essa taxa."
    },
    {
      q: "E no Crescimento, tem taxa extra no PIX?",
      a: "Não. No Crescimento, o custo do PIX já está incluso nos 2,5% por pedido. Sem surpresas."
    },
    {
      q: "Funciona na minha cidade?",
      a: "Sim, em todo o Brasil. Fora de Itatinga/SP, você usa seu próprio entregador. Em Itatinga, temos motoboys da plataforma."
    },
    {
      q: "O que vem incluso nos dois planos?",
      a: "Cardápio digital, PIX integrado, programa de fidelidade, cupons, banners promocionais e painel financeiro completo."
    },
    {
      q: "Como recebo meu dinheiro?",
      a: "Dinheiro e cartão: direto do cliente. PIX: cai na sua conta automaticamente, já descontada a taxa do seu plano."
    },
    {
      q: "Posso trocar de plano?",
      a: "Sim, a qualquer momento pelo painel. O valor já pago é recalculado proporcionalmente."
    },
    {
      q: "Tem contrato ou multa?",
      a: "Não. Cancele quando quiser, sem multa e sem fidelidade."
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: THEME.white, color: THEME.dark }}>
      <Navbar onNavigate={navigate} isLoggedIn={!!user} />

      {/* ═══ HERO — Clean & Bold ═══ */}
      <section id="hero" className="relative overflow-hidden px-4 pt-20 pb-24 sm:pt-32 sm:pb-36" style={{ background: `linear-gradient(135deg, ${THEME.dark} 0%, #2D1810 50%, ${THEME.primaryDark} 100%)` }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 70% 30%, rgba(255,107,0,0.4), transparent 50%), radial-gradient(circle at 20% 80%, rgba(255,107,0,0.2), transparent 50%)" }} />
        <div className="max-w-4xl mx-auto relative text-center">
          {/* Static pill */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-10" style={{ background: "rgba(255,107,0,0.15)", color: THEME.primary, border: `1px solid rgba(255,107,0,0.2)` }}>
            <MapPin className="h-3.5 w-3.5" />
            Motoboys inclusos em Itatinga/SP
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] text-white">
            Delivery digital{" "}
            <span style={{ color: THEME.primary }}>para sua loja.</span>
          </h1>

          <p className="text-lg sm:text-xl mt-8 leading-relaxed max-w-2xl mx-auto text-white/60">
            Cardápio profissional, pedidos organizados e pagamentos automáticos — a partir de R$100/mês. <strong className="text-white/80">7 dias grátis!</strong>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-12">
            <Button size="lg" className="gap-2 rounded-full font-bold text-base px-10 py-6 text-white shadow-2xl transition-all hover:scale-105 hover:shadow-orange-500/30" style={{ background: THEME.primary }}
              onClick={() => navigate("/cadastro-lojista")}
            >
              <Store className="h-5 w-5" />
              Cadastrar minha loja — É grátis
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button size="lg" className="gap-2 rounded-full font-bold text-base px-8 py-6 transition-all hover:scale-105" style={{ background: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }}
              onClick={() => navigate("/cadastro-entregador")}
            >
              <Bike className="h-5 w-5" />
              Quero ser motoboy
            </Button>
          </div>

          {/* Trust bar */}
          <div className="flex flex-wrap items-center gap-8 justify-center mt-12">
            {[
              { icon: CheckCircle2, text: "Sem cartão de crédito" },
              { icon: Timer, text: "Aprovação em 24h" },
              { icon: ShieldCheck, text: "Cancele quando quiser" },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm font-medium text-white/50">
                <t.icon className="h-4 w-4" style={{ color: THEME.primary }} />
                {t.text}
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-3 gap-8 max-w-md mx-auto">
            {[
              { value: "100%", label: "Digital" },
              { value: "0%", label: "Taxa de adesão" },
              { value: "7", label: "Dias grátis" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-black" style={{ color: THEME.primary }}>{s.value}</div>
                <div className="text-xs font-medium text-white/40 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-6 w-6 text-white/20" />
        </div>
      </section>

      {/* ═══ PAIN POINTS — 3 columns, solution-only ═══ */}
      <Section id="vantagens" bg={THEME.white}>
        <div className="text-center mb-16">
          <SectionLabel text="Vantagens" />
          <h2 className="text-2xl sm:text-4xl font-black" style={{ color: THEME.dark }}>
            Por que lojistas escolhem o <span style={{ color: THEME.primary }}>ItaSuper</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {painPoints.map((p, i) => (
            <div key={i} className="text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: THEME.primaryLight }}>
                <p.icon className="h-7 w-7" style={{ color: THEME.primary }} />
              </div>
              <h3 className="font-bold text-base mb-2" style={{ color: THEME.dark }}>{p.title}</h3>
              <p className="text-sm" style={{ color: THEME.muted }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ COMO FUNCIONA ═══ */}
      <Section id="como-funciona" bg={THEME.grayBg}>
        <div className="text-center mb-16">
          <SectionLabel text="4 passos" />
          <h2 className="text-2xl sm:text-4xl font-black" style={{ color: THEME.dark }}>
            Do cadastro ao primeiro pedido
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {howItWorks.map((s, i) => (
            <div key={s.step} className="relative rounded-2xl p-5 border text-center group transition-all hover:shadow-lg hover:-translate-y-1" style={{ background: THEME.white, borderColor: THEME.border }}>
              <div className="text-4xl font-black mb-4" style={{ color: THEME.primary, opacity: 0.2 }}>{s.step}</div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: THEME.primaryLight }}>
                <s.icon className="h-5 w-5" style={{ color: THEME.primary }} />
              </div>
              <h3 className="font-bold text-sm mb-1" style={{ color: THEME.dark }}>{s.title}</h3>
              <p className="text-xs" style={{ color: THEME.muted }}>{s.desc}</p>
              {i < howItWorks.length - 1 && (
                <ArrowRight className="hidden lg:block absolute top-1/2 -right-4 h-5 w-5 -translate-y-1/2" style={{ color: THEME.border }} />
              )}
            </div>
          ))}
        </div>

        {/* Nota Itatinga vs Brasil — compacta */}
        <div className="max-w-3xl mx-auto mt-12 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 text-sm" style={{ background: THEME.primaryLight, border: `1px solid rgba(255,107,0,0.15)` }}>
          <span style={{ color: THEME.muted }}><MapPin className="h-3.5 w-3.5 inline mr-1" style={{ color: THEME.primary }} /><strong style={{ color: THEME.dark }}>Itatinga/SP</strong> — motoboy da plataforma incluído</span>
          <span style={{ color: THEME.muted }}><MapPin className="h-3.5 w-3.5 inline mr-1" style={{ color: THEME.primary }} /><strong style={{ color: THEME.dark }}>Brasil</strong> — use seu próprio entregador</span>
        </div>

        <div className="text-center mt-12">
          <Button size="lg" className="gap-2 rounded-full font-bold px-10 text-white shadow-lg transition-all hover:shadow-xl hover:scale-105" style={{ background: THEME.primary }}
            onClick={() => navigate("/cadastro-lojista")}
          >
            Começar agora — é grátis
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </Section>

      {/* ═══ PLANOS — Two plan cards ═══ */}
      <Section id="planos" bg={THEME.white}>
        <div className="text-center mb-12">
          <SectionLabel text="Planos" />
          <h2 className="text-2xl sm:text-4xl font-black" style={{ color: THEME.dark }}>
            Escolha o plano ideal <span style={{ color: THEME.primary }}>para sua loja.</span>
          </h2>
          <p className="text-sm mt-3 max-w-lg mx-auto" style={{ color: THEME.muted }}>
            Dois planos flexíveis. Sem contrato, sem multa. Troque quando quiser.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold" style={{ background: THEME.greenLight, color: THEME.green, border: `1px solid rgba(22,163,74,0.2)` }}>
            <Sparkles className="h-3.5 w-3.5" />
            🎁 7 dias grátis em todos os planos!
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Plano Essencial (Fixo) */}
          <div className="rounded-3xl overflow-hidden shadow-xl border-2 transition-all hover:shadow-2xl" style={{ borderColor: THEME.border }}>
            <div className="px-6 py-8 text-center" style={{ background: THEME.grayBg }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4" style={{ background: THEME.white, color: THEME.muted, border: `1px solid ${THEME.border}` }}>
                <Package className="h-3.5 w-3.5" /> Ideal para alto volume
              </div>
              <h3 className="text-lg font-black" style={{ color: THEME.dark }}>Plano Essencial</h3>
              <div className="mt-3">
                <span className="text-4xl font-black" style={{ color: THEME.dark }}>R$180</span>
                <span className="text-sm font-medium" style={{ color: THEME.muted }}>/mês</span>
              </div>
              <p className="text-xs mt-2 font-semibold" style={{ color: THEME.green }}>+ R$1/pedido PIX + R$2/entrega</p>
              <p className="text-[10px] mt-1 font-bold" style={{ color: THEME.green }}>🎁 Teste grátis por 7 dias</p>
            </div>
            <div className="px-6 py-6" style={{ background: THEME.white }}>
              <ul className="space-y-2.5">
              {[
                  "Cardápio digital profissional",
                  "Gestão de pedidos em tempo real",
                  "PIX integrado (R$1/pedido + R$2/entrega)",
                  "Dinheiro e cartão na entrega",
                  "Painel financeiro completo",
                  "Programa de Fidelidade",
                  "Cupons ilimitados",
                  "Banners promocionais",
                  "Horários flexíveis",
                  "Motoboy próprio ou da plataforma**",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-xs" style={{ color: THEME.dark }}>
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: THEME.green }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full rounded-full font-bold text-sm py-5 mt-6 transition-all hover:scale-[1.02]" style={{ background: THEME.dark, color: "white" }}
                onClick={() => navigate("/cadastro-lojista")}
              >
                Começar grátis por 7 dias
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Plano Crescimento (Híbrido) */}
          <div className="rounded-3xl overflow-hidden shadow-xl border-2 transition-all hover:shadow-2xl relative" style={{ borderColor: THEME.primary }}>
            <div className="absolute top-0 left-0 right-0 text-center py-1 text-xs font-bold text-white" style={{ background: THEME.primary }}>
              ⭐ Mais popular
            </div>
            <div className="px-6 py-8 pt-10 text-center" style={{ background: `linear-gradient(135deg, ${THEME.dark}, #2D1810)` }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4" style={{ background: "rgba(255,107,0,0.15)", color: THEME.primary }}>
                <TrendingUp className="h-3.5 w-3.5" /> Ideal para começar
              </div>
              <h3 className="text-lg font-black text-white">Plano Crescimento</h3>
              <div className="mt-3">
                <span className="text-4xl font-black text-white">R$100</span>
                <span className="text-sm font-medium text-white/60">/mês</span>
              </div>
              <p className="text-xs mt-2 font-semibold" style={{ color: THEME.primary }}>+ 2,5% por pedido entregue</p>
              <p className="text-[10px] mt-1 font-bold" style={{ color: THEME.green }}>🎁 Teste grátis por 7 dias</p>
            </div>
            <div className="px-6 py-6" style={{ background: THEME.white }}>
              <ul className="space-y-2.5">
                {[
                  "Tudo do Plano Essencial",
                  "PIX integrado (taxa inclusa nos 2,5%)",
                  "Sem taxa fixa adicional por pedido",
                  "Ideal para quem está começando",
                  "Motoboy próprio ou da plataforma*",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-xs" style={{ color: THEME.dark }}>
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: THEME.green }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full rounded-full font-bold text-sm py-5 mt-6 text-white shadow-lg transition-all hover:scale-[1.02]" style={{ background: THEME.primary }}
                onClick={() => navigate("/cadastro-lojista")}
              >
                Começar grátis por 7 dias
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        <div className="text-center text-xs mt-6 space-y-1" style={{ color: THEME.muted }}>
          <p>* PIX no Plano Essencial: taxa operacional de R$1 por pedido + R$2 de plataforma por entrega. No Plano Crescimento, incluso nos 2,5%.</p>
          <p>** Motoboys da plataforma disponíveis em Itatinga/SP. Demais cidades: use seu próprio entregador.</p>
        </div>

        {/* Plan comparison highlights */}
        <div className="mt-16 max-w-3xl mx-auto grid sm:grid-cols-3 gap-8">
          {[
            { icon: DollarSign, title: "Sem taxa de adesão", desc: "Zero custo para começar. Pague apenas a mensalidade do plano escolhido." },
            { icon: Rocket, title: "Troque quando quiser", desc: "Upgrade ou downgrade sem multa. Adapte o plano ao momento da sua loja." },
            { icon: BarChart3, title: "Controle total", desc: "Painel com cada venda, assinatura e extrato detalhados." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl p-6 border transition-all hover:shadow-md" style={{ borderColor: THEME.border }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: THEME.primaryLight }}>
                <item.icon className="h-5 w-5" style={{ color: THEME.primary }} />
              </div>
              <h4 className="font-bold text-sm mb-1" style={{ color: THEME.dark }}>{item.title}</h4>
              <p className="text-xs leading-relaxed" style={{ color: THEME.muted }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ FUNCIONALIDADES — Clean grid ═══ */}
      <Section id="funcionalidades" bg={THEME.grayBg}>
        <div className="text-center mb-16">
          <SectionLabel text="Tudo incluso" />
          <h2 className="text-2xl sm:text-4xl font-black" style={{ color: THEME.dark }}>
            Ferramentas que grandes redes usam
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl p-6 border transition-all hover:shadow-lg hover:-translate-y-0.5 group" style={{ background: THEME.white, borderColor: THEME.border }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: THEME.primaryLight }}>
                <f.icon className="h-5 w-5" style={{ color: THEME.primary }} />
              </div>
              <h4 className="font-bold text-sm mb-1" style={{ color: THEME.dark }}>{f.title}</h4>
              <p className="text-xs leading-relaxed" style={{ color: THEME.muted }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ MOTOBOYS ═══ */}
      <Section id="motoboys" bg={THEME.white}>
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <SectionLabel text="Para Motoboys" />
            <h2 className="text-2xl sm:text-4xl font-black mb-5" style={{ color: THEME.dark }}>
              Ganhe dinheiro{" "}
              <span style={{ color: THEME.primary }}>no seu tempo.</span>
            </h2>
            <p className="text-base mb-5" style={{ color: THEME.muted }}>
              Sem patrão, sem horário fixo, sem vínculo. Rode quando quiser e ganhe por cada entrega.
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-10" style={{ background: THEME.primaryLight }}>
              <MapPin className="h-4 w-4" style={{ color: THEME.primary }} />
              <span style={{ color: THEME.muted }}>Ativo em <strong style={{ color: THEME.dark }}>Itatinga/SP</strong> — expansão em breve</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-10">
              {motoboyBenefits.map((b) => (
                <div key={b.title} className="rounded-xl p-4 border transition-all hover:shadow-md" style={{ borderColor: THEME.border }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: THEME.primaryLight }}>
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
            <p className="text-xs mt-3" style={{ color: THEME.muted }}>* Disponível para entregas em Itatinga/SP</p>
          </div>

          {/* Visual card — simplified */}
          <div className="relative">
            <div className="rounded-3xl p-10 text-center" style={{ background: `linear-gradient(135deg, ${THEME.dark}, #2D1810)` }}>
              <Bike className="h-16 w-16 mx-auto mb-6" style={{ color: THEME.primary }} />
              <h3 className="text-2xl font-black text-white mb-2">Entregador ItaSuper</h3>
              <p className="text-white/50 text-sm mb-10">Faça entregas, ganhe dinheiro</p>

              {/* Simple stats instead of emoji boxes */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: "R$", label: "Por entrega" },
                  { value: "0", label: "Taxa de cadastro" },
                  { value: "GPS", label: "Automático" },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="text-2xl font-black mb-1" style={{ color: THEME.primary }}>{item.value}</div>
                    <div className="text-xs text-white/40">{item.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-5 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Novas cidades em breve — cadastre-se e seja notificado</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ DEPOIMENTOS — Spacious ═══ */}
      <Section bg={THEME.grayBg}>
        <div className="text-center mb-16">
          <SectionLabel text="Quem já usa, aprova" />
          <h2 className="text-2xl sm:text-4xl font-black" style={{ color: THEME.dark }}>
            Resultados reais
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {testimonials.map((t, i) => (
            <div key={i} className="rounded-2xl p-7 border transition-all hover:shadow-lg" style={{ borderColor: THEME.border, background: THEME.white }}>
              <div className="text-4xl font-serif mb-3" style={{ color: THEME.primaryLight, lineHeight: 1 }}>❝</div>
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-5" style={{ color: THEME.muted }}>{t.text}</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: t.role === "motoboy" ? THEME.green : THEME.primary }}>
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
        <div className="text-center mb-16">
          <SectionLabel text="Dúvidas?" />
          <h2 className="text-2xl sm:text-4xl font-black" style={{ color: THEME.dark }}>
            Perguntas frequentes
          </h2>
        </div>

        <div className="max-w-2xl mx-auto space-y-3">
          {faq.map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </Section>

      {/* ═══ CTA FINAL — Clean ═══ */}
      <section className="px-4 py-20 sm:py-32 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${THEME.dark} 0%, #2D1810 50%, ${THEME.primaryDark} 100%)` }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, rgba(255,107,0,0.4), transparent 50%)" }} />
        <div className="max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-5">
            Pronto para <span style={{ color: THEME.primary }}>começar?</span>
          </h2>
          <p className="text-base text-white/50 mb-12 max-w-md mx-auto">
            Planos a partir de R$100/mês. Sem contrato. Sem multa.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="gap-2 rounded-full font-bold text-base px-10 py-6 shadow-2xl transition-all hover:scale-105" style={{ background: THEME.primary, color: "white" }}
              onClick={() => navigate("/cadastro-lojista")}
            >
              <Store className="h-5 w-5" />
              Cadastrar minha loja — É grátis
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button size="lg" className="gap-2 rounded-full font-bold text-base px-8 py-6 transition-all hover:scale-105" style={{ background: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }}
              onClick={() => navigate("/cadastro-entregador")}
            >
              <Bike className="h-5 w-5" />
              Ser motoboy
            </Button>
          </div>
          <p className="text-sm text-white/30 mt-10">
            Já é parceiro?{" "}
            <button onClick={() => navigate("/portal-parceiro")} className="text-white/70 font-bold underline underline-offset-4 hover:text-white transition-colors">
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
        <div className="px-6 pb-6 -mt-1">
          <p className="text-sm leading-7" style={{ color: THEME.muted }}>{answer}</p>
        </div>
      )}
    </div>
  );
};

export default StoreDirectory;
