import { useState, useEffect, useRef } from "react";
import {
  Check,
  Star,
  Zap,
  ArrowRight,
  MessageCircle,
  Smartphone,
  QrCode,
  Clock,
  TrendingUp,
  Utensils,
  Bell,
  Shield,
  ChevronDown,
  Users,
  CreditCard,
  BarChart3,
  Gift,
  Truck,
  X,
  BadgePercent,
  Crown,
  Rocket,
  Sparkles,
  Package,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

/* ─── animated counter hook ─── */
function useCountUp(end: number, duration = 2000, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
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

/* ─── intersection observer hook ─── */
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

/* ─── plan data ─── */
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
    description: "Ideal para testar sem risco. Pague 5% apenas sobre as vendas realizadas.",
    features: [
      { text: "Cardápio digital ilimitado", included: true },
      { text: "WhatsApp de atualização", included: true },
      { text: "Gestão de pedidos básica", included: true },
      { text: "PIX automático", included: true },
      { text: "Sem taxas adicionais", included: true },
      { text: "Relatórios avançados", included: false },
      { text: "Emissão de Notas", included: false },
    ],
    extraFees: [],
  },
  {
    id: "hybrid",
    name: "Crescimento",
    tagline: "Taxas menores, mais ferramentas",
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
    description: "Reduza sua comissão pela metade com ferramentas de gestão profissional.",
    features: [
      { text: "Comissão reduzida (2,5%)", included: true },
      { text: "Relatórios financeiros detalhados", included: true },
      { text: "Destaque na vitrine", included: true },
      { text: "Banners promocionais", included: true },
      { text: "Sem taxa PIX ou entrega", included: true },
      { text: "Emissão de Notas", included: false },
    ],
    extraFees: [],
  },
  {
    id: "fixed",
    name: "Essencial",
    tagline: "Lucro total e gestão completa",
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
    description: "Fique com 100% do valor dos seus produtos. Gestão total e integração logística.",
    features: [
      { text: "Zero comissão por venda", included: true },
      { text: "Emissão de Nota Fiscal", included: true },
      { text: "Relatórios 100% detalhados", included: true },
      { text: "Motoboy Integrado (apita no app)", included: true },
      { text: "Suporte VIP Prioritário", included: true },
      { text: "Todas as ferramentas", included: true },
    ],
    extraFees: [
      { label: "Taxa PIX", value: "R$ 1,00/transação" },
      { label: "Taxa entrega plataforma", value: "R$ 2,00 (paga pelo cliente)" },
    ],
  },
  {
    id: "supporter",
    name: "Apoiador",
    tagline: "Edição Especial de Lançamento",
    price: "130",
    period: "/mês",
    icon: Sparkles,
    highlight: false,
    badge: "🚀 10 vagas limitadas",
    commission: "0%",
    commissionLabel: "comissão",
    color: "from-violet-500 to-purple-600",
    lightBg: "bg-violet-50",
    textColor: "text-violet-600",
    borderColor: "border-violet-200",
    description: "Mesmas regras do Essencial com preço congelado para sempre (apenas 10 primeiras lojas).",
    features: [
      { text: "Mesmos benefícios do Essencial", included: true },
      { text: "Preço fixo vitalício", included: true },
      { text: "Selo de Apoiador na loja", included: true },
      { text: "Suporte VIP", included: true },
    ],
    extraFees: [
      { label: "Taxa PIX", value: "R$ 1,00/transação" },
      { label: "Taxa entrega plataforma", value: "R$ 2,00 (paga pelo cliente)" },
    ],
  },
];

const painPoints = [
  { emoji: "📸", pain: "Manda foto do cardápio pelo WhatsApp", solution: "Link profissional com fotos e preços atualizados" },
  { emoji: "📝", pain: "Anota pedido na mão e erra", solution: "Pedidos organizados e detalhados automaticamente" },
  { emoji: "💸", pain: "Confere PIX no extrato um por um", solution: "Pagamento confirmado na hora, sem conferir nada" },
  { emoji: "🔇", pain: "Perde pedido porque não ouviu a mensagem", solution: "Alerta sonoro + notificação push no celular" },
];

