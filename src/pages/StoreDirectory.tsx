import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap, Store, Bike, ShieldCheck, Smartphone, TrendingUp, Users,
  ArrowRight, CheckCircle2, Star, MapPin, Clock, CreditCard,
  BarChart3, MessageSquare, Tag, Package, Navigation, ChevronRight,
  Menu, X, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ──────────────────── Landing-scoped blue theme ──────────────────── */
const THEME = {
  primary: "#EA1D2C",
  primaryDark: "#C41622",
  primaryLight: "#FDE8EA",
  grayBg: "#F0F2F5",
  white: "#FFFFFF",
} as const;

/* ──────────────────── Navbar ──────────────────── */
const Navbar = ({ onNavigate }: { onNavigate: (path: string) => void }) => {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Como funciona", href: "#como-funciona" },
    { label: "Para Lojistas", href: "#lojistas" },
    { label: "Para Motoboys", href: "#motoboys" },
  ];

  const scrollTo = (id: string) => {
    setOpen(false);
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{ background: "rgba(255,255,255,0.95)", borderColor: "#E4E6EB" }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
        {/* Logo */}
        <button onClick={() => scrollTo("#hero")} className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: THEME.primary }}
          >
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight" style={{ color: "#1C1E21" }}>
            Ita<span style={{ color: THEME.primary }}>Super</span>
          </span>
        </button>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <button
              key={l.href}
              onClick={() => scrollTo(l.href)}
              className="text-sm font-semibold transition-colors"
              style={{ color: "#606770" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = THEME.primary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#606770")}
            >
              {l.label}
            </button>
          ))}
          <Button
            className="rounded-full font-bold text-sm px-6"
            style={{ background: THEME.primary }}
            onClick={() => onNavigate("/cadastro-lojista")}
          >
            Quero me cadastrar
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t px-4 pb-4 pt-2" style={{ borderColor: "#E4E6EB" }}>
          {links.map((l) => (
            <button
              key={l.href}
              onClick={() => scrollTo(l.href)}
              className="block w-full text-left py-3 text-sm font-semibold"
              style={{ color: "#606770" }}
            >
              {l.label}
            </button>
          ))}
          <Button
            className="w-full rounded-full font-bold mt-2"
            style={{ background: THEME.primary }}
            onClick={() => { setOpen(false); onNavigate("/cadastro-lojista"); }}
          >
            Quero me cadastrar
          </Button>
        </div>
      )}
    </nav>
  );
};

/* ──────────────────── Section wrapper ──────────────────── */
const Section = ({
  children, id, bg = THEME.white, className = ""
}: { children: React.ReactNode; id?: string; bg?: string; className?: string }) => (
  <section id={id} className={`px-4 py-16 sm:py-24 ${className}`} style={{ background: bg }}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);

