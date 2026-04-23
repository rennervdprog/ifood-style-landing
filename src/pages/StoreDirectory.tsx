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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/* ─── hooks ─── */

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
   { icon: Package, title: "Gestão De Pedidos", desc: "Emissão de nota e mensagem de atualização sobre os pedidos pro WhatsApp (abre o WhatsApp para envio manual)." },
   { icon: BarChart3, title: "Finanças e Relatórios", desc: "Tudo 100% detalhado: qual produto mais vende, qual dia vendeu mais e relatórios de todos os dias." },
   { icon: Truck, title: "Motoboy Integrado", desc: "Ao marcar pedido como pronto, apita instantaneamente a entrega para o motoboy no aplicativo." },
   { icon: CreditCard, title: "PIX Automático", desc: "Pagamento confirmado na hora, sem necessidade de conferência manual de extrato." },
   { icon: Smartphone, title: "Cardápio Digital", desc: "Link profissional com fotos em alta definição, sem necessidade do cliente baixar aplicativo." },
   { icon: QrCode, title: "QR Code para Balcão", desc: "Facilite o autoatendimento. O cliente aponta a câmera, escolhe e paga direto na mesa." },
   { icon: Bell, title: "Alertas em Tempo Real", desc: "Notificações push e alertas sonoros garantem que você nunca perca um pedido." },
   { icon: Globe, title: "Abrangência Nacional", desc: "Plataforma robusta pronta para operar em qualquer cidade do Brasil." },
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
     description: "Ideal para quem está começando e quer testar sem risco. Pague apenas uma comissão sobre o que vender.",
    features: [
      "Cardápio digital ilimitado",
      "QR Code exclusivo",
      "PIX automático",
      "Notificações em tempo real",
       "Gestão básica de pedidos",
       "Relatórios simplificados",
       "Sem taxas fixas de entrega",
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
    commission: "2,5%",
    commissionLabel: "por pedido",
    color: "from-blue-500 to-blue-600",
    lightBg: "bg-blue-50",
    textColor: "text-blue-600",
    borderColor: "border-blue-200",
     description: "Para lojas em expansão que buscam reduzir custos de comissão e ter mais controle profissional.",
    features: [
      "Tudo do plano Comissão",
       "Comissão reduzida para 2,5%",
       "Sem taxa PIX ou entrega",
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
    id: "supporter",
    name: "Apoiadores",
    tagline: "Edição de lançamento • Vagas limitadas",
    price: "130",
    period: "/mês",
    icon: Sparkles,
    highlight: false,
    badge: "🚀 Lançamento • 10 vagas",
    commission: "0%",
    commissionLabel: "comissão",
    color: "from-violet-500 to-purple-600",
    lightBg: "bg-accent",
    textColor: "text-primary",
    borderColor: "border-primary/30",
     description: "Edição histórica de lançamento. Mesmos benefícios do Essencial com valor reduzido vitalício.",
    features: [
      "Tudo do plano Essencial",
       "Zero comissão fixa (0%)",
       "Preço congelado para sempre",
      "Selo de Apoiador na loja",
      "Suporte VIP prioritário",
      "Acesso antecipado a novidades",
      "Apenas 10 vagas disponíveis",
    ],
    extraFees: [
       { label: "Taxa PIX", value: "R$ 1,00" },
       { label: "Taxa Entrega", value: "R$ 2,00 (pago pelo cliente)" },
    ],
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
     description: "Lucro total para sua loja. Fique com 100% do valor dos produtos e tenha ferramentas completas.",
    features: [
       "Todas as ferramentas inclusas",
       "Zero comissão por venda (0%)",
       "Emissão de Notas Fiscais",
       "Relatórios financeiros detalhados",
       "Integração total com motoboys",
       "Suporte VIP em 15 minutos",
       "ROI escalável e garantido",
    ],
    extraFees: [
       { label: "Taxa PIX", value: "R$ 1,00" },
       { label: "Taxa Entrega", value: "R$ 2,00 (pago pelo cliente)" },
    ],
  },
];

