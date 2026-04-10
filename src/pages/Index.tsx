import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PackageOpen,
  ArrowRight,
  Smartphone,
  QrCode,
  Clock,
  Zap,
  Star,
  MapPin,
  ShoppingBag,
  CreditCard,
  Bell,
  Utensils,
  Truck,
  Gift,
  ChevronDown,
  Search,
  Shield,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import CartFAB from "@/components/CartFAB";
import CategoryScroll from "@/components/CategoryScroll";
import StoreCard from "@/components/StoreCard";
import StoreCardSkeleton from "@/components/StoreCardSkeleton";
import SearchBar from "@/components/SearchBar";
import PromoBanners from "@/components/PromoBanners";
import ReorderSection from "@/components/ReorderSection";
import FirstOrderBanner from "@/components/FirstOrderBanner";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";
import ProductTour, { clienteTourSteps } from "@/components/ProductTour";
import { useNavigate } from "react-router-dom";

/* ─── animated counter hook ─── */
function useCountUp(end: number, duration = 2000, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      setVal(Math.floor(p * end));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, start]);
  return val;
}

/* ─── intersection observer hook ─── */
function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─── data ─── */
const howItWorks = [
  { step: "01", icon: Search, title: "Escolha a loja", desc: "Navegue pelas lojas disponíveis e veja os cardápios completos." },
  { step: "02", icon: Utensils, title: "Monte seu pedido", desc: "Adicione itens, adicionais e personalize como quiser." },
  { step: "03", icon: CreditCard, title: "Pague online", desc: "PIX automático, cartão na entrega ou dinheiro. Você escolhe." },
  { step: "04", icon: Truck, title: "Receba em casa", desc: "Acompanhe em tempo real e receba tudo no conforto da sua casa." },
];

const benefits = [
  { icon: Smartphone, title: "Peça pelo celular", desc: "Sem baixar nenhum app. Abra o link e peça direto do navegador." },
  { icon: QrCode, title: "Cardápio digital", desc: "Fotos, preços e descrições atualizadas em tempo real." },
  { icon: CreditCard, title: "PIX automático", desc: "Pague via PIX e a confirmação é instantânea. Sem espera." },
  { icon: Bell, title: "Status em tempo real", desc: "Saiba quando seu pedido está sendo preparado e saiu para entrega." },
  { icon: Gift, title: "Pontos de fidelidade", desc: "Acumule pontos a cada pedido e ganhe descontos exclusivos." },
  { icon: Clock, title: "Reordenar rápido", desc: "Repita seus pedidos favoritos com um clique. Sem perder tempo." },
];

const faqs = [
  { q: "Preciso baixar algum aplicativo?", a: "Não! Você faz tudo pelo navegador do celular ou computador. É só acessar o link da loja e pronto." },
  { q: "Como funciona o pagamento PIX?", a: "Ao escolher PIX no checkout, geramos um QR Code automático. Escaneie, pague e o pedido é confirmado na hora — sem precisar enviar comprovante." },
  { q: "Como acompanho meu pedido?", a: "Após o pagamento, você vê o status do pedido em tempo real: preparando → pronto → saiu para entrega → entregue." },
  { q: "Posso pagar em dinheiro ou cartão?", a: "Sim! Você pode escolher PIX online, cartão na entrega ou dinheiro — depende da loja aceitar essas opções." },
  { q: "E se eu tiver algum problema com o pedido?", a: "Você pode entrar em contato com a loja diretamente pelo chat do pedido ou pelo WhatsApp que aparece na página da loja." },
];

