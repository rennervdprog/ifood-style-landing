import { Store, Truck, ShieldCheck, Zap, Utensils, Bike, ArrowRight, CheckCircle2, TrendingUp, Users, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const StoreDirectory = () => {
  const navigate = useNavigate();

  const features = [
    { icon: Zap, title: "Pedido Rápido", desc: "Clientes pedem em poucos toques" },
    { icon: Truck, title: "Entrega Integrada", desc: "Motoboys da plataforma ou próprios" },
    { icon: ShieldCheck, title: "Pagamento Seguro", desc: "PIX, cartão e dinheiro" },
    { icon: Smartphone, title: "Cardápio Digital", desc: "Seu menu sempre atualizado online" },
    { icon: TrendingUp, title: "Painel Completo", desc: "Acompanhe vendas e pedidos em tempo real" },
    { icon: Users, title: "Mais Clientes", desc: "Alcance novos consumidores na região" },
  ];

  const lojistaPerks = [
    "Cardápio digital completo com fotos e categorias",
    "Gestão de pedidos em tempo real",
    "Escolha entre motoboy próprio ou da plataforma",
    "Relatórios financeiros e de vendas",
    "Cupons e promoções personalizadas",
    "Suporte dedicado ao parceiro",
  ];

  const motoboyPerks = [
    "Receba entregas da sua cidade automaticamente",
    "Ganhos por entrega com transparência total",
    "Painel de corridas e histórico de ganhos",
    "Solicite saques quando quiser",
    "Flexibilidade de horário — você decide quando rodar",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-primary/5 px-4 pt-16 pb-16">
        <div className="max-w-lg mx-auto text-center relative z-10">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/10">
            <Store className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-black text-foreground tracking-tight leading-tight">
            ITA<span className="text-primary">SUPER</span>
          </h1>
          <p className="text-lg text-muted-foreground mt-3 leading-relaxed max-w-md mx-auto">
            A plataforma de delivery que conecta estabelecimentos, motoboys e clientes na sua cidade.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Button size="lg" className="gap-2 text-base font-bold rounded-xl" onClick={() => navigate("/cadastro-lojista")}>
              <Utensils className="h-5 w-5" />
              Quero ser Parceiro
            </Button>
            <Button size="lg" variant="outline" className="gap-2 text-base font-bold rounded-xl" onClick={() => navigate("/cadastro-entregador")}>
              <Bike className="h-5 w-5" />
              Quero ser Motoboy
            </Button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-56 h-56 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
      </section>

      {/* Vantagens gerais */}
      <section className="px-4 py-12 max-w-lg mx-auto">
        <h2 className="text-xl font-black text-foreground text-center mb-2">Por que escolher o ItaSuper?</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">Tudo que você precisa para vender ou entregar mais</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {features.map((f, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 text-center hover:border-primary/30 transition-colors">
              <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs font-bold text-foreground leading-tight">{f.title}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Para Lojistas */}
      <section className="px-4 py-12 bg-primary/5">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Utensils className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground">Para Lojistas</h2>
              <p className="text-sm text-muted-foreground">Expanda seu negócio com delivery digital</p>
            </div>
          </div>
          <div className="space-y-3 mb-6">
            {lojistaPerks.map((perk, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-foreground">{perk}</p>
              </div>
            ))}
          </div>
          <Button className="w-full gap-2 font-bold rounded-xl" size="lg" onClick={() => navigate("/cadastro-lojista")}>
            Cadastrar meu estabelecimento
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Para Motoboys */}
      <section className="px-4 py-12">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Bike className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground">Para Motoboys</h2>
              <p className="text-sm text-muted-foreground">Ganhe dinheiro fazendo entregas na sua cidade</p>
            </div>
          </div>
          <div className="space-y-3 mb-6">
            {motoboyPerks.map((perk, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-foreground">{perk}</p>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full gap-2 font-bold rounded-xl" size="lg" onClick={() => navigate("/cadastro-entregador")}>
            Quero fazer entregas
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* CTA Final */}
      <section className="px-4 py-12 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-xl font-black text-foreground mb-2">Pronto para começar?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Junte-se ao ItaSuper e faça parte do delivery que está transformando as cidades do interior.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="gap-2 font-bold rounded-xl" onClick={() => navigate("/cadastro-lojista")}>
              <Utensils className="h-5 w-5" />
              Sou Lojista
            </Button>
            <Button size="lg" variant="outline" className="gap-2 font-bold rounded-xl" onClick={() => navigate("/cadastro-entregador")}>
              <Bike className="h-5 w-5" />
              Sou Motoboy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Já é parceiro?{" "}
            <button onClick={() => navigate("/parceiro")} className="text-primary font-bold hover:underline">
              Faça login aqui
            </button>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} <span className="font-bold">ItaSuper</span> — Todos os direitos reservados
        </p>
      </footer>
    </div>
  );
};

export default StoreDirectory;