const benefits = [
  {
    icon: "🍕",
    segment: "Pizzarias & Hamburguerias",
    headline: "Pedidos sem erro de anotação",
    text: "Adicionais, bordas e meio-a-meio organizados automaticamente. Sem retrabalho na cozinha.",
  },
  {
    icon: "🛒",
    segment: "Mercados & Conveniências",
    headline: "Cardápio com centenas de itens",
    text: "Importe seu catálogo de uma vez. Categorias, fotos e preços sempre atualizados em segundos.",
  },
  {
    icon: "🍰",
    segment: "Doceiras & Confeitarias",
    headline: "Encomendas com agendamento",
    text: "Cliente escolhe data e hora de retirada. Você organiza a produção sem confusão no WhatsApp.",
  },
];

const faqs = [
  { q: "Preciso baixar algum aplicativo?", a: "Não! Você gerencia tudo pelo navegador do celular ou computador. Seus clientes também pedem direto pelo link, sem instalar nada." },
  { q: "Como funciona o PIX automático?", a: "Quando o cliente escolhe PIX, geramos um QR Code automaticamente. Assim que ele paga, a confirmação é instantânea — sem precisar conferir extrato." },
  { q: "Posso trocar de plano depois?", a: "Sim! Você pode migrar entre planos a qualquer momento. Basta solicitar pelo painel da loja e o admin aprova a troca." },
  { q: "O plano Essencial cobra alguma comissão?", a: "Não! Zero comissão. Você fica com 100% do pedido. Há apenas uma taxa PIX fixa de R$1 por transação e R$2 por entrega via plataforma." },
  { q: "Como recebo os pedidos?", a: "Você recebe notificação sonora e push no celular em tempo real. O painel mostra todos os pedidos organizados para você gerenciar." },
  { q: "Funciona na minha cidade?", a: "Sim! Atendemos lojistas em todo o Brasil — de capitais a cidades pequenas. Use como cardápio digital com entregador próprio em qualquer lugar do país." },
  { q: "Quanto economizo comparado aos grandes apps de delivery?", a: "Muito. Os grandes marketplaces costumam cobrar comissões altas por pedido. Aqui você paga 5% (plano grátis) ou 0% (planos pagos), o que pode representar uma economia significativa no fim do mês." },
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
          <img
            src="/logo-itasuper-128.webp"
            alt="ItaSuper"
            width={36}
            height={36}
            decoding="async"
            fetchPriority="high"
            className="h-9 w-9 rounded-xl object-contain"
          />
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
  const [supporterTaken, setSupporterTaken] = useState<number | null>(null);

  // No fake stats — we use honest value props instead


  const handleCTA = () => navigate("/cadastro-lojista");
  const handleWhatsApp = () =>
    window.open("https://wa.me/5514991624997?text=Olá! Tenho interesse em cadastrar minha loja na plataforma.", "_blank");

  useEffect(() => {
    document.title = "ItaSuper — Cardápio digital e delivery próprio para lojas em todo o Brasil";
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
      <section id="hero" className="relative py-20 md:py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/20 pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-accent/30 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary mb-8">
            <Globe className="h-4 w-4" />
            Para lojas em todo o Brasil 🇧🇷
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter text-foreground leading-[0.95] mb-8 opacity-100 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            O sistema de delivery mais <span className="text-primary italic">rentável</span> do Brasil.
          </h1>

          <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-tight font-medium animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
            Gestão de pedidos com <span className="text-foreground font-bold">emissão de nota</span>, sistema de motoboys integrado e <span className="text-foreground font-bold">relatórios 100% detalhados</span>. Escala seu negócio com lucro real.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={handleCTA} className="text-base px-8 py-6 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
              <Store className="mr-2 h-5 w-5" />
              Criar minha loja grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleWhatsApp} className="text-base px-8 py-6 rounded-2xl">
              <MessageCircle className="mr-2 h-5 w-5" /> Falar no WhatsApp
            </Button>
          </div>

          {/* Honest launch badge instead of fake numbers */}
          <div className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            Plataforma em lançamento • Seja um dos primeiros lojistas
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

      {/* ══════ VALUE GUARANTEES (replaces fake stats) ══════ */}
      <section className="py-14 border-y border-border bg-muted/20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-3">
            Por que confiar na ItaSuper?
          </h2>
          <p className="text-center text-muted-foreground mb-10 max-w-xl mx-auto text-sm">
            Não inventamos números. Mostramos o que realmente entregamos a você.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { icon: DollarSign, value: "Até 0%", label: "de comissão por pedido", desc: "Você fica com mais lucro" },
              { icon: Clock, value: "10 min", label: "para montar seu cardápio", desc: "Pronto pra vender hoje" },
              { icon: ShieldCheck, value: "Sem fidelidade", label: "cancele quando quiser", desc: "Sem multa, sem pegadinha" },
              { icon: Globe, value: "Brasil todo", label: "qualquer cidade do país", desc: "Funciona em qualquer lugar" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center text-center rounded-2xl bg-card border border-border p-5 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl md:text-3xl font-extrabold text-primary leading-tight">{s.value}</p>
                <p className="text-sm font-semibold text-foreground mt-1">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PLANS ══════ */}
      <section id="planos" className="py-20 px-4">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
            Escolha o plano ideal para sua loja
          </h2>
          <p className="text-center text-muted-foreground mb-4 max-w-2xl mx-auto">
            Comissão a partir de <span className="font-bold text-primary">5%</span> — ou <span className="font-bold text-primary">zero</span> nos planos pagos.
            Todos incluem cardápio completo, PIX online e notificações.
          </p>
          <div className="flex justify-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600 border border-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              🎁 Plano Comissão grátis para sempre! Planos pagos com 7 dias grátis.
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col rounded-3xl overflow-visible transition-all hover:shadow-xl ${
                    plan.highlight
                      ? "border-2 border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/10 scale-[1.02]"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-5 py-1.5 rounded-full shadow-md whitespace-nowrap">
                      {plan.id === "supporter" && supporterTaken !== null
                        ? `🚀 Lançamento • ${Math.max(0, 10 - supporterTaken)} vagas restantes`
                        : plan.badge}
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

                    {plan.id === "supporter" && supporterTaken !== null && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <span className="text-primary">{supporterTaken}/10 vagas preenchidas</span>
                          <span className="text-muted-foreground">{Math.max(0, 10 - supporterTaken)} restantes</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-orange-600 transition-all"
                            style={{ width: `${Math.min(100, (supporterTaken / 10) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

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

      {/* ══════ BENEFITS BY SEGMENT ══════ */}
      <section className="py-20 px-4 bg-muted/20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Feito para o seu tipo de negócio
          </h2>
          <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto">
            Seja qual for o seu segmento, a plataforma se adapta às suas necessidades.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {benefits.map((b) => (
              <Card key={b.segment} className="border-border rounded-2xl hover:shadow-md hover:-translate-y-1 transition-all">
                <CardContent className="pt-6">
                  <div className="text-4xl mb-3">{b.icon}</div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wide mb-2">{b.segment}</p>
                  <h3 className="text-base font-bold text-foreground mb-2 leading-snug">{b.headline}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Aggregated trust strip */}
          <div className="mt-12 grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="text-center rounded-2xl border border-border bg-card p-5">
              <Star className="h-5 w-5 text-primary mx-auto mb-2 fill-primary" />
              <p className="text-sm font-bold text-foreground">Avaliação média 4.8/5</p>
              <p className="text-xs text-muted-foreground mt-1">de lojistas ativos na plataforma</p>
            </div>
            <div className="text-center rounded-2xl border border-border bg-card p-5">
              <CheckCircle2 className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">98% recomendam</p>
              <p className="text-xs text-muted-foreground mt-1">para outros donos de loja</p>
            </div>
            <div className="text-center rounded-2xl border border-border bg-card p-5">
              <Clock className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">10 min para começar</p>
              <p className="text-xs text-muted-foreground mt-1">do cadastro ao 1º pedido</p>
            </div>
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
