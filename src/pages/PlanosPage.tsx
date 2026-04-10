import { Check, Star, Zap, Shield, ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    name: "Comissão",
    price: "0",
    period: "mensalidade",
    highlight: false,
    description: "Ideal para quem está começando. Sem custo fixo, pague apenas por pedido.",
    commission: "15% por pedido",
    features: [
      "Cardápio digital completo",
      "Pagamento PIX online",
      "Entrega pela plataforma",
      "Programa de fidelidade",
      "Banners promocionais",
      "Agendamento de pedidos",
      "Relatórios completos",
      "Cupons ilimitados",
    ],
  },
  {
    name: "Híbrido",
    price: "100",
    period: "/mês",
    highlight: false,
    description: "Equilíbrio perfeito entre custo fixo reduzido e comissão menor.",
    commission: "10% por pedido",
    features: [
      "Tudo do plano Comissão",
      "Comissão reduzida",
      "Suporte prioritário",
      "Relatórios avançados",
      "Cupons ilimitados",
      "Banners ilimitados",
      "Agendamento de pedidos",
      "Programa de fidelidade",
    ],
  },
  {
    name: "Fixo",
    price: "180",
    period: "/mês",
    highlight: true,
    description: "Máximo de economia. Sem comissão, apenas a mensalidade fixa.",
    commission: "0% comissão",
    features: [
      "Tudo do plano Híbrido",
      "Zero comissão por pedido",
      "Taxa operacional PIX R$1",
      "Todas as ferramentas",
      "Cupons ilimitados",
      "Suporte VIP",
      "Relatórios premium",
      "Prioridade em novidades",
    ],
  },
];

const testimonials = [
  {
    name: "Maria — Pizzaria do Sabor",
    text: "Desde que entrei na plataforma, meus pedidos triplicaram! A facilidade do cardápio digital fez toda a diferença.",
  },
  {
    name: "João — Hamburgueria Top",
    text: "O plano fixo compensa muito. Sem comissão, consigo manter meus preços competitivos.",
  },
  {
    name: "Ana — Doceria da Ana",
    text: "O programa de fidelidade aumentou muito o retorno dos clientes. Super recomendo!",
  },
];

export default function PlanosPage() {
  const navigate = useNavigate();

  const handleCTA = () => {
    navigate("/cadastro-lojista");
  };

  const handleWhatsApp = () => {
    window.open(
      "https://wa.me/5514998765432?text=Olá! Tenho interesse em cadastrar minha loja na plataforma.",
      "_blank"
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/30 py-16 px-4 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full bg-primary/15 px-4 py-1.5 text-sm font-semibold text-primary mb-6">
            🚀 Plataforma #1 de delivery em Itatinga
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
            Venda mais com seu <span className="text-primary">delivery digital</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Cardápio digital, pagamento PIX, entrega integrada e programa de fidelidade.
            Tudo o que sua loja precisa para crescer — a partir de <strong className="text-foreground">R$0/mês</strong>.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={handleCTA} className="text-base px-8 py-6 rounded-xl shadow-lg">
              Cadastrar minha loja <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleWhatsApp} className="text-base px-8 py-6 rounded-xl">
              <MessageCircle className="mr-2 h-5 w-5" /> Falar no WhatsApp
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-b border-border">
        <div className="mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-6 text-center px-4">
          {[
            { value: "50+", label: "Lojas ativas" },
            { value: "10k+", label: "Pedidos entregues" },
            { value: "4.8★", label: "Avaliação média" },
            { value: "24h", label: "Suporte" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl md:text-4xl font-extrabold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 px-4" id="planos">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
            Escolha o plano ideal para sua loja
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Todos os planos incluem cardápio digital, PIX online e entrega integrada.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative flex flex-col transition-transform hover:scale-[1.02] ${
                  plan.highlight
                    ? "border-2 border-primary shadow-xl ring-2 ring-primary/20"
                    : "border-border"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full shadow">
                    ⭐ Mais popular
                  </div>
                )}
                <CardHeader className="pb-2 pt-8">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <div className="mb-4">
                    <span className="text-4xl font-extrabold text-foreground">
                      R${plan.price}
                    </span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                  <div className="inline-flex items-center rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground mb-6 w-fit">
                    <Zap className="h-4 w-4 mr-1.5" />
                    {plan.commission}
                  </div>
                  <ul className="space-y-3 flex-1 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={handleCTA}
                    className="w-full rounded-xl py-5"
                    variant={plan.highlight ? "default" : "outline"}
                  >
                    Começar agora
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 bg-muted/40">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Por que escolher nossa plataforma?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Zap, title: "Rápido de configurar", desc: "Cadastre sua loja e comece a vender em minutos." },
              { icon: Shield, title: "Pagamento seguro", desc: "PIX online com confirmação automática e segura." },
              { icon: Star, title: "Fidelize clientes", desc: "Programa de pontos que traz o cliente de volta." },
              { icon: MessageCircle, title: "Suporte dedicado", desc: "Atendimento rápido via WhatsApp sempre que precisar." },
              { icon: ArrowRight, title: "Entrega integrada", desc: "Motoboys da plataforma ou entrega própria, você escolhe." },
              { icon: Check, title: "Sem surpresas", desc: "Preços transparentes, sem taxas escondidas." },
            ].map((b) => (
              <div key={b.title} className="flex gap-4 items-start p-4 rounded-xl bg-card border border-border">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <b.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{b.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            O que nossos parceiros dizem
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="border-border">
                <CardContent className="pt-6">
                  <div className="flex gap-0.5 mb-3">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground italic">"{t.text}"</p>
                  <p className="text-sm font-semibold text-foreground mt-4">{t.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Pronto para vender mais?
          </h2>
          <p className="text-muted-foreground mb-8">
            Cadastre sua loja agora e comece a receber pedidos ainda hoje.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={handleCTA} className="text-base px-8 py-6 rounded-xl shadow-lg">
              Cadastrar minha loja <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleWhatsApp} className="text-base px-8 py-6 rounded-xl">
              <MessageCircle className="mr-2 h-5 w-5" /> Falar no WhatsApp
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} ItaSuper — Todos os direitos reservados.
      </footer>
    </div>
  );
}
