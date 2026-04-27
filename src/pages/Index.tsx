import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PackageOpen, ArrowRight, Smartphone, QrCode, Clock, Zap, Star,
  ShoppingBag, CreditCard, Bell, Utensils, Truck, Gift, ChevronDown,
  Search, Shield, MessageCircle, BarChart3, TrendingUp, Crown, Rocket,
   CheckCircle2, X, Check, MapPin, Navigation, UserCheck, SmartphoneNfc,
 } from "lucide-react";
 
 /* ─── Motoboy Data ─── */
 const motoboyWorkflow = [
   { 
     icon: Bell, 
     title: "Notificação Sonora", 
     desc: "Assim que você marca o pedido como pronto, o app do motoboy apita instantaneamente avisando que há uma entrega disponível.",
     color: "bg-blue-500/10",
     iconColor: "text-blue-500"
   },
   { 
     icon: MapPin, 
     title: "Rastreamento GPS", 
     desc: "O cliente acompanha o motoboy em tempo real no mapa. Menos ansiedade para o cliente, menos mensagens no seu WhatsApp.",
     color: "bg-green-500/10",
     iconColor: "text-green-500"
   },
   { 
     icon: SmartphoneNfc, 
     title: "Confirmação por PIN", 
     desc: "Segurança total: a entrega só é finalizada quando o motoboy digita o código PIN que está no celular do cliente.",
     color: "bg-orange-500/10",
     iconColor: "text-orange-500"
   },
   { 
     icon: BarChart3, 
     title: "Acerto Financeiro", 
     desc: "Relatórios automáticos de quanto cada motoboy entregou e quanto ele deve prestar contas no final do turno.",
     color: "bg-purple-500/10",
     iconColor: "text-purple-500"
   },
 ];
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

/* ─── hooks ─── */
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

/* ─── static data ─── */
const painPoints = [
  { emoji: "📸", pain: "Manda foto do cardápio pelo WhatsApp", solution: "Link profissional com fotos e preços atualizados" },
  { emoji: "📝", pain: "Anota pedido na mão e erra", solution: "Pedidos organizados e detalhados automaticamente" },
  { emoji: "💸", pain: "Confere PIX no extrato um por um", solution: "Pagamento confirmado na hora, sem conferir nada" },
  { emoji: "🔇", pain: "Perde pedido porque não ouviu a mensagem", solution: "Alerta sonoro + notificação push no celular" },
];

 const steps = [
   { step: "01", title: "Crie sua loja", desc: "Cadastre seu negócio e configure sua marca em minutos." },
   { step: "02", title: "Monte o cardápio", desc: "Adicione seus produtos com fotos, preços e categorias." },
   { step: "03", title: "Divulgue seu link", desc: "Compartilhe no WhatsApp e redes sociais ou use QR Code." },
   { step: "04", title: "Venda e gerencie", desc: "Receba pedidos organizados e acompanhe tudo em tempo real." },
 ];
 
 const features = [
   { icon: Smartphone, title: "Cardápio Digital", desc: "Link exclusivo para seus clientes pedirem sem precisar baixar aplicativos." },
   { icon: QrCode, title: "Mesas e Balcão", desc: "QR Code para autoatendimento no local, agilizando o serviço e evitando filas." },
   { icon: CreditCard, title: "PIX Automático", desc: "Confirmação instantânea de pagamento. Esqueça a conferência manual de extratos." },
   { icon: Bell, title: "Gestão de Pedidos", desc: "Painel inteligente com alertas sonoros e notificações para você não perder nada." },
   { icon: Utensils, title: "Personalização", desc: "Cardápio com fotos HD, adicionais, combos e opções de personalização total." },
   { icon: BarChart3, title: "Dashboard", desc: "Relatórios de vendas, produtos mais pedidos e horários de maior movimento." },
   { icon: Gift, title: "Fidelize Clientes", desc: "Crie cupons de desconto e programas de fidelidade para aumentar o faturamento." },
   { icon: Truck, title: "Logística Nativa", desc: "Sistema integrado para gestão de motoboys e rastreamento de entregas." },
 ];