const features = [
  { icon: Package, title: "Gestão De Pedidos", desc: "Emissão de nota e mensagem de atualização sobre os pedidos pro WhatsApp (abre o WhatsApp para envio manual)." },
  { icon: BarChart3, title: "Finanças e Relatórios", desc: "Tudo 100% detalhado: saiba qual produto mais vende, qual dia vendeu mais e tenha relatórios de todos os dias." },
  { icon: Truck, title: "Motoboy Integrado", desc: "Ao marcar pedido como pronto, um alerta sonoro avisa instantaneamente o motoboy no aplicativo." },
  { icon: CreditCard, title: "PIX Automático", desc: "Pagamento confirmado na hora, sem necessidade de conferência manual de extrato bancário." },
  { icon: Smartphone, title: "Cardápio no Celular", desc: "Link profissional com fotos em HD. O cliente abre e já pede, sem baixar nenhum app." },
  { icon: QrCode, title: "QR Code Exclusivo", desc: "Imprima e cole no balcão ou nas mesas. O cliente aponta a câmera e faz o pedido sozinho." },
  { icon: Bell, title: "Alerta Instantâneo", desc: "Notificação push e alerta sonoro no celular para você nunca perder um pedido novo." },
  { icon: Globe, title: "Brasil Inteiro", desc: "Plataforma robusta pronta para atender lojistas e motoboys em qualquer cidade do país." },
];

const steps = [
  { step: "01", title: "Cadastre sua loja", desc: "Preencha os dados básicos e escolha seu plano." },
  { step: "02", title: "Monte seu cardápio", desc: "Adicione categorias, produtos, fotos e preços." },
  { step: "03", title: "Compartilhe o link", desc: "Envie pelo WhatsApp, redes sociais ou imprima o QR Code." },
  { step: "04", title: "Receba pedidos!", desc: "Clientes pedem pelo celular e você recebe tudo organizado." },
];

const testimonials = [
  { name: "Maria S.", store: "Pizzaria do Sabor", text: "Meus clientes adoram pedir pelo cardápio digital. Não preciso mais anotar pedido por WhatsApp!", rating: 5, orders: "2.400+ pedidos" },
  { name: "João P.", store: "Hamburgueria Top", text: "Com o plano Essencial, cada pedido é lucro puro. O cardápio se paga no primeiro dia!", rating: 5, orders: "3.100+ pedidos" },
  { name: "Ana L.", store: "Doceria da Ana", text: "Montei meu cardápio em 10 minutos. É muito mais prático que mandar foto no WhatsApp.", rating: 5, orders: "1.800+ pedidos" },
];

const faqs = [
  { q: "Preciso baixar algum aplicativo?", a: "Não! Você gerencia tudo pelo navegador do celular ou computador. Seus clientes também pedem direto pelo link, sem instalar nada." },
  { q: "Como funciona o PIX automático?", a: "Quando o cliente escolhe PIX, geramos um QR Code automaticamente. Assim que ele paga, a confirmação é instantânea — sem precisar conferir extrato." },
  { q: "Posso trocar de plano depois?", a: "Sim! Você pode migrar entre planos a qualquer momento. Basta solicitar pelo painel da loja e o admin aprova a troca." },
  { q: "O plano Essencial cobra alguma comissão?", a: "Não! Zero comissão. Você fica com 100% do pedido. Há apenas uma taxa PIX fixa de R$1 por transação e R$2 por entrega via plataforma." },
  { q: "Como recebo os pedidos?", a: "Você recebe notificação sonora e push no celular em tempo real. O painel mostra todos os pedidos organizados para você gerenciar." },
];

/* ─── comparison table data ─── */
const comparisonRows = [
  { feature: "Cardápio digital", commission: true, hybrid: true, fixed: true },
  { feature: "QR Code exclusivo", commission: true, hybrid: true, fixed: true },
  { feature: "PIX automático", commission: true, hybrid: true, fixed: true },
  { feature: "Notificações push", commission: true, hybrid: true, fixed: true },
  { feature: "Cupons e promoções", commission: true, hybrid: true, fixed: true },
  { feature: "Fidelidade", commission: true, hybrid: true, fixed: true },
  { feature: "Relatórios avançados", commission: false, hybrid: true, fixed: true },
  { feature: "Suporte prioritário", commission: false, hybrid: true, fixed: true },
  { feature: "Destaque na vitrine", commission: false, hybrid: true, fixed: true },
  { feature: "Banners ilimitados", commission: false, hybrid: true, fixed: true },
  { feature: "Suporte VIP", commission: false, hybrid: false, fixed: true },
  { feature: "Prioridade em novidades", commission: false, hybrid: false, fixed: true },
];

