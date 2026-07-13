import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AsaasBadgeFooter } from "@/components/AsaasBadge";
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
import { useUserLocation } from "@/hooks/useUserLocation";
import { haversineMeters } from "@/lib/location";

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
  { name: "Essencial", price: "R$0", sub: "/mês", desc: "0% comissão", icon: Crown, tags: ["Grátis pra começar", "Sobe pra R$180 quando faturar R$5.000"], subtitle: "Comece sem pagar mensalidade. Taxa PIX R$ 1,99 + entrega R$ 0,99.", popular: true },
  { name: "Autonomia", price: "R$239,90", sub: "/mês", desc: "0% comissão + sem taxa R$ 0,99", icon: Crown, tags: ["Sem taxa de R$ 0,99 da plataforma", "100% da sua taxa de entrega"], subtitle: "Cliente paga exatamente a taxa que você define. 7 dias grátis.", popular: false },
  { name: "Somente PDV", price: "R$69", sub: "/mês", desc: "Só o caixa presencial", icon: CreditCard, tags: ["Sem delivery", "Sem vitrine pública"], subtitle: "Pra loja física que não quer delivery. Só o PDV completo.", popular: false },
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
  { q: "O plano Essencial cobra alguma comissão?", a: "Não! Zero comissão. Começa em R$ 0/mês e sobe pra R$ 180/mês quando sua loja atingir R$ 5.000 em vendas. Há apenas uma taxa PIX fixa de R$ 1,99 por transação e R$ 0,99 por entrega via plataforma." },
  { q: "Como recebo os pedidos?", a: "Você recebe notificação sonora e push no celular em tempo real. O painel mostra todos os pedidos organizados para você gerenciar." },
];