const plans = [
   { name: "Comissão", price: "R$0", sub: "/mês", desc: "6% por pedido", icon: Rocket, tags: ["Sem mensalidade", "Todas as ferramentas"], subtitle: "Todas as ferramentas incluídas. Pague só quando vender.", popular: false },
  { name: "Crescimento", price: "R$100", sub: "/mês", desc: "2,5% por pedido", icon: TrendingUp, tags: ["Comissão reduzida", "Todas as ferramentas"], subtitle: "Mesmas ferramentas, metade da comissão.", popular: true },
  { name: "Essencial", price: "R$180", sub: "/mês", desc: "0% comissão", icon: Crown, tags: ["Zero comissão", "Lucro máximo"], subtitle: "Fique com 100% do pedido. Taxa PIX R$1 + entrega R$2.", popular: false },
];

const testimonials = [
  { name: "Maria S.", store: "Pizzaria do Sabor", text: "Meus clientes adoram pedir pelo cardápio digital. Não preciso mais anotar pedido por WhatsApp!", rating: 5, orders: "2.400+ pedidos" },
  { name: "João P.", store: "Hamburgueria Top", text: "Com o plano Essencial, cada pedido é lucro puro. O cardápio se paga no primeiro dia!", rating: 5, orders: "3.100+ pedidos" },
  { name: "Ana L.", store: "Doceria da Ana", text: "Montei meu cardápio em 10 minutos. É muito mais prático que mandar foto no WhatsApp.", rating: 5, orders: "1.800+ pedidos" },
];

const faqs = [
  { q: "Preciso baixar algum aplicativo?", a: "Não! Você gerencia tudo pelo navegador do celular ou computador. Seus clientes também pedem direto pelo link, sem instalar nada." },
  { q: "Como funciona o PIX automático?", a: "Quando o cliente escolhe PIX, geramos um QR Code automaticamente. Assim que ele paga, a confirmação é instantânea — sem precisar conferir extrato." },
  { q: "Posso trocar de plano depois?", a: "Sim! Você pode migrar entre planos a qualquer momento. Basta solicitar pelo painel da loja e o admin aprova a troca." },
  { q: "O plano Essencial cobra alguma comissão?", a: "Não! Zero comissão. Você fica com 100% do pedido. Há apenas uma taxa PIX fixa de R$1 por transação e R$2 por entrega via plataforma." },
  { q: "Como recebo os pedidos?", a: "Você recebe notificação sonora e push no celular em tempo real. O painel mostra todos os pedidos organizados para você gerenciar." },
];

