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
   Loader2,
   Info,
 } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { PLANS, PLANS_ORDER, DELIVERY_FEE_NOTE, PIX_FEE_NOTE, type PlanInfo } from "@/lib/plansInfo";
import PlansComparisonTable from "@/components/PlansComparisonTable";
import { useAddonsFlag } from "@/hooks/useStorePdvAccess";
import { Monitor } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { REPASSE_RULES } from "@/lib/repasseRules";

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

/* ─── plan data centralizado em src/lib/plansInfo.ts ─── */
const plans: PlanInfo[] = PLANS_ORDER.map((id) => PLANS[id]);

const painPoints = [
  { emoji: "📸", pain: "Manda foto do cardápio pelo WhatsApp", solution: "Link profissional com fotos e preços atualizados" },
  { emoji: "📝", pain: "Anota pedido na mão e erra", solution: "Pedidos organizados e detalhados automaticamente" },
  { emoji: "💸", pain: "Confere comprovantes e pedidos manualmente", solution: "Pagamentos e pedidos organizados no painel" },
  { emoji: "🔇", pain: "Perde pedido porque não ouviu a mensagem", solution: "Alerta sonoro + notificação push no celular" },
];

const features = [
  { icon: Package, title: "Gestão De Pedidos", desc: "Emissão de nota e mensagem de atualização sobre os pedidos pro WhatsApp (abre o WhatsApp para envio manual)." },
  { icon: BarChart3, title: "Finanças e Relatórios", desc: "Tudo 100% detalhado: saiba qual produto mais vende, qual dia vendeu mais e tenha relatórios de todos os dias." },
  { icon: Truck, title: "Motoboy Integrado", desc: "Ao marcar pedido como pronto, um alerta sonoro avisa instantaneamente o motoboy no aplicativo." },
  { icon: CreditCard, title: "Pagamentos claros", desc: "Pix Direto com comprovante, cartão ou dinheiro no checkout, conforme a operação da loja." },
  { icon: Smartphone, title: "Cardápio no Celular", desc: "Link profissional com fotos em HD. O cliente abre e já pede, sem baixar nenhum app." },
  { icon: QrCode, title: "QR Code Exclusivo", desc: "O cliente aponta a câmera para o QR Code e faz o pedido digital sozinho." },
  { icon: Bell, title: "Alerta Instantâneo", desc: "Notificação push e alerta sonoro no celular para você nunca perder um pedido novo." },
  { icon: Globe, title: "Disponível por cidade", desc: "Confira as cidades e lojas disponíveis na plataforma antes de começar a operar." },
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
  { q: "Como funciona o PIX?", a: "No checkout, o Cliente pode usar Pix Direto com envio de comprovante, cartão ou dinheiro, conforme a configuração da loja. PIX online não é oferecido ao Cliente; ele fica reservado à relação ItaSuper–Lojista para mensalidades e repasses acumulados." },
  { q: "Posso trocar de plano depois?", a: "Sim! Você pode migrar entre planos a qualquer momento. Basta solicitar pelo painel da loja e o admin aprova a troca." },
  { q: "O plano Essencial cobra alguma comissão?", a: "Não há comissão sobre pedidos no Essencial. A plataforma pode acrescentar R$ 0,99 à taxa de entrega definida pela loja, conforme a configuração de quem paga. O Essencial permanece sem mensalidade até atingir R$ 5.000 acumulados em uma janela móvel de 60 dias; depois, passa a R$ 89,90/mês sem retorno automático à gratuidade." },
  { q: "Como funciona a cobrança dos repasses?", a: "Quando o Lojista recebe diretamente em dinheiro ou Pix Direto, os R$ 0,99 da taxa de plataforma acumulam no Financeiro. O repasse é processado às segundas-feiras, com mínimo de R$ 150; a partir de R$ 500 pode haver bloqueio operacional, e cobrança pendente por mais de 30 dias pode suspender ou bloquear a operação, conforme as regras vigentes." },
  { q: "Como recebo os pedidos?", a: "Você recebe notificação sonora e push no celular em tempo real. O painel mostra todos os pedidos organizados para você gerenciar." },
];

