const Footer = () => {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-10 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-black text-sm">iF</span>
              </div>
              <span className="text-xl font-black text-primary">foodly</span>
            </div>
            <p className="text-background/60 text-sm">
              A melhor experiência em delivery de comida do Brasil.
            </p>
          </div>
          {[
            { title: "Descubra", items: ["Restaurantes", "Categorias", "Ofertas", "Cupons"] },
            { title: "Ajuda", items: ["Central de ajuda", "Fale conosco", "Termos de uso", "Privacidade"] },
            { title: "Para empresas", items: ["Cadastre seu restaurante", "Seja entregador", "Carreiras", "Blog"] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-bold mb-4">{col.title}</h4>
              <ul className="space-y-2">
                {col.items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-background/60 hover:text-primary text-sm transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-background/10 pt-6 text-center text-background/40 text-sm">
          © 2026 Foodly. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