/* ──────────────────── Main Component ──────────────────── */
const StoreDirectory = () => {
  const navigate = useNavigate();

  /* ── Feature cards data ── */
  const lojistaFeatures = [
    { icon: Smartphone, title: "Cardápio Digital", desc: "Menu online com fotos, categorias e personalização completa" },
    { icon: Package, title: "Gestão de Pedidos", desc: "Receba, confirme e acompanhe cada pedido em tempo real" },
    { icon: BarChart3, title: "Relatórios Financeiros", desc: "Acompanhe vendas, comissões e recebimentos diários" },
    { icon: Tag, title: "Cupons e Promoções", desc: "Crie campanhas de desconto para atrair mais clientes" },
    { icon: Bike, title: "Entrega Flexível", desc: "Use motoboys do ItaSuper ou seus próprios entregadores" },
    { icon: MessageSquare, title: "Chat com Cliente", desc: "Converse diretamente pelo app durante o pedido" },
  ];

  const motoboyFeatures = [
    { icon: Navigation, title: "Corridas Automáticas", desc: "Receba entregas da sua cidade sem precisar procurar" },
    { icon: CreditCard, title: "Ganhos Transparentes", desc: "Veja exatamente quanto ganha por cada entrega" },
    { icon: Clock, title: "Horário Flexível", desc: "Você decide quando quer rodar — sem horário fixo" },
    { icon: TrendingUp, title: "Painel de Ganhos", desc: "Histórico completo de corridas, ganhos e saques" },
    { icon: MapPin, title: "Sua Cidade", desc: "Entregas sempre perto de você, sem deslocamentos longos" },
    { icon: ShieldCheck, title: "Saques Rápidos", desc: "Solicite saques quando quiser, direto na sua conta" },
  ];

  const testimonials = [
    { name: "Carlos — Espetinhos do Carlão", stars: 5, text: "Antes eu perdia pedidos no WhatsApp. Agora recebo tudo organizado e o motoboy chega rápido. Minhas vendas aumentaram 40%." },
    { name: "Fernanda — Doces da Fê", stars: 5, text: "O cardápio digital ficou lindo! Meus clientes adoram pedir pelo app. E o suporte é muito atencioso." },
    { name: "Lucas — Motoboy", stars: 5, text: "Comecei a rodar pelo ItaSuper há 2 meses. Ganho bem, escolho meus horários e o pagamento cai certinho." },
    { name: "Dona Maria — Marmitas da Maria", stars: 5, text: "Sou lojista há 30 anos e nunca pensei que iria ter um app. Foi muito fácil de usar. Recomendo!" },
  ];

  const howItWorksLojista = [
    { step: "1", icon: Store, title: "Cadastre sua loja", desc: "Preencha seus dados e monte seu cardápio digital em minutos" },
    { step: "2", icon: Smartphone, title: "Receba pedidos", desc: "Clientes pedem pelo app e você recebe no painel em tempo real" },
    { step: "3", icon: Bike, title: "Entregamos pra você", desc: "Motoboy aceita a corrida e leva o pedido até o cliente" },
  ];

  const howItWorksMotoboy = [
    { step: "1", icon: Users, title: "Crie seu perfil", desc: "Cadastro rápido com documento e veículo — sem burocracia" },
    { step: "2", icon: Navigation, title: "Aceite corridas", desc: "Receba pedidos perto de você e escolha quais quer fazer" },
    { step: "3", icon: CreditCard, title: "Receba na conta", desc: "Ganho por entrega com transparência total e saques rápidos" },
  ];

  return (
    <div className="min-h-screen" style={{ background: THEME.white, color: "#1C1E21" }}>
      <Navbar onNavigate={navigate} />

      {/* ═══ HERO ═══ */}
      <section
        id="hero"
        className="relative overflow-hidden px-4 pt-12 pb-8 sm:pt-20 sm:pb-16"
        style={{ background: `linear-gradient(135deg, ${THEME.primaryLight} 0%, ${THEME.white} 50%, ${THEME.grayBg} 100%)` }}
      >
        <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight" style={{ color: "#1C1E21" }}>
              A entrega mais rápida de{" "}
              <span style={{ color: THEME.primary }}>Itatinga</span>{" "}
              está aqui.
            </h1>
            <p className="text-base sm:text-lg mt-4 leading-relaxed max-w-lg mx-auto" style={{ color: "#606770" }}>
              Conectamos lojistas e motoboys em tempo real. Mais vendas para quem vende, mais corridas para quem entrega.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Button
                size="lg"
                className="gap-2 rounded-full font-bold text-base px-8 text-white shadow-lg transition-all hover:shadow-xl"
                style={{ background: THEME.primary }}
                onMouseEnter={(e) => (e.currentTarget.style.background = THEME.primaryDark)}
                onMouseLeave={(e) => (e.currentTarget.style.background = THEME.primary)}
                onClick={() => navigate("/cadastro-lojista")}
              >
                <Store className="h-5 w-5" />
                Sou Lojista — Quero vender mais
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 rounded-full font-bold text-base px-8 transition-all"
                style={{ borderColor: THEME.primary, color: THEME.primary }}
                onMouseEnter={(e) => { e.currentTarget.style.background = THEME.primaryLight; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                onClick={() => navigate("/cadastro-entregador")}
              >
                <Bike className="h-5 w-5" />
                Sou Motoboy — Quero mais corridas
              </Button>
            </div>

            <div className="flex items-center gap-2 justify-center mt-6">
              <MapPin className="h-4 w-4" style={{ color: THEME.primary }} />
              <span className="text-sm font-semibold" style={{ color: "#606770" }}>
                Disponível agora em <strong style={{ color: "#1C1E21" }}>Itatinga/SP</strong> · Novas cidades em breve
              </span>
            </div>
        </div>
      </section>

      {/* ═══ COMO FUNCIONA ═══ */}
      <Section id="como-funciona" bg={THEME.white}>
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: THEME.primary }}>
            Como funciona
          </p>
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: "#1C1E21" }}>
            Simples de começar, fácil de usar
          </h2>
        </div>

        <Tabs defaultValue="lojista" className="max-w-3xl mx-auto">
          <TabsList className="grid w-full grid-cols-2 rounded-full h-12 p-1" style={{ background: THEME.grayBg }}>
            <TabsTrigger
              value="lojista"
              className="rounded-full font-bold text-sm data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              style={{ ["--tw-shadow-color" as string]: THEME.primary }}
              data-active-bg={THEME.primary}
            >
              <Store className="h-4 w-4 mr-2" />
              Para Lojistas
            </TabsTrigger>
            <TabsTrigger
              value="motoboy"
              className="rounded-full font-bold text-sm data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <Bike className="h-4 w-4 mr-2" />
              Para Motoboys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lojista" className="mt-10">
            <div className="grid sm:grid-cols-3 gap-6">
              {howItWorksLojista.map((s) => (
                <div key={s.step} className="text-center group">
                  <div className="relative mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: THEME.primaryLight }}>
                    <s.icon className="h-7 w-7" style={{ color: THEME.primary }} />
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: THEME.primary }}>
                      {s.step}
                    </span>
                  </div>
                  <h3 className="font-bold text-base mb-1" style={{ color: "#1C1E21" }}>{s.title}</h3>
                  <p className="text-sm" style={{ color: "#606770" }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="motoboy" className="mt-10">
            <div className="grid sm:grid-cols-3 gap-6">
              {howItWorksMotoboy.map((s) => (
                <div key={s.step} className="text-center group">
                  <div className="relative mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: THEME.primaryLight }}>
                    <s.icon className="h-7 w-7" style={{ color: THEME.primary }} />
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: THEME.primary }}>
                      {s.step}
                    </span>
                  </div>
                  <h3 className="font-bold text-base mb-1" style={{ color: "#1C1E21" }}>{s.title}</h3>
                  <p className="text-sm" style={{ color: "#606770" }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </Section>

      {/* ═══ O QUE OFERECEMOS ═══ */}
      <Section id="lojistas" bg={THEME.grayBg}>
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: THEME.primary }}>
            Funcionalidades
          </p>
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: "#1C1E21" }}>
            Tudo que você precisa em um só lugar
          </h2>
        </div>

        <div className="mb-8">
          <h3 className="flex items-center gap-2 text-lg font-extrabold mb-6" style={{ color: "#1C1E21" }}>
            <Store className="h-5 w-5" style={{ color: THEME.primary }} />
            Para Lojistas
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lojistaFeatures.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-5 border transition-all hover:shadow-lg hover:-translate-y-0.5 group"
                style={{ background: THEME.white, borderColor: "#E4E6EB" }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-colors"
                  style={{ background: THEME.primaryLight }}
                >
                  <f.icon className="h-5 w-5" style={{ color: THEME.primary }} />
                </div>
                <h4 className="font-bold text-sm mb-1" style={{ color: "#1C1E21" }}>{f.title}</h4>
                <p className="text-xs leading-relaxed" style={{ color: "#606770" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div id="motoboys">
          <h3 className="flex items-center gap-2 text-lg font-extrabold mb-6 mt-12" style={{ color: "#1C1E21" }}>
            <Bike className="h-5 w-5" style={{ color: THEME.primary }} />
            Para Motoboys
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {motoboyFeatures.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-5 border transition-all hover:shadow-lg hover:-translate-y-0.5"
                style={{ background: THEME.white, borderColor: "#E4E6EB" }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: THEME.primaryLight }}
                >
                  <f.icon className="h-5 w-5" style={{ color: THEME.primary }} />
                </div>
                <h4 className="font-bold text-sm mb-1" style={{ color: "#1C1E21" }}>{f.title}</h4>
                <p className="text-xs leading-relaxed" style={{ color: "#606770" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══ SOCIAL PROOF ═══ */}
      <Section bg={THEME.white}>
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: THEME.primary }}>
            Quem já usa aprova
          </p>
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: "#1C1E21" }}>
            Histórias de quem faz o ItaSuper acontecer
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="rounded-2xl p-6 border relative overflow-hidden"
              style={{ borderColor: "#E4E6EB" }}
            >
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "#606770" }}>
                "{t.text}"
              </p>
              <p className="text-sm font-bold" style={{ color: "#1C1E21" }}>{t.name}</p>
              <div
                className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-30"
                style={{ background: THEME.primaryLight }}
              />
            </div>
          ))}
        </div>

        {/* Stats strip */}
        <div
          className="mt-12 rounded-2xl p-6 grid grid-cols-3 gap-4 text-center max-w-3xl mx-auto"
          style={{ background: THEME.primaryLight }}
        >
          {[
            { value: "50+", label: "Lojistas cadastrados" },
            { value: "1.200+", label: "Pedidos entregues" },
            { value: "4.9★", label: "Avaliação média" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl sm:text-3xl font-black" style={{ color: THEME.primary }}>{s.value}</div>
              <div className="text-xs font-semibold mt-1" style={{ color: "#606770" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ DISPONÍVEL EM ITATINGA ═══ */}
      <Section bg={THEME.grayBg}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ background: THEME.primaryLight }}>
            <MapPin className="h-8 w-8" style={{ color: THEME.primary }} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ color: "#1C1E21" }}>
            Disponível em Itatinga/SP
          </h2>
          <p className="text-base mb-8" style={{ color: "#606770" }}>
            Começamos por Itatinga e já estamos expandindo. Em breve sua cidade também terá o ItaSuper.
          </p>

          {/* Cities coming soon */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {["Pardinho", "Bofete", "Torre de Pedra", "Botucatu", "Avaré"].map((c) => (
              <span
                key={c}
                className="text-xs font-semibold px-4 py-1.5 rounded-full border"
                style={{ borderColor: "#D1D5DB", color: "#606770" }}
              >
                {c} — em breve
              </span>
            ))}
          </div>

          {/* Email capture */}
          <div
            className="rounded-2xl p-6 border max-w-md mx-auto"
            style={{ background: THEME.white, borderColor: "#E4E6EB" }}
          >
            <p className="text-sm font-bold mb-3" style={{ color: "#1C1E21" }}>
              Quer o ItaSuper na sua cidade?
            </p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#9CA3AF" }} />
                <input
                  type="email"
                  placeholder="Seu e-mail"
                  className="w-full pl-10 pr-3 py-2.5 rounded-full border text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", ["--tw-ring-color" as string]: THEME.primary }}
                />
              </div>
              <Button
                className="rounded-full font-bold px-5 text-white text-sm"
                style={{ background: THEME.primary }}
                onMouseEnter={(e) => (e.currentTarget.style.background = THEME.primaryDark)}
                onMouseLeave={(e) => (e.currentTarget.style.background = THEME.primary)}
              >
                Avise-me
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ CTA FINAL ═══ */}
      <section className="px-4 py-16 sm:py-24" style={{ background: THEME.primary }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
            Faça parte do ItaSuper hoje mesmo.
          </h2>
          <p className="text-base text-white/80 mb-8">
            É grátis para começar. Cadastro em menos de 2 minutos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="gap-2 rounded-full font-bold text-base px-8 shadow-lg transition-all hover:shadow-xl"
              style={{ background: THEME.white, color: THEME.primary }}
              onMouseEnter={(e) => { e.currentTarget.style.background = THEME.grayBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = THEME.white; }}
              onClick={() => navigate("/cadastro-lojista")}
            >
              <Store className="h-5 w-5" />
              Sou Lojista
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 rounded-full font-bold text-base px-8 text-white transition-all"
              style={{ borderColor: "rgba(255,255,255,0.5)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              onClick={() => navigate("/cadastro-entregador")}
            >
              <Bike className="h-5 w-5" />
              Sou Motoboy
            </Button>
          </div>
          <p className="text-sm text-white/60 mt-8">
            Já é parceiro?{" "}
            <button
              onClick={() => navigate("/parceiro")}
              className="text-white font-bold underline underline-offset-4 hover:text-white/90"
            >
              Faça login aqui
            </button>
          </p>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="px-4 py-10 border-t" style={{ borderColor: "#E4E6EB" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: THEME.primary }}>
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-extrabold" style={{ color: "#1C1E21" }}>
                Ita<span style={{ color: THEME.primary }}>Super</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-6 justify-center">
              {[
                { label: "Cadastro Lojista", path: "/cadastro-lojista" },
                { label: "Cadastro Motoboy", path: "/cadastro-entregador" },
                { label: "Login Parceiro", path: "/parceiro" },
              ].map((l) => (
                <button
                  key={l.path}
                  onClick={() => navigate(l.path)}
                  className="text-sm font-semibold transition-colors"
                  style={{ color: "#606770" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = THEME.primary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#606770")}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-6 text-center border-t" style={{ borderColor: "#E4E6EB" }}>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>
              © {new Date().getFullYear()} <strong>ItaSuper</strong> · Itatinga/SP — Todos os direitos reservados
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StoreDirectory;
