import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useEffect } from "react";
import { isCapacitorNative } from "@/lib/capacitorNative";
import { useNavigate } from "react-router-dom";

const features = [
  { t: "Atendente IA no WhatsApp", d: "Robô responde o cliente automaticamente, envia o cardápio em segundos e tira pedido sozinho — 24h por dia, sem você precisar digitar." },
  { t: "Cardápio digital", d: "Sua loja com link próprio, fotos dos produtos, categorias e busca — pronto para receber pedidos em minutos." },
  { t: "Pedidos online 24h", d: "Cliente pede sozinho pelo celular, sem precisar atendente no WhatsApp. Notificação automática quando entra pedido." },
  { t: "Painel da loja", d: "Acompanhe pedidos em tempo real, edite cardápio, controle horários, formas de pagamento e taxas de entrega." },
  { t: "Motoboy próprio", d: "Cadastre seus entregadores, atribua pedidos e acompanhe a entrega no mapa. Sem comissão por entrega." },
  { t: "PDV integrado", d: "Lance pedidos de balcão e telefone no mesmo sistema. Tudo conta para o relatório do dia." },
  { t: "KDS na cozinha", d: "Tela de cozinha com os pedidos em andamento, organizados por tempo. Reduz erro e atraso." },
  { t: "Multi-unidade (matriz/filial)", d: "Tem mais de uma loja? Centralize no painel matriz e veja faturamento consolidado." },
  { t: "Sem comissão por pedido", d: "Plano fixo mensal. Você fica com 100% do valor do pedido — diferente de marketplaces que cobram 10% a 30%." },
];

const faq = [
  { q: "Quanto custa o ItaSuper?", a: "O ItaSuper trabalha com plano fixo mensal, sem cobrar comissão por pedido. Veja os planos atuais na página /planos." },
  { q: "Preciso de site próprio?", a: "Não. Sua loja recebe um link próprio (itasuper.com.br/sua-loja) que você compartilha no Instagram, WhatsApp e Google." },
  { q: "Funciona para qualquer tipo de loja?", a: "Sim. Atende pizzaria, hamburgueria, restaurante, adega, açaí, padaria, farmácia, mercado e qualquer negócio que entrega ou retira no balcão." },
  { q: "Como o ItaSuper se compara a marketplaces de delivery?", a: "Você não paga comissão por pedido — só uma mensalidade fixa. E diferente de soluções que só repassam o pedido pro WhatsApp, o ItaSuper entrega o pacote completo: atendente IA, painel, KDS, PDV e motoboy próprio integrados." },
  { q: "Como o cliente paga?", a: "Pix, cartão na entrega, dinheiro ou pagamento online — você define as opções no painel." },
  { q: "Tem app para o entregador?", a: "Sim, app Android para os motoboys com mapa, status de entrega e notificações em tempo real." },
];

