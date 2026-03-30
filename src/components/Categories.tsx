import { motion } from "framer-motion";
import { Pizza, Beef, Fish, IceCream, Coffee, Salad, Sandwich, Flame } from "lucide-react";

const categories = [
  { icon: Pizza, label: "Pizza", color: "bg-primary/10 text-primary" },
  { icon: Beef, label: "Burgers", color: "bg-secondary/10 text-secondary" },
  { icon: Fish, label: "Japonesa", color: "bg-accent/10 text-accent" },
  { icon: Salad, label: "Saudável", color: "bg-accent/10 text-accent" },
  { icon: Sandwich, label: "Lanches", color: "bg-secondary/10 text-secondary" },
  { icon: IceCream, label: "Sobremesa", color: "bg-primary/10 text-primary" },
  { icon: Coffee, label: "Cafeteria", color: "bg-secondary/10 text-secondary" },
  { icon: Flame, label: "Churrasco", color: "bg-primary/10 text-primary" },
];

const Categories = () => {
  return (
    <section className="py-16" style={{ background: "var(--warm-gradient)" }}>
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-extrabold text-foreground text-center mb-10">
          Explore por categorias
        </h2>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
          {categories.map((cat, i) => (
            <motion.button
              key={cat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.08 }}
              className="flex flex-col items-center gap-2 cursor-pointer group"
            >
              <div className={`p-4 rounded-2xl ${cat.color} transition-shadow group-hover:shadow-lg`}>
                <cat.icon className="h-7 w-7" />
              </div>
              <span className="text-sm font-bold text-foreground">{cat.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Categories;