const Index = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const statsRef = useInView(0.3);
  const storesCount = useCountUp(50, 2000, statsRef.visible);
  const ordersCount = useCountUp(10, 2000, statsRef.visible);

  const handleCTA = () => navigate("/cadastro-lojista");
  const handleWhatsApp = () =>
    window.open("https://wa.me/5514991624997?text=Olá! Tenho interesse em cadastrar minha loja na plataforma.", "_blank");

  const { data: stores, isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, image_url, category, categories, rating, is_open, force_closed, status, delivery_mode, own_delivery_fee")
        .order("rating", { ascending: false });
      if (error) throw error;
      return (data || []).filter((s: any) => !s.status || s.status === "ativo");
    },
  });

  const { data: products } = useQuery({
    queryKey: ["all-products-search"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, store_id").eq("is_available", true);
      if (error) throw error;
      return data || [];
    },
    enabled: search.length >= 2,
  });

  const storeIds = useMemo(() => stores?.map(s => s.id) || [], [stores]);

  const { data: allHours } = useQuery({
    queryKey: ["all-opening-hours", storeIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("opening_hours").select("*").in("store_id", storeIds);
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
    let result = sorted?.filter((s: any) => {
      if (category === "all") return true;
      const cats = (s.categories && s.categories.length > 0) ? s.categories : [s.category];
      return cats.includes(category);
    });
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
      <section className="relative py-16 md:py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/20 pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/8 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-accent/30 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-5xl text-center">
           <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight text-foreground leading-[1.1] mb-6">
             O seu delivery <br />
             <span className="text-primary">mais profissional.</span>
           </h1>
 
           <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
             A plataforma completa para vender mais: cardápio digital, gestão de entregas e pagamentos automáticos. <strong className="text-foreground">Comece hoje mesmo.</strong>
           </p>
 
           <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
             <Button size="lg" onClick={handleCTA} className="text-base font-bold px-10 py-7 rounded-full shadow-2xl shadow-primary/30 w-full sm:w-auto transition-all hover:scale-105">
               Criar Loja Grátis <ArrowRight className="ml-2 h-5 w-5" />
             </Button>
             <Button size="lg" variant="outline" onClick={handleWhatsApp} className="text-base font-bold px-10 py-7 rounded-full w-full sm:w-auto border-2">
               Falar com Consultor
             </Button>
           </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Sem cartão de crédito
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" /> Aprovação em 24h
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Cancele quando quiser
            </span>
          </div>
        </div>
      </section>

       {/* ══════ PAIN POINTS ══════ */}
       <section className="py-24 px-4 bg-muted/30">
         <div className="mx-auto max-w-5xl">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
               Sua operação ainda é manual? 🤔
             </h2>
             <p className="text-muted-foreground text-lg max-w-xl mx-auto">
               Muitas lojas perdem vendas por falta de organização. Nós resolvemos isso para você.
             </p>
           </div>
           <div className="grid sm:grid-cols-2 gap-6">
             {painPoints.map((item) => (
               <div key={item.pain} className="group flex gap-5 items-center rounded-3xl border border-border bg-card p-8 hover:border-primary/30 hover:shadow-xl transition-all duration-300">
                 <span className="text-4xl flex-shrink-0 bg-muted p-4 rounded-2xl group-hover:scale-110 transition-transform">{item.emoji}</span>
                 <div>
                   <p className="text-sm text-muted-foreground line-through mb-1 opacity-60 font-medium">{item.pain}</p>
                   <p className="text-lg font-bold text-foreground leading-tight">{item.solution}</p>
                 </div>
               </div>
             ))}
           </div>
         </div>
       </section>

       {/* ══════ MOTOBOY SYSTEM SECTION ══════ */}
       <section className="py-16 px-4 bg-slate-900 text-white overflow-hidden relative">
         <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-600/10 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />
         
         <div className="mx-auto max-w-5xl relative z-10">
           <div className="text-center mb-12">
             <h2 className="text-2xl md:text-4xl font-black mb-4">
               Sistema de Motoboy <span className="text-primary">Integrado</span> 🛵
             </h2>
             <p className="text-slate-400 max-w-2xl mx-auto">
               Sua logística sob controle. Da cozinha à porta do cliente, tudo conectado em tempo real.
             </p>
           </div>
 
           <div className="grid md:grid-cols-2 gap-12 items-center">
             <div className="space-y-6">
               {motoboyWorkflow.map((item, i) => (
                 <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
                   <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                     <item.icon className={`h-6 w-6 ${item.iconColor}`} />
                   </div>
                   <div>
                     <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                     <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                   </div>
                 </div>
               ))}
             </div>
 
             <div className="relative">
               <div className="aspect-[4/5] bg-gradient-to-br from-primary/20 to-orange-600/20 rounded-[2.5rem] border border-white/10 p-4 relative">
                 {/* Mock UI for Driver App */}
                 <div className="w-full h-full bg-slate-950 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col border border-white/5">
                   <div className="p-4 border-b border-white/10 bg-slate-900 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                         <Truck className="h-4 w-4 text-primary" />
                       </div>
                       <span className="font-bold text-xs">App do Motoboy</span>
                     </div>
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                   </div>
                   <div className="flex-1 p-4 space-y-4">
                     <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 animate-bounce-slow">
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] uppercase font-bold text-primary">Novo Pedido Disponível!</span>
                         <Bell className="h-3 w-3 text-primary" />
                       </div>
                       <p className="font-bold text-sm">#1024 - R$ 45,90</p>
                       <p className="text-[10px] text-slate-400">Rua das Flores, 123 • 1.2km</p>
                     </div>
                     <div className="h-32 w-full bg-slate-800 rounded-xl relative overflow-hidden">
                       {/* Mini Map representation */}
                       <div className="absolute inset-0 flex items-center justify-center opacity-30">
                         <Navigation className="h-10 w-10 text-primary rotate-45" />
                       </div>
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-[0_0_15px_rgba(255,107,0,0.5)] border-2 border-white" />
                     </div>
                     <div className="space-y-2">
                       <div className="h-2 w-3/4 bg-slate-800 rounded" />
                       <div className="h-2 w-1/2 bg-slate-800 rounded opacity-50" />
                     </div>
                   </div>
                   <div className="p-4 mt-auto">
                     <div className="w-full py-3 bg-primary rounded-xl text-center font-bold text-sm text-black">
                       ACEITAR ENTREGA
                     </div>
                   </div>
                 </div>
                 
                 {/* Floating badge */}
                 <div className="absolute -bottom-6 -right-6 bg-white text-slate-950 p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-float max-w-[200px]">
                   <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                     <UserCheck className="h-5 w-5 text-green-600" />
                   </div>
                   <p className="text-[10px] font-bold leading-tight">Motoboy acaba de aceitar o pedido!</p>
                 </div>
               </div>
             </div>
           </div>
         </div>
       </section>
 
       {/* ══════ HOW IT WORKS ══════ */}
       <section className="py-24 px-4 bg-background border-t border-border">
         <div className="mx-auto max-w-6xl">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-5xl font-black text-foreground mb-4">
               Comece a vender hoje 🚀
             </h2>
             <p className="text-muted-foreground text-lg max-w-xl mx-auto">
               Do cadastro ao primeiro pedido em menos de 10 minutos. É simples e rápido.
             </p>
           </div>
           <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
             {steps.map((s, i) => (
               <div key={s.step} className="relative text-center group">
                 {i < 3 && <div className="hidden lg:block absolute top-10 left-[70%] w-[60%] h-[2px] bg-gradient-to-r from-primary/30 to-transparent" />}
                 <div className="relative mx-auto w-20 h-20 rounded-[2rem] bg-gradient-to-br from-primary to-orange-600 text-white flex items-center justify-center text-2xl font-black mb-8 shadow-2xl shadow-primary/20 group-hover:rotate-12 transition-all duration-300">
                   {s.step}
                 </div>
                 <h3 className="text-xl font-bold text-foreground mb-3">{s.title}</h3>
                 <p className="text-muted-foreground leading-relaxed font-medium">{s.desc}</p>
               </div>
             ))}
           </div>
         </div>
       </section>

       {/* ══════ FEATURES GRID ══════ */}
       <section className="py-24 px-4 bg-background">
         <div className="mx-auto max-w-6xl">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-5xl font-black text-foreground mb-4">
               Tudo que seu delivery precisa
             </h2>
             <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
               Funcionalidades profissionais pensadas para escalar o seu negócio e facilitar a vida do seu cliente.
             </p>
           </div>
           <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
             {features.map((f) => (
               <div key={f.title} className="group rounded-3xl border border-border bg-card p-8 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                 <div className="rounded-2xl bg-primary/10 w-14 h-14 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                   <f.icon className="h-7 w-7 text-primary group-hover:text-white transition-colors" />
                 </div>
                 <h3 className="text-xl font-bold text-foreground mb-3">{f.title}</h3>
                 <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
               </div>
             ))}
           </div>
         </div>
       </section>

       {/* ══════ PLANS SUMMARY ══════ */}
       <section className="py-24 px-4 bg-muted/40">
         <div className="mx-auto max-w-6xl">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-5xl font-black text-foreground mb-4">
               Planos que cabem no seu bolso 💰
             </h2>
             <p className="text-muted-foreground text-lg max-w-xl mx-auto">
               Sem fidelidade ou taxas escondidas. Mude de plano quando quiser.
             </p>
           </div>
           <div className="grid sm:grid-cols-3 gap-8">
             {plans.map((plan) => (
               <Card key={plan.name} className={`rounded-[2.5rem] border-2 overflow-hidden transition-all hover:shadow-2xl relative ${plan.popular ? "border-primary shadow-xl scale-105 z-10" : "border-border shadow-md"}`}>
                 {plan.popular && (
                   <div className="absolute top-0 right-0 bg-primary text-black font-black text-[10px] uppercase tracking-widest px-6 py-2 rounded-bl-3xl">
                     MAIS POPULAR
                   </div>
                 )}
                 <CardContent className="pt-12 pb-10 px-8 text-center">
                   <div className="mx-auto w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
                     <plan.icon className="h-8 w-8 text-primary" />
                   </div>
                   <h3 className="text-2xl font-black text-foreground mb-2">{plan.name}</h3>
                   <div className="mb-4">
                     <span className="text-5xl font-black text-foreground">{plan.price}</span>
                     <span className="text-muted-foreground font-medium">{plan.sub}</span>
                   </div>
                   <p className="text-lg font-bold text-primary mb-4">{plan.desc}</p>
                   <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{plan.subtitle}</p>
                   <div className="flex flex-col gap-3">
                     {plan.tags.map(tag => (
                       <div key={tag} className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground bg-muted/50 py-2 rounded-2xl">
                         <Check className="h-4 w-4 text-primary" /> {tag}
                       </div>
                     ))}
                   </div>
                   <Button onClick={handleCTA} className={`w-full mt-8 py-7 rounded-2xl font-bold text-lg ${plan.popular ? "bg-primary hover:bg-primary/90" : "variant-outline"}`}>
                     Começar agora
                   </Button>
                 </CardContent>
               </Card>
             ))}
           </div>
         </div>
       </section>

      {/* ══════ ANIMATED STATS ══════ */}
      <section className="py-14 border-y border-border">
        <div className="mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-4">
          {[
            { value: `${storesCount}+`, label: "Lojas ativas" },
            { value: `${ordersCount}k+`, label: "Pedidos recebidos" },
            { value: "< 5min", label: "Para criar cardápio" },
            { value: "24h", label: "Suporte disponível" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl md:text-4xl font-extrabold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════ TESTIMONIALS ══════ */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-3">
            O que nossos parceiros dizem ⭐
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Lojistas reais que transformaram seu delivery.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="border-border rounded-2xl hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground italic leading-relaxed mb-4">"{t.text}"</p>
                  <p className="text-sm font-bold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.store} • {t.orders}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section className="py-16 px-4 bg-muted/20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-3">
            Perguntas frequentes
          </h2>
          <p className="text-center text-muted-foreground mb-10">
            Tire suas dúvidas antes de começar.
          </p>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
                  <span className="font-semibold text-foreground text-sm pr-4">{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed animate-fade-in">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

       {/* ══════ CTA FINAL ══════ */}
       <section className="relative py-32 px-4 overflow-hidden bg-primary">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
         <div className="relative mx-auto max-w-4xl text-center">
           <h2 className="text-4xl md:text-6xl font-black text-black mb-6 leading-tight">
             Pronto para profissionalizar o seu delivery?
           </h2>
           <p className="text-black/70 text-xl md:text-2xl mb-12 font-medium max-w-2xl mx-auto">
             Junte-se a centenas de lojistas que já estão lucrando com o ItaSuper.
           </p>
           <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
             <Button size="lg" onClick={handleCTA} className="bg-black text-white hover:bg-black/90 text-xl font-bold px-12 py-8 rounded-full shadow-2xl transition-all hover:scale-105">
               Criar minha loja agora
             </Button>
             <Button size="lg" variant="outline" onClick={handleWhatsApp} className="border-black text-black hover:bg-black/10 text-xl font-bold px-12 py-8 rounded-full border-2 transition-all">
               Falar com suporte
             </Button>
           </div>
           <p className="mt-8 text-black/50 font-bold text-sm tracking-widest uppercase">
             Aprovação em até 24h • Sem fidelidade • Suporte humanizado
           </p>
         </div>
       </section>

      {/* ══════ DIVIDER: CONSUMER SECTION ══════ */}
      <section className="py-6 px-4 bg-muted/40 border-y border-border">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-xl font-bold text-foreground">Já é cliente? Peça agora! 🍕</h2>
          <p className="text-sm text-muted-foreground mt-1">Navegue pelas lojas disponíveis e faça seu pedido.</p>
        </div>
      </section>

      {/* ══════ SEARCH + CATEGORIES ══════ */}
      <div className="px-4 space-y-3 mt-4">
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
            {Array.from({ length: 6 }).map((_, i) => <StoreCardSkeleton key={i} />)}
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

      {/* ══════ GUARANTEE ══════ */}
      <section className="py-10 px-4 bg-muted/30 border-y border-border mt-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Seguro e confiável</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Pagamentos protegidos, dados criptografados e lojas verificadas. Sua experiência é nossa prioridade.
          </p>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border px-4 mb-16">
         <p className="font-semibold text-foreground mb-1">Itasuper todos os direitos reservado</p>
         <div className="flex items-center justify-center gap-4 text-xs mt-1">
           <a href="/termos-de-uso" className="hover:text-primary transition-colors">termos</a>
           <a href="/politica-de-privacidade" className="hover:text-primary transition-colors">politica</a>
         </div>
      </footer>

      <div data-tour="cart-fab"><CartFAB /></div>
      <BottomNav />
      <ProductTour steps={clienteTourSteps} tourKey="cliente" />
    </div>
  );
};

export default Index;