const Index = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const statsRef = useInView(0.3);
  const storesCount = useCountUp(50, 2000, statsRef.visible);
  const ordersCount = useCountUp(10, 2000, statsRef.visible);

  const { data: stores, isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, image_url, category, rating, is_open, force_closed, status, delivery_mode, own_delivery_fee")
        .order("rating", { ascending: false });
      if (error) throw error;
      return (data || []).filter((s: any) => !s.status || s.status === "ativo");
    },
  });

  const { data: products } = useQuery({
    queryKey: ["all-products-search"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, store_id")
        .eq("is_available", true);
      if (error) throw error;
      return data || [];
    },
    enabled: search.length >= 2,
  });

  const storeIds = useMemo(() => stores?.map(s => s.id) || [], [stores]);

  const { data: allHours } = useQuery({
    queryKey: ["all-opening-hours", storeIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opening_hours")
        .select("*")
        .in("store_id", storeIds);
      if (error) throw error;
      return data || [];
    },
    enabled: storeIds.length > 0,
  });

  const sorted = useMemo(() => {
    if (!stores) return undefined;
    const withStatus = stores.map(store => {
      const hours = (allHours as any[])?.filter((h: any) => h.store_id === store.id) || [];
      const status = getStoreOpenStatus(hours as OpeningHour[], (store as any).force_closed || false, store.is_open);
      return { ...store, computedOpen: status.isOpen, statusReason: status.reason };
    });
    return withStatus.sort((a, b) => {
      if (a.computedOpen && !b.computedOpen) return -1;
      if (!a.computedOpen && b.computedOpen) return 1;
      return 0;
    });
  }, [stores, allHours]);

  const filtered = useMemo(() => {
    let result = sorted?.filter((s) => category === "all" || s.category === category);
    if (search.length >= 2 && result) {
      const searchLower = search.toLowerCase();
      const matchingStoreIds = new Set<string>();
      result.forEach(s => { if (s.name.toLowerCase().includes(searchLower)) matchingStoreIds.add(s.id); });
      if (products) {
        products.forEach((p: any) => { if (p.name.toLowerCase().includes(searchLower)) matchingStoreIds.add(p.store_id); });
      }
      result = result.filter(s => matchingStoreIds.has(s.id));
    }
    return result;
  }, [sorted, category, search, products]);

  return (
    <div className="min-h-screen bg-background pb-32 overflow-y-auto">
      <AppHeader />

      {/* ══════ HERO ══════ */}
      <section className="relative py-12 md:py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/20 pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-accent/30 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary mb-6 animate-fade-in">
            <Zap className="h-4 w-4" />
            Peça comida de verdade, sem complicação
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-5 animate-fade-in">
            Seus restaurantes favoritos{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-primary">na palma da mão</span>
              <span className="absolute bottom-1 left-0 w-full h-3 bg-primary/15 -z-0 rounded" />
            </span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in leading-relaxed">
            Cardápio digital, pagamento PIX automático e acompanhamento em tempo real.
            <span className="block mt-1 font-semibold text-primary">Peça agora sem baixar nenhum app!</span>
          </p>

          {/* Social proof micro */}
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground animate-fade-in mb-6">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-bold text-primary">
                  {["M", "J", "A", "R", "L"][i - 1]}
                </div>
              ))}
            </div>
            <span>+1.000 clientes satisfeitos</span>
          </div>
        </div>
      </section>

      {/* ══════ SEARCH + CATEGORIES ══════ */}
      <div className="px-4 space-y-3">
        <h2 className="text-xl font-black text-foreground">
          O que você quer <span className="text-primary">pedir</span> hoje?
        </h2>
        <div data-tour="search">
          <SearchBar value={search} onChange={setSearch} />
        </div>
      </div>

      <PromoBanners />
      <FirstOrderBanner />

      <div data-tour="categories">
        <CategoryScroll selected={category} onSelect={setCategory} />
      </div>

      <ReorderSection />

      {/* ══════ STORES LISTING ══════ */}
      <div className="px-4 mt-4">
        <h2 className="text-sm font-bold text-foreground mb-3">Estabelecimentos</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <StoreCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((store, idx) => (
              <div key={store.id} {...(idx === 0 ? { "data-tour": "store-card" } : {})}>
                <StoreCard {...store} is_open={store.computedOpen} statusReason={store.statusReason} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <PackageOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-1">
              {search.length >= 2 ? "Nenhum resultado encontrado" : stores && stores.length === 0 ? "Estamos chegando!" : category === "farmacias" ? "Ainda não temos farmácias parceiras" : category === "docerias" ? "Ainda não temos docerias parceiras" : "Nenhum estabelecimento nesta categoria"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search.length >= 2 ? `Nenhuma loja ou produto encontrado para "${search}".` : stores && stores.length === 0 ? "Novas lojas no ItaSuper em breve. Fique ligado!" : "Nenhum estabelecimento aberto no momento. Volte mais tarde!"}
            </p>
          </div>
        )}
      </div>

      {/* ══════ HOW IT WORKS ══════ */}
      <section className="py-16 px-4 mt-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-3">
            Como funciona? 🍕
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Pedir nunca foi tão fácil. Em 4 passos simples.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((s, i) => (
              <div key={s.step} className="relative text-center group">
                {i < 3 && (
                  <div className="hidden lg:block absolute top-6 left-[60%] w-[80%] h-px bg-border" />
                )}
                <div className="relative mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-orange-600 text-primary-foreground flex items-center justify-center mb-4 shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-foreground mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ STATS ══════ */}
      <section ref={statsRef.ref} className="py-12 border-y border-border bg-muted/30">
        <div className="mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-4">
          {[
            { value: `${storesCount}+`, label: "Lojas parceiras" },
            { value: `${ordersCount}k+`, label: "Pedidos realizados" },
            { value: "< 2min", label: "Para fazer um pedido" },
            { value: "24h", label: "Suporte disponível" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl md:text-4xl font-extrabold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════ BENEFITS GRID ══════ */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-3">
            Por que pedir pelo ItaSuper?
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Praticidade, rapidez e as melhores lojas da região.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {benefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-border bg-card p-5 hover:shadow-md hover:-translate-y-1 transition-all">
                <div className="rounded-xl bg-primary/10 w-11 h-11 flex items-center justify-center mb-4">
                  <b.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-1">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ TESTIMONIALS ══════ */}
      <section className="py-16 px-4 bg-muted/20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-3">
            O que nossos clientes dizem ⭐
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Milhares de pessoas já pedem pelo ItaSuper.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { name: "Camila R.", text: "Super prático! Não preciso mais ligar ou mandar WhatsApp. Peço tudo pelo celular em menos de 2 minutos.", rating: 5 },
              { name: "Lucas M.", text: "O PIX automático é incrível. Pago e o pedido já é confirmado na hora. Adoro acompanhar o status em tempo real!", rating: 5 },
              { name: "Fernanda S.", text: "Já acumulei vários pontos de fidelidade! Sempre ganho descontos nos meus pedidos. Recomendo demais!", rating: 5 },
            ].map((t) => (
              <Card key={t.name} className="border-border rounded-2xl hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground italic leading-relaxed mb-4">"{t.text}"</p>
                  <p className="text-sm font-bold text-foreground">{t.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-3">
            Perguntas frequentes
          </h2>
          <p className="text-center text-muted-foreground mb-10">
            Tire suas dúvidas sobre como pedir.
          </p>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-semibold text-foreground text-sm pr-4">{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ CTA LOJISTA ══════ */}
      <section className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/20 pointer-events-none" />
        <div className="relative mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <ShoppingBag className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Tem um restaurante ou loja?
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed max-w-lg mx-auto">
            Cadastre sua loja no ItaSuper e comece a receber pedidos online hoje mesmo.
            <span className="block mt-1 font-semibold text-primary">Comece grátis!</span>
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate("/planos")} className="text-base px-8 py-6 rounded-2xl shadow-lg shadow-primary/20">
              Ver planos <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.open("https://wa.me/5514998765432?text=Olá! Tenho interesse em cadastrar minha loja.", "_blank")}
              className="text-base px-8 py-6 rounded-2xl"
            >
              <MessageCircle className="mr-2 h-5 w-5" /> Falar conosco
            </Button>
          </div>
        </div>
      </section>

      {/* ══════ GUARANTEE ══════ */}
      <section className="py-10 px-4 bg-muted/30 border-y border-border">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Seguro e confiável
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Pagamentos protegidos, dados criptografados e lojas verificadas. 
            Sua experiência é nossa prioridade.
          </p>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border px-4 mb-16">
        <p className="font-semibold text-foreground mb-1">ItaSuper</p>
        <p>© {new Date().getFullYear()} — Todos os direitos reservados.</p>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs">
          <a href="/termos-de-uso" className="hover:text-primary transition-colors">Termos de Uso</a>
          <span>•</span>
          <a href="/politica-privacidade" className="hover:text-primary transition-colors">Política de Privacidade</a>
        </div>
      </footer>

      <div data-tour="cart-fab">
        <CartFAB />
      </div>
      <BottomNav />
      <ProductTour steps={clienteTourSteps} tourKey="cliente" />
    </div>
  );
};

export default Index;