const Index = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const userLocation = useUserLocation();

  const statsRef = useInView(0.3);
  const storesCount = useCountUp(50, 2000, statsRef.visible);
  const ordersCount = useCountUp(10, 2000, statsRef.visible);

  const handleCTA = () => navigate("/cadastro-lojista");
  const handleWhatsApp = () =>
    window.open("https://wa.me/5522992796291?text=Olá! Tenho interesse em cadastrar minha loja na plataforma.", "_blank");

  const { data: stores, isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("stores") as any)
        .select(`
          id, name, slug, image_url, category, categories, rating, is_open, force_closed, status, delivery_mode, own_delivery_fee, latitude, longitude, address_city, address_state, is_matriz,
          opening_hours (*)
        `)
        .eq("is_matriz", false)
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

  const sorted = useMemo(() => {
    if (!stores) return undefined;
    const withStatus = stores.map(store => {
      const hours = (store as any).opening_hours || [];
      const status = getStoreOpenStatus(hours as OpeningHour[], (store as any).force_closed || false, store.is_open);
      const lat = (store as any).latitude;
      const lng = (store as any).longitude;
      const distanceKm =
        userLocation.coords && typeof lat === "number" && typeof lng === "number"
          ? haversineMeters(userLocation.coords, { lat, lng }) / 1000
          : null;
      return { ...store, computedOpen: status.isOpen, statusReason: status.reason, distanceKm };
    });
    return withStatus.sort((a, b) => {
      if (a.computedOpen && !b.computedOpen) return -1;
      if (!a.computedOpen && b.computedOpen) return 1;
      // Mesma cidade do GPS primeiro
      if (userLocation.city) {
        const cityNorm = userLocation.city.toLowerCase();
        const aCity = ((a as any).address_city || "").toLowerCase() === cityNorm;
        const bCity = ((b as any).address_city || "").toLowerCase() === cityNorm;
        if (aCity && !bCity) return -1;
        if (!aCity && bCity) return 1;
      }
      // Depois por distância (se disponível)
      const da = (a as any).distanceKm;
      const db = (b as any).distanceKm;
      if (typeof da === "number" && typeof db === "number") return da - db;
      if (typeof da === "number") return -1;
      if (typeof db === "number") return 1;
      return 0;
    });
  }, [stores, userLocation.coords, userLocation.city]);

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
       <section className="py-24 px-4 bg-background">
         <div className="mx-auto max-w-6xl">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-5xl font-black text-foreground mb-4">
               Quem usa, aprova ⭐
             </h2>
             <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-medium">
               Lojistas que decidiram profissionalizar sua gestão e hoje colhem os resultados.
             </p>
           </div>
           <div className="grid sm:grid-cols-3 gap-8">
             {testimonials.map((t) => (
               <Card key={t.name} className="border-border rounded-[2rem] hover:shadow-2xl transition-all duration-300 bg-muted/30 p-2 border-none">
                 <CardContent className="pt-8 px-6 pb-8">
                   <div className="flex gap-1 mb-6">
                     {Array.from({ length: t.rating }).map((_, i) => (
                       <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                     ))}
                   </div>
                   <p className="text-lg text-foreground font-medium leading-relaxed mb-8 italic">"{t.text}"</p>
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                       {t.name.charAt(0)}
                     </div>
                     <div>
                       <p className="font-bold text-foreground">{t.name}</p>
                       <p className="text-sm text-muted-foreground font-semibold">{t.store} • {t.orders}</p>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             ))}
           </div>
         </div>
       </section>

       {/* ══════ FAQ ══════ */}
       <section className="py-24 px-4 bg-muted/40">
         <div className="mx-auto max-w-4xl">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-5xl font-black text-foreground mb-4">
               Dúvidas frequentes
             </h2>
             <p className="text-muted-foreground text-lg font-medium">
               Tudo o que você precisa saber para começar agora mesmo.
             </p>
           </div>
           <div className="space-y-4">
             {faqs.map((faq, i) => (
               <div key={i} className="rounded-3xl border border-border bg-card overflow-hidden transition-all hover:border-primary/30">
                 <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-8 text-left group">
                   <span className="text-lg font-bold text-foreground pr-8 group-hover:text-primary transition-colors">{faq.q}</span>
                   <ChevronDown className={`h-6 w-6 text-muted-foreground shrink-0 transition-transform duration-300 ${openFaq === i ? "rotate-180 text-primary" : ""}`} />
                 </button>
                 {openFaq === i && (
                   <div className="px-8 pb-8 text-lg text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
                     {faq.a}
                   </div>
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

       {/* ══════ CONSUMER EXPERIENCE ══════ */}
       <section className="py-24 px-4 bg-background">
         <div className="mx-auto max-w-6xl">
           <div className="text-center mb-16">
             <span className="bg-primary/10 text-primary font-black text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6 inline-block">
               Área do Cliente
             </span>
             <h2 className="text-3xl md:text-5xl font-black text-foreground mb-4">Peça agora no ItaSuper 🍕</h2>
             <p className="text-muted-foreground text-lg font-medium max-w-2xl mx-auto">
               A melhor experiência de delivery da cidade. Rápido, seguro e com as melhores lojas.
             </p>
           </div>
 
           <div className="space-y-12">
             <div className="max-w-2xl mx-auto" data-tour="search">
               <SearchBar value={search} onChange={setSearch} />
             </div>
 
             <div className="grid gap-8">
               <div className="rounded-[2.5rem] overflow-hidden shadow-2xl">
                 <PromoBanners />
               </div>
               
               <FirstOrderBanner />
 
               <div className="bg-muted/30 p-8 rounded-[2.5rem]" data-tour="categories">
                 <CategoryScroll selected={category} onSelect={setCategory} />
               </div>
 
               <ReorderSection />
             </div>
           </div>
         </div>
       </section>

       {/* ══════ STORES LISTING ══════ */}
       <section className="py-16 px-4 bg-muted/20">
         <div className="mx-auto max-w-7xl">
           <div className="flex items-center justify-between mb-8">
             <h2 className="text-2xl font-black text-foreground">Estabelecimentos</h2>
             <div className="h-1 flex-1 bg-border/50 mx-6 rounded-full hidden sm:block" />
             <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{filtered?.length || 0} lojas</span>
           </div>
           
           {isLoading ? (
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
               {Array.from({ length: 10 }).map((_, i) => <StoreCardSkeleton key={i} />)}
             </div>
           ) : filtered && filtered.length > 0 ? (
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
               {filtered.map((store, idx) => (
                 <div key={store.id} className="transition-transform hover:scale-[1.03]" {...(idx === 0 ? { "data-tour": "store-card" } : {})}>
                    <StoreCard {...store} is_open={store.computedOpen} statusReason={store.statusReason} distanceKm={(store as any).distanceKm} />
                 </div>
               ))}
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center py-24 text-center bg-card rounded-[3rem] border border-dashed border-border">
               <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                 <PackageOpen className="h-12 w-12 text-muted-foreground" />
               </div>
               <h2 className="text-2xl font-black text-foreground mb-2">
                 {search.length >= 2 ? "Nenhum resultado encontrado" : stores && stores.length === 0 ? "Estamos chegando!" : "Nenhum estabelecimento encontrado"}
               </h2>
               <p className="text-muted-foreground max-w-md font-medium">
                 {search.length >= 2 ? `Não encontramos lojas ou produtos para "${search}". Tente outro termo.` : "Novas lojas parceiras estão chegando em breve. Fique ligado!"}
               </p>
             </div>
           )}
         </div>
       </section>

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
       <footer className="bg-card pt-20 pb-10 border-t border-border px-4 mb-16 sm:mb-0">
         <div className="mx-auto max-w-7xl">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
             <div className="col-span-1 md:col-span-2">
               <div className="flex items-center gap-3 mb-6">
                 <img loading="lazy" decoding="async" src="/logo-itasuper-128.webp" alt="ItaSuper" className="w-12 h-12 rounded-2xl" />
                 <span className="text-2xl font-black text-primary">ItaSuper</span>
               </div>
               <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-md">
                 Transformando o delivery da sua cidade com tecnologia e simplicidade. 
                 O parceiro ideal para o crescimento do seu negócio.
               </p>
             </div>
             <div>
               <h4 className="font-black text-foreground uppercase tracking-widest text-xs mb-6">Institucional</h4>
               <ul className="space-y-4 font-bold text-muted-foreground">
                 <li><a href="/termos-de-uso" className="hover:text-primary transition-colors">Termos de Uso</a></li>
                 <li><a href="/politica-de-privacidade" className="hover:text-primary transition-colors">Política de Privacidade</a></li>
               </ul>
             </div>
             <div>
               <h4 className="font-black text-foreground uppercase tracking-widest text-xs mb-6">Contato</h4>
               <ul className="space-y-4 font-bold text-muted-foreground">
                  <li><a href="https://wa.me/5522992796291" target="_blank" className="hover:text-primary transition-colors">WhatsApp Suporte</a></li>
                 <li><a href="mailto:contato@itasuper.com.br" className="hover:text-primary transition-colors">E-mail</a></li>
               </ul>
             </div>
           </div>
           {/* Selo Asaas — obrigatório Resolução Conjunta nº 16/17 Banco Central */}
           <div className="py-8 border-t border-border flex flex-col items-center gap-3">
             <AsaasBadgeFooter />
             <p className="text-[10px] text-muted-foreground text-center">
               Dúvidas sobre serviços financeiros? Contate o Asaas diretamente:{" "}
               <a href="mailto:contato@asaas.com.br" className="underline hover:text-foreground">contato@asaas.com.br</a>
               {" "}| 0800 009 0037
             </p>
           </div>
           <div className="pb-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-6 pt-6">
             <p className="font-bold text-muted-foreground text-sm">
               © {new Date().getFullYear()} ItaSuper - Todos os direitos reservados.
             </p>
             <div className="flex items-center gap-6">
               <div className="flex flex-col items-end">
                 <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Desenvolvido por</span>
                 <span className="font-black text-primary">Lovable AI</span>
               </div>
             </div>
           </div>
         </div>
       </footer>

      <div data-tour="cart-fab"><CartFAB /></div>
      <BottomNav />
      <ProductTour steps={clienteTourSteps} tourKey="cliente" />
    </div>
  );
};

export default Index;