/* ─── comparison table data ─── */

 export default function PlanosPage() {
   const navigate = useNavigate();
   const [openFaq, setOpenFaq] = useState<number | null>(null);
   const statsRef = useInView(0.3);

  const handleCTA = () => navigate("/cadastro-lojista");
  const handleLogin = () => navigate("/auth");
  const handleWhatsApp = () =>
    window.open("https://wa.me/5522992796291?text=Olá! Tenho interesse em cadastrar minha loja na plataforma.", "_blank");

  useEffect(() => {
    document.title = "Planos e Preços — ItaSuper";
    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const desc = "Planos do ItaSuper: comece grátis ou escolha mensalidade fixa sem comissão por pedido. Cardápio digital, PIX e PDV para sua loja.";
    setMeta("description", desc);
    setMeta("og:title", "Planos e Preços — ItaSuper", "property");
    setMeta("og:description", desc, "property");
    setMeta("og:url", "https://itasuper.com.br/planos", "property");
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = "https://itasuper.com.br/planos";

    const SCRIPT_ID = "faq-jsonld-planos";
    let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.type = "application/ld+json";
      s.id = SCRIPT_ID;
      document.head.appendChild(s);
    }
    s.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }, []);

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
            Planos e preços do{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-primary">ItaSuper</span>
              <span className="absolute bottom-1 left-0 w-full h-3 bg-primary/15 -z-0 rounded" />
            </span>
            <span className="block text-2xl sm:text-3xl lg:text-4xl mt-2 text-muted-foreground font-bold">Cardápio digital, pagamentos e PDV com regras claras por plano</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in leading-relaxed">
            Escolha o plano adequado para sua operação: <strong className="text-foreground">cardápio digital, pedidos e PDV</strong> conforme a opção contratada.
            Confira custos, recursos e condições antes de finalizar.
            <span className="block mt-2 text-primary font-semibold">O plano Essencial começa em R$ 0/mês, conforme as regras exibidas.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in">
            <Button size="lg" onClick={handleCTA} className="text-base px-8 py-6 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
              Criar meu cardápio grátis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleWhatsApp} className="text-base px-8 py-6 rounded-2xl">
              <MessageCircle className="mr-2 h-5 w-5" /> Tirar dúvidas
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground animate-fade-in">
            <span>Planos transparentes, custos apresentados antes da contratação</span>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={handleLogin} className="font-bold text-primary underline underline-offset-4 hover:text-primary/80">Já tenho uma conta — entrar</button>
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
            Recursos disponíveis conforme o plano contratado e a configuração da loja.
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
            { value: "2", label: "Planos para novas lojas" },
            { value: "Conforme oferta", label: "Período inicial" },
            { value: "0%", label: "Comissão no Essencial" },
            { value: "WhatsApp", label: "Suporte disponível" },
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
            Os planos públicos incluem cardápio digital, pedidos e notificações. Escolha entre Essencial e Somente PDV e acompanhe todos os custos antes da contratação.
          </p>

          <div className="grid gap-6 md:grid-cols-2 items-start">
             {plans.map((plan) => {
               const Icon = plan.icon;
               const freeEntryNote = plan.id === "fixed"
                 ? "Grátis até o gatilho de faturamento. Depois, R$ 89,90/mês com aviso prévio de 30 dias."
                 : null;
               const planBadge = plan.badge;
 
               return (
                 <Card
                   key={plan.id}
                   className={`relative flex flex-col rounded-3xl transition-all hover:shadow-xl ${
                     plan.highlight
                       ? "border-2 border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/10 scale-[1.02]"
                       : "border-border hover:border-primary/30"
                   }`}
                 >
                  {planBadge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-5 py-1.5 text-xs font-bold text-primary-foreground shadow-md transition-colors">
                      {planBadge}
                    </div>
                  )}

                  <CardContent className="flex flex-col flex-1 p-6 pt-8">
                    {/* Header */}
                    <div className={`w-12 h-12 rounded-2xl ${plan.accentBg} flex items-center justify-center mb-4`}>
                      <Icon className={`h-6 w-6 ${plan.accent}`} />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">{plan.tagline}</p>

                    {/* Price */}
                    <div className="mb-3">
                      <span className="text-4xl font-extrabold text-foreground">
                        R$ {plan.monthlyFee.toFixed(2).replace(".", ",")}
                      </span>
                      <span className="text-muted-foreground text-sm">/mês</span>
                    </div>

                    {freeEntryNote && (
                      <div className="mb-3 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5">
                        <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 leading-tight">
                          {freeEntryNote}
                        </p>
                      </div>
                    )}

                    {/* Quick costs panel — clean and consistent */}
                    <div className="rounded-xl border border-border bg-muted/30 p-3 mb-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Comissão por pedido</span>
                        <span className="font-bold text-foreground">{plan.commissionRate === 0 ? "Grátis" : `${plan.commissionRate}%`}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Entrega da plataforma</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className="font-bold text-foreground inline-flex items-center gap-1 underline decoration-dotted underline-offset-2">
                              {plan.deliveryFee > 0 ? `+ ${formatBRL(plan.deliveryFee)}` : "Não cobra"}
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="top" align="end" className="w-72 text-xs space-y-2">
                            {plan.deliveryFee > 0 ? (
                              <>
                                <p className="font-bold text-foreground">Taxa de {formatBRL(plan.deliveryFee)} por entrega</p>
                                <p className="text-muted-foreground leading-relaxed"><strong className="text-foreground">Paga pelo cliente</strong>, somada à taxa de entrega informada pela loja no checkout.</p>
                                <p className="text-muted-foreground leading-relaxed">Em vendas pagas em dinheiro, cartão na entrega ou PIX maquininha, a parte da plataforma é acompanhada no Financeiro.</p>
                                <p className="text-muted-foreground leading-relaxed pt-1 border-t border-border">Em pedidos recebidos diretamente pelo Lojista em dinheiro ou PIX, a parte da plataforma acumula no Financeiro. A cobrança do acumulado é gerada via PIX às segundas-feiras, conforme o ciclo e as regras exibidas no painel.</p>
                              </>
                            ) : (
                              <p className="text-muted-foreground leading-relaxed">Este plano não adiciona taxa da plataforma à entrega. A loja recebe integralmente a taxa de entrega que definir.</p>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic leading-snug pt-1">
                        A taxa da plataforma é somada à taxa de entrega da loja e paga pelo cliente quando aplicável.
                      </p>
                    </div>

                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed italic">
                      {plan.forWho}.
                    </p>

                    {/* Exemplo prático */}
                    <div className="rounded-lg bg-primary/5 border border-primary/15 p-2.5 mb-4">
                      <p className="text-[11px] text-foreground leading-relaxed">
                        <strong>Exemplo:</strong> {plan.example(50)}.
                      </p>
                    </div>

                    {/* Features */}
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
                       className={`w-full rounded-2xl py-5 text-base font-semibold ${
                         plan.highlight
                           ? "shadow-lg shadow-primary/20"
                           : ""
                       }`}
                       variant={plan.highlight ? "default" : "outline"}
                     >
                       <>
                         {freeEntryNote ? "Começar grátis" : "Escolher plano"}
                         <ArrowRight className="ml-2 h-4 w-4" />
                       </>
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
          <h2 className="text-2xl font-bold text-center text-foreground mb-3">
            Compare lado a lado
          </h2>
          <p className="text-center text-muted-foreground text-sm mb-10 max-w-xl mx-auto">
            Veja exatamente o que cada plano cobra e o que está incluso. Sem letras pequenas.
          </p>
          <PlansComparisonTable />
        </div>
      </section>

      <AddonsSection />

      {/* ══════ ROI CALCULATOR ══════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Faça as contas 🧮
          </h2>
          <p className="text-center text-muted-foreground mb-10">
            Simule seu volume mensal e veja o custo real em cada plano
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
            Comece com clareza.
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Comece pelo plano Essencial, acompanhe o gatilho e os custos no painel e escolha o caminho adequado para sua operação. As condições de cancelamento e valores devidos aparecem antes da confirmação.
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
        <p className="font-semibold text-foreground mb-1">Itasuper</p>
        <p>© {new Date().getFullYear()} — Todos os direitos reservados</p>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs">
          <a href="/termos-de-uso" className="hover:text-primary transition-colors">Termos</a>
          <a href="/politica-de-privacidade" className="hover:text-primary transition-colors">Política</a>
        </div>
      </footer>
    </div>
  );
}

/* ─── ROI Calculator sub-component ─── */

function AddonsSection() {
  const flag = useAddonsFlag();
  if (!flag) return null;
  return (
    <section className="py-16 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" /> Módulos opcionais
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Turbine com módulos extras
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Adicione recursos avançados ao seu plano quando precisar. Contrate ou cancele quando quiser.
          </p>
        </div>

        <Card className="border-2 border-primary/20">
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Monitor className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base text-foreground">PDV — Ponto de Venda</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  + R$ 49/mês
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Vendas presenciais no balcão, controle de caixa e integração com impressoras.
                Cobrança proporcional na 1ª fatura. Sem fidelidade.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground text-center mt-3">
          Lojas cadastradas antes do lançamento do módulo mantêm a regra atual (R$ 1 por venda no PDV, sem mensalidade extra).
        </p>
      </div>
    </section>
  );
}

function ROICalculator() {
  const [orders, setOrders] = useState(200);
  const [ticket, setTicket] = useState(40);

  const revenue = orders * ticket;

  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const results = PLANS_ORDER.map((id) => {
    const p = PLANS[id];
    const commission = revenue * (p.commissionRate / 100);
    const total = p.monthlyFee + commission;
    return { plan: p, commission, total, monthlyFee: p.monthlyFee };
  });

  const cheapest = results.reduce((a, b) => (a.total <= b.total ? a : b));
  const mostExpensive = results.reduce((a, b) => (a.total >= b.total ? a : b));
  const savings = mostExpensive.total - cheapest.total;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
      {/* Inputs */}
      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="text-sm font-semibold text-foreground mb-2 block">
            Pedidos por mês
          </label>
          <input
            type="range"
            min={50}
            max={1500}
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
            max={200}
            step={5}
            value={ticket}
            onChange={(e) => setTicket(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="text-2xl font-bold text-primary mt-1">R$ {ticket}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-muted/40 p-3 text-center text-xs text-muted-foreground mb-6">
        Faturamento estimado: <strong className="text-foreground">R$ {brl(revenue)}/mês</strong>
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {results.map((r) => {
          const isBest = r.plan.id === cheapest.plan.id;
          return (
            <div
              key={r.plan.id}
              className={`rounded-2xl p-4 border-2 transition ${
                isBest
                  ? "border-primary bg-primary/5 shadow-lg"
                  : "border-border bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-foreground">{r.plan.name}</p>
                {isBest && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Melhor
                  </span>
                )}
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Mensalidade</span>
                  <span className="tabular-nums">R$ {brl(r.monthlyFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Comissão ({r.plan.commissionRate}%)</span>
                  <span className="tabular-nums">R$ {brl(r.commission)}</span>
                </div>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">Custo/mês</span>
                <span
                  className={`text-lg font-extrabold tabular-nums ${
                    isBest ? "text-primary" : "text-foreground"
                  }`}
                >
                  R$ {brl(r.total)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {savings > 0.01 && (
        <div className="mt-6 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/30 p-5 text-center">
          <p className="text-sm text-muted-foreground mb-1">
            💰 No <strong className="text-foreground">{cheapest.plan.name}</strong> você economiza
          </p>
          <p className="text-3xl font-extrabold text-primary">
            R$ {brl(savings)}/mês
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            vs. {mostExpensive.plan.name} · = R$ {brl(savings * 12)} por ano
          </p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center mt-4">
        Simulação aproximada. Não inclui a taxa de entrega da plataforma, que pode ser somada à entrega e paga pelo Cliente quando aplicável. O Pix Direto do Cliente não é tratado como PIX online nesta simulação.
      </p>
    </div>
  );
}