export default function LandingPage() {
  const navigate = useNavigate();

  // App nativo (APK) abre direto no diretório de lojas — landing é só para web/SEO.
  useEffect(() => {
    if (isCapacitorNative()) {
      navigate("/cliente", { replace: true });
    }
  }, [navigate]);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ItaSuper",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Android",
    description: "Sistema de delivery e cardápio digital para restaurantes, pizzarias, hamburguerias, adegas, farmácias e mercados — sem comissão por pedido.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>ItaSuper — Sistema de delivery e cardápio digital</title>
        <meta name="description" content="Sistema de delivery e cardápio digital para restaurantes, pizzarias, adegas e mercados. Pedidos online, PDV e motoboy próprio — sem comissão." />
        <link rel="canonical" href="https://itasuper.com.br/" />
        <meta property="og:title" content="ItaSuper — Sistema de delivery e cardápio digital" />
        <meta property="og:description" content="Atendente IA no WhatsApp + cardápio digital, PDV, KDS e motoboy próprio integrados. Sem comissão por pedido." />
        <meta property="og:url" content="https://itasuper.com.br/" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(softwareJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      {/* Header */}
      <header className="border-b border-border/40 sticky top-0 bg-background/80 backdrop-blur z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-itasuper-128.webp" alt="ItaSuper" className="w-8 h-8" />
            <span className="font-extrabold text-lg">ItaSuper</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm font-semibold">
            <Link to="/cliente" className="hidden sm:inline text-muted-foreground hover:text-foreground">Ver lojas</Link>
            <Link to="/planos" className="hidden sm:inline text-muted-foreground hover:text-foreground">Planos</Link>
            <Link to="/cadastro-lojista" className="bg-primary text-primary-foreground px-3 py-2 rounded-lg">Cadastrar loja</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 py-14 sm:py-20 max-w-6xl mx-auto text-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          O delivery da sua loja, no seu link — sem entregar 27% pra ninguém.
        </h1>
        <p className="mt-5 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
          Cardápio próprio, PIX confirmado na hora, atendente de IA no WhatsApp que tira o pedido sozinho 24h e motoboy com rastreio em tempo real. O cliente pede pelo navegador — sem baixar app, sem cadastro chato.
        </p>
        <p className="mt-3 text-base sm:text-lg font-semibold max-w-2xl mx-auto">
          Grátis até R$ 5.000 em vendas. Depois, mensalidade fixa. Você fica com o cliente, com a marca e com o dinheiro.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link to="/cadastro-lojista" className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl">
            Cadastrar minha loja grátis
          </Link>
          <Link to="/cliente" className="bg-muted text-foreground font-bold px-6 py-3 rounded-xl">
            Ver lojas em Itanhaém
          </Link>
        </div>
      </section>

      {/* Recursos */}
      <section className="px-4 py-14 bg-muted/30 border-y border-border/40">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center">Tudo o que sua loja precisa em um só lugar</h2>
          <p className="text-center text-muted-foreground mt-2 max-w-2xl mx-auto">Pare de juntar 5 ferramentas diferentes. O ItaSuper centraliza pedidos, cozinha, balcão e entrega.</p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <article key={f.t} className="bg-card border border-border/40 rounded-2xl p-5">
                <h3 className="font-bold text-base">{f.t}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Para quem */}
      <section className="px-4 py-14 max-w-6xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center">Para que tipo de negócio funciona?</h2>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center text-sm font-semibold">
          {["Pizzaria", "Hamburgueria", "Restaurante", "Adega", "Açaí & Sobremesa", "Padaria", "Farmácia", "Mercado", "Comida japonesa", "Cafeteria", "Esfiharia", "Marmitaria"].map((c) => (
            <div key={c} className="bg-card border border-border/40 rounded-xl py-4">{c}</div>
          ))}
        </div>
      </section>

      {/* Por que ItaSuper */}
      <section className="px-4 py-14 bg-muted/30 border-y border-border/40">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold">Por que escolher o ItaSuper</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Plano fixo mensal, sem comissão por pedido. Tudo o que você precisa pra operar o delivery em um único sistema.</p>
          <div className="mt-8 grid sm:grid-cols-2 gap-4 text-left">
            {[
              { t: "0% de comissão por pedido", d: "Você fica com 100% do valor de cada venda. Cobramos apenas uma mensalidade fixa." },
              { t: "Atendente IA no WhatsApp", d: "Responde o cliente em segundos, envia o cardápio e converte conversa em pedido — 24h por dia." },
              { t: "PDV + KDS + Motoboy próprio", d: "Caixa, cozinha e entrega no mesmo sistema. Sem precisar contratar 3 ferramentas separadas." },
              { t: "Dados do cliente são seus", d: "Histórico, telefone e endereço ficam com a sua loja — pra fidelizar e remarketing." },
            ].map((b) => (
              <div key={b.t} className="bg-card border border-border/40 rounded-2xl p-5">
                <div className="font-bold">{b.t}</div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-14 max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center">Perguntas frequentes</h2>
        <div className="mt-8 space-y-3">
          {faq.map((f) => (
            <details key={f.q} className="bg-card border border-border/40 rounded-xl p-4">
              <summary className="font-bold cursor-pointer">{f.q}</summary>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 py-16 text-center bg-primary text-primary-foreground">
        <h2 className="text-2xl sm:text-3xl font-extrabold">Pronto para receber pedidos pelo seu próprio sistema?</h2>
        <p className="mt-3 opacity-90 max-w-xl mx-auto">Crie sua loja em poucos minutos e comece a vender hoje.</p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Link to="/cadastro-lojista" className="bg-background text-foreground font-bold px-6 py-3 rounded-xl">Cadastrar minha loja</Link>
          <Link to="/cliente" className="border border-primary-foreground/40 font-bold px-6 py-3 rounded-xl">Ver lojas ativas</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-10 border-t border-border/40 text-sm text-muted-foreground">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-6 justify-between">
          <div>
            <div className="font-extrabold text-foreground">ItaSuper</div>
            <div className="mt-1">Sistema de delivery e cardápio digital.</div>
          </div>
          <nav className="flex flex-wrap gap-4">
            <Link to="/cliente" className="hover:text-foreground">Lojas</Link>
            <Link to="/planos" className="hover:text-foreground">Planos</Link>
            <Link to="/cadastro-lojista" className="hover:text-foreground">Cadastrar loja</Link>
            <Link to="/portal-parceiro" className="hover:text-foreground">Portal do parceiro</Link>
            <Link to="/termos-de-uso" className="hover:text-foreground">Termos</Link>
            <Link to="/politica-de-privacidade" className="hover:text-foreground">Privacidade</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}