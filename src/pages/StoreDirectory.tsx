import { Store, Truck, ShieldCheck, Zap } from "lucide-react";

const StoreDirectory = () => {
  const features = [
    { icon: Zap, title: "Pedido Rápido", desc: "Faça seu pedido em segundos" },
    { icon: Truck, title: "Entrega Ágil", desc: "Motoboys dedicados na sua cidade" },
    { icon: ShieldCheck, title: "Pagamento Seguro", desc: "PIX, cartão e dinheiro" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-primary/5 px-4 pt-14 pb-12">
        <div className="max-w-md mx-auto text-center relative z-10">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/10">
            <Store className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">
            ITA<span className="text-primary">SUPER</span>
          </h1>
          <p className="text-base text-muted-foreground mt-2 leading-relaxed">
            O delivery oficial da sua cidade.<br />
            Peça dos melhores estabelecimentos com entrega rápida!
          </p>
        </div>
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
      </section>

      {/* Features */}
      <section className="px-4 py-8 max-w-md mx-auto">
        <div className="grid grid-cols-3 gap-3">
          {features.map((f, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-3 text-center">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs font-bold text-foreground leading-tight">{f.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
            </div>
          ))}
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