export default function PlanosPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const statsRef = useInView(0.3);
  const storesCount = useCountUp(50, 2000, statsRef.visible);
  const ordersCount = useCountUp(10, 2000, statsRef.visible);

  const handleCTA = () => navigate("/cadastro-lojista");
  const handleWhatsApp = () =>
    window.open("https://wa.me/5514991624997?text=Olá! Tenho interesse em cadastrar minha loja na plataforma.", "_blank");

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ══════ HERO ══════ */}
      <section className="relative py-20 md:py-28 px-4 overflow-hidden">
        {/* bg decorations */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/20 pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-accent/30 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary mb-8 animate-fade-in">
            <Smartphone className="h-4 w-4" />
            Seu cardápio digital profissional em minutos
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-6 animate-fade-in">
            Pare de anotar pedido no{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-primary">WhatsApp</span>
              <span className="absolute bottom-1 left-0 w-full h-3 bg-primary/15 -z-0 rounded" />
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in leading-relaxed">
            Crie um <strong className="text-foreground">cardápio digital completo</strong> com fotos, PIX automático e notificação de pedidos.
            Seus clientes pedem pelo celular — você recebe tudo organizado.
            <span className="block mt-2 text-primary font-semibold">A partir de R$ 0/mês.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in">
            <Button size="lg" onClick={handleCTA} className="text-base px-8 py-6 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
              Criar meu cardápio grátis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleWhatsApp} className="text-base px-8 py-6 rounded-2xl">
              <MessageCircle className="mr-2 h-5 w-5" /> Tirar dúvidas
            </Button>
          </div>

          {/* social proof micro */}
          <div className="mt-10 flex items-center justify-center gap-3 text-sm text-muted-foreground animate-fade-in">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-bold text-primary">
                  {["M", "J", "A", "R"][i - 1]}
                </div>
              ))}
            </div>
            <span>+50 lojas já usam • 10.000+ pedidos recebidos</span>
          </div>
        </div>
      </section>

      {/* ══════ PAIN POINTS ══════ */}
      <section className="py-16 px-4 border-y border-border bg-muted/30">
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
      <section className="py-20 px-4">
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

      {/* ══════ STATS ══════ */}
      <section ref={statsRef.ref} className="py-14 border-y border-border">
        <div className="mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-4">
          {[
            { value: `${storesCount}+`, label: "Lojas ativas" },
            { value: `${ordersCount}k+`, label: "Pedidos recebidos" },
            { value: "< 5min", label: "Para criar cardápio" },
            { value: "24h", label: "Suporte disponível" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl md:text-4xl font-extrabold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════ PLANS ══════ */}
      <section className="py-20 px-4" id="planos">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
            Escolha o plano ideal para sua loja
          </h2>
          <p className="text-center text-muted-foreground mb-14 max-w-2xl mx-auto">
            Todos os planos incluem cardápio digital completo, PIX online e notificações.
            Comece grátis e migre quando quiser.
          </p>

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
                    {/* Header */}
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                      <Icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">{plan.tagline}</p>

                    {/* Price */}
                    <div className="mb-2">
                      <span className="text-4xl font-extrabold text-foreground">
                        R$ {plan.price}
                      </span>
                      <span className="text-muted-foreground text-sm">{plan.period}</span>
                    </div>

                    {/* Commission badge */}
                    <div className={`inline-flex items-center rounded-xl ${plan.lightBg} px-3 py-2 text-sm font-bold ${plan.textColor} mb-2 w-fit`}>
                      <BadgePercent className="h-4 w-4 mr-1.5" />
                      {plan.commission} {plan.commissionLabel}
                    </div>

                    {/* Extra fees */}
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

                    {/* Features */}
                    <ul className="space-y-2.5 flex-1 mb-6">
                      {plan.features.map((f) => (
                        <li key={f.text} className="flex items-start gap-2 text-sm text-foreground">
                          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          {f.text}
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={handleCTA}
                      className={`w-full rounded-2xl py-5 text-base font-semibold ${
                        plan.highlight
                          ? "shadow-lg shadow-primary/20"
                          : ""
                      }`}
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

      {/* ══════ COMPARISON TABLE ══════ */}
      <section className="py-16 px-4 bg-muted/20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center text-foreground mb-10">
            Compare os planos
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-semibold text-muted-foreground">Recurso</th>
                  <th className="p-4 text-center font-bold text-foreground">Comissão</th>
                  <th className="p-4 text-center font-bold text-foreground">Crescimento</th>
                  <th className="p-4 text-center font-bold text-primary">Essencial</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border bg-muted/30">
                  <td className="p-4 font-semibold text-foreground">Mensalidade</td>
                  <td className="p-4 text-center font-bold text-foreground">R$ 0</td>
                  <td className="p-4 text-center font-bold text-foreground">R$ 100</td>
                  <td className="p-4 text-center font-bold text-primary">R$ 180</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-4 font-semibold text-foreground">Comissão</td>
                  <td className="p-4 text-center text-foreground">5%</td>
                  <td className="p-4 text-center text-foreground">2,5%</td>
                  <td className="p-4 text-center font-bold text-primary">0%</td>
                </tr>
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="border-b border-border last:border-0">
                    <td className="p-4 text-foreground">{row.feature}</td>
                    <td className="p-4 text-center">
                      {row.commission ? <Check className="h-4 w-4 text-primary mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                    </td>
                    <td className="p-4 text-center">
                      {row.hybrid ? <Check className="h-4 w-4 text-primary mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                    </td>
                    <td className="p-4 text-center">
                      {row.fixed ? <Check className="h-4 w-4 text-primary mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══════ ROI CALCULATOR ══════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Faça as contas 🧮
          </h2>
          <p className="text-center text-muted-foreground mb-10">
            Veja quanto você economiza com o plano Essencial vs. Comissão
          </p>
          <ROICalculator />
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
              <div
                key={i}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-semibold text-foreground text-sm pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
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
        <div className="mt-3 flex items-center justify-center gap-4 text-xs">
          <a href="/termos-de-uso" className="hover:text-primary transition-colors">Termos de Uso</a>
          <span>•</span>
          <a href="/politica-privacidade" className="hover:text-primary transition-colors">Política de Privacidade</a>
        </div>
      </footer>
    </div>
  );
}

/* ─── ROI Calculator sub-component ─── */
function ROICalculator() {
  const [orders, setOrders] = useState(200);
  const [ticket, setTicket] = useState(40);

  const revenue = orders * ticket;
  const commissionCost = revenue * 0.05;
  const fixedCost = 180 + orders * 2 + orders * 1; // R$180 + R$2 delivery + R$1 PIX per order
  const savings = commissionCost - fixedCost;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="text-sm font-semibold text-foreground mb-2 block">
            Pedidos por mês
          </label>
          <input
            type="range"
            min={50}
            max={1000}
            step={10}
            value={orders}
            onChange={(e) => setOrders(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="text-2xl font-bold text-primary mt-1">{orders}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-foreground mb-2 block">
            Ticket médio (R$)
          </label>
          <input
            type="range"
            min={15}
            max={150}
            step={5}
            value={ticket}
            onChange={(e) => setTicket(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="text-2xl font-bold text-primary mt-1">R$ {ticket}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-muted/50 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Faturamento/mês</p>
          <p className="text-xl font-bold text-foreground">R$ {revenue.toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-2xl bg-destructive/5 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Custo Comissão (5%)</p>
          <p className="text-xl font-bold text-destructive">- R$ {commissionCost.toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-2xl bg-primary/5 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Custo Essencial</p>
          <p className="text-xl font-bold text-primary">- R$ {fixedCost.toLocaleString("pt-BR")}</p>
        </div>
      </div>

      {savings > 0 ? (
        <div className="mt-6 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/30 p-5 text-center">
          <p className="text-sm text-muted-foreground mb-1">💰 Com o plano Essencial você economiza</p>
          <p className="text-3xl font-extrabold text-primary">
            R$ {savings.toLocaleString("pt-BR")}/mês
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            = R$ {(savings * 12).toLocaleString("pt-BR")} por ano
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-muted/50 p-5 text-center">
          <p className="text-sm text-muted-foreground mb-1">
            Para esse volume, o <strong className="text-foreground">plano Comissão</strong> é mais vantajoso!
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Aumente o volume de pedidos para ver quando o Essencial compensa.
          </p>
        </div>
      )}
    </div>
  );
}
