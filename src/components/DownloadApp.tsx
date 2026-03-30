import { motion } from "framer-motion";
import { Smartphone } from "lucide-react";

const DownloadApp = () => {
  return (
    <section className="py-20 bg-primary relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-primary-foreground" />
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-primary-foreground" />
      </div>
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-10">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="max-w-lg"
          >
            <h2 className="text-3xl md:text-4xl font-black text-primary-foreground mb-4">
              Baixe o app e ganhe <span className="text-secondary">R$15 off</span>
            </h2>
            <p className="text-primary-foreground/80 mb-8">
              Seu primeiro pedido com desconto exclusivo. Disponível para Android e iOS.
            </p>
            <div className="flex gap-4">
              <button className="bg-background text-foreground font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
                Google Play
              </button>
              <button className="bg-background text-foreground font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
                App Store
              </button>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex items-center justify-center"
          >
            <div className="w-56 h-96 bg-primary-foreground/10 rounded-[3rem] border-4 border-primary-foreground/20 flex items-center justify-center backdrop-blur-sm">
              <Smartphone className="h-20 w-20 text-primary-foreground/40" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default DownloadApp;
