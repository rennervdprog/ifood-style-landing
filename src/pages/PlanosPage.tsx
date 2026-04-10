import { Check, Star, Zap, Shield, ArrowRight, MessageCircle, Smartphone, QrCode, Clock, TrendingUp, Utensils, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    name: "Comissão",
    price: "0",
    period: "mensalidade",
    highlight: false,
    description: "Comece agora sem investir nada. Pague só quando vender.",
    commission: "5% por pedido",
    features: [
      "Cardápio digital ilimitado",
      "QR Code exclusivo da loja",
      "Pagamento PIX automático",
      "Notificação de pedidos em tempo real",
      "Programa de fidelidade",
      "Cupons e promoções",
      "Relatórios de vendas",
      "Entrega integrada",
    ],
  },
  {
    name: "Híbrido",
    price: "100",
    period: "/mês",
    highlight: false,
    description: "Comissão menor com mensalidade acessível.",
    commission: "10% por pedido",
    features: [
      "Tudo do plano Comissão",
      "Comissão reduzida para 10%",
      "Suporte prioritário",
      "Relatórios avançados",
      "Banners ilimitados",
      "Agendamento de pedidos",
      "Destaque na vitrine",
      "Cardápio com fotos HD",
    ],
  },
  {
    name: "Fixo",
    price: "180",
    period: "/mês",
    highlight: true,
    description: "Zero comissão. Lucro máximo em cada pedido.",
    commission: "0% comissão",
    features: [
      "Tudo do plano Híbrido",
      "Zero comissão por pedido",
      "Taxa PIX fixa de R$1",
      "Suporte VIP prioritário",
      "Relatórios premium",
      "Prioridade em novidades",
      "Todas as ferramentas",
      "ROI garantido",
    ],
  },
];

const steps = [
  {
    step: "1",
    title: "Cadastre sua loja",
    desc: "Preencha os dados e seu cardápio digital fica pronto em minutos.",
  },
  {
    step: "2",
    title: "Monte seu cardápio",
    desc: "Adicione produtos, fotos, preços e categorias de forma simples.",
  },
  {
    step: "3",
    title: "Compartilhe o link",
    desc: "Envie pelo WhatsApp, redes sociais ou imprima o QR Code.",
  },
  {
    step: "4",
    title: "Receba pedidos!",
    desc: "Clientes pedem pelo celular e você recebe na hora com notificação.",
  },
];

const testimonials = [
  {
    name: "Maria — Pizzaria do Sabor",
    text: "Meus clientes adoram pedir pelo cardápio digital. Não preciso mais anotar pedido por WhatsApp!",
  },
  {
    name: "João — Hamburgueria Top",
    text: "Com o plano fixo, cada pedido é lucro puro. O cardápio digital se paga no primeiro dia.",
  },
  {
    name: "Ana — Doceria da Ana",
    text: "Montei meu cardápio em 10 minutos. É muito mais prático que ficar mandando foto de cardápio no WhatsApp.",
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
      {/* Hero — foco no cardápio digital */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/30 py-16 px-4 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full bg-primary/15 px-4 py-1.5 text-sm font-semibold text-primary mb-6">
            📱 Seu cardápio digital em minutos
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
            Chega de anotar pedido no <span className="text-primary">WhatsApp</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Tenha um <strong className="text-foreground">cardápio digital profissional</strong> com fotos, preços atualizados, 
            pagamento PIX automático e notificação de pedidos — tudo pelo celular, a partir de <strong className="text-foreground">R$0/mês</strong>.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={handleCTA} className="text-base px-8 py-6 rounded-xl shadow-lg">
              Criar meu cardápio grátis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleWhatsApp} className="text-base px-8 py-6 rounded-xl">
              <MessageCircle className="mr-2 h-5 w-5" /> Tirar dúvidas
            </Button>
          </div>
        </div>
      </section>

      {/* Pain points → Solution */}
      <section className="py-14 px-4 border-b border-border">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-10">
            Você ainda faz isso? 🤔
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { emoji: "😩", pain: "Manda foto do cardápio pelo WhatsApp", solution: "Cardápio digital com link próprio" },
              { emoji: "📝", pain: "Anota pedido na mão e erra quantidade", solution: "Pedidos organizados automaticamente" },
              { emoji: "💸", pain: "Perde tempo conferindo PIX manualmente", solution: "Confirmação de pagamento automática" },
            ].map((item) => (
              <div key={item.pain} className="rounded-xl border border-border bg-card p-5 text-center">
                <p className="text-3xl mb-3">{item.emoji}</p>
                <p className="text-sm text-muted-foreground line-through mb-3">{item.pain}</p>
                <p className="text-sm font-semibold text-primary">{item.solution}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="py-16 px-4 bg-muted/40">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Simples como deve ser
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold text-foreground mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios do cardápio digital */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Tudo que seu delivery precisa
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Praticidade total para você e para seu cliente.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Smartphone, title: "Cardápio no celular", desc: "Seu cliente abre o link e já faz o pedido. Sem baixar app." },
              { icon: QrCode, title: "QR Code da loja", desc: "Imprima e cole no balcão. Cliente aponta a câmera e pede." },
              { icon: Zap, title: "PIX automático", desc: "Pagamento confirmado na hora, sem precisar conferir extrato." },
              { icon: Bell, title: "Notificação instantânea", desc: "Novo pedido? Você recebe alerta sonoro no celular na hora." },
              { icon: Utensils, title: "Cardápio organizado", desc: "Categorias, fotos, descrições e adicionais. Profissional." },
              { icon: TrendingUp, title: "Relatórios de vendas", desc: "Saiba quanto vendeu, quais produtos bombam e quando." },
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

      {/* Stats */}
      <section className="py-12 border-y border-border bg-muted/30">
        <div className="mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-6 text-center px-4">
          {[
            { value: "50+", label: "Lojas usando" },
            { value: "10k+", label: "Pedidos pelo cardápio" },
            { value: "< 5min", label: "Para criar o cardápio" },
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
            Escolha seu plano
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Todos incluem cardápio digital completo, PIX online e notificações.
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
                    Criar meu cardápio
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 bg-muted/40">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Quem usa, recomenda
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
            Seu cardápio digital pronto em 5 minutos
          </h2>
          <p className="text-muted-foreground mb-8">
            Cadastre sua loja agora e comece a receber pedidos pelo celular ainda hoje.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={handleCTA} className="text-base px-8 py-6 rounded-xl shadow-lg">
              Criar meu cardápio grátis <ArrowRight className="ml-2 h-5 w-5" />
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
