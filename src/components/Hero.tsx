import { motion } from "framer-motion";
import { Search } from "lucide-react";
import heroFood from "@/assets/hero-food.jpg";

const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-primary min-h-[600px] flex items-center">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{ background: "var(--hero-gradient)" }} />
      </div>
      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-6xl font-black text-primary-foreground leading-tight mb-6">
              Tudo que você precisa,{" "}
              <span className="text-secondary">entregue</span> na sua porta
            </h1>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-md">
              Peça comida dos seus restaurantes favoritos com poucos cliques. Rápido, fácil e delicioso.
            </p>
            <div className="flex bg-background rounded-full p-2 max-w-lg shadow-xl">
              <div className="flex items-center flex-1 px-4 gap-3">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar restaurante ou prato..."
                  className="bg-transparent outline-none text-foreground placeholder:text-muted-foreground w-full"
                />
              </div>
              <button className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-full hover:opacity-90 transition-opacity">
                Buscar
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block"
          >
            <img
              src={heroFood}
              alt="Pratos deliciosos"
              className="rounded-3xl shadow-2xl animate-float w-full max-w-lg mx-auto"
              width={1280}
              height={720}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
