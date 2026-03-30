import { motion } from "framer-motion";
import { MapPin, ShoppingBag, Timer } from "lucide-react";

const steps = [
  {
    icon: MapPin,
    title: "Escolha o local",
    description: "Informe seu endereço e veja os restaurantes disponíveis na sua região.",
  },
  {
    icon: ShoppingBag,
    title: "Faça seu pedido",
    description: "Navegue pelos cardápios e adicione seus pratos favoritos ao carrinho.",
  },
  {
    icon: Timer,
    title: "Receba rápido",
    description: "Acompanhe em tempo real e receba seu pedido fresquinho na sua porta.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-extrabold text-foreground text-center mb-4">
          Como funciona
        </h2>
        <p className="text-muted-foreground text-center mb-14 max-w-md mx-auto">
          Pedir comida nunca foi tão simples. Veja como é fácil:
        </p>
        <div className="grid md:grid-cols-3 gap-10">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <step.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
