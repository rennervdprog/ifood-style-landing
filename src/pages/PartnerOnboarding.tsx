import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { z } from "zod";
import {
  Store, Bike, ArrowLeft, ArrowRight, Camera, Upload,
  User, FileText, Truck, ChefHat, MessageCircle,
  Package, TrendingUp, Crown, Check, Zap, Star,
  Smartphone, QrCode, CreditCard, Bell, Shield,
  Clock, BarChart3, Gift, ChevronDown, Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Constants } from "@/integrations/supabase/types";
import { maskWhatsApp, isValidWhatsApp, formatWhatsAppNumber } from "@/lib/whatsapp";

type PartnerType = "lojista" | "motoboy" | null;

const storeCategories = Constants.public.Enums.store_category;

const lojistSchema = z.object({
  fullName: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  document: z.string().trim().min(11, "CPF/CNPJ inválido").max(18),
  storeName: z.string().trim().min(3, "Nome da loja deve ter pelo menos 3 caracteres").max(100),
  storeCategory: z.enum(storeCategories as unknown as [string, ...string[]], { errorMap: () => ({ message: "Selecione uma categoria" }) }),
  whatsapp: z.string().refine(isValidWhatsApp, "WhatsApp inválido. Digite com DDD (ex: 15 99999-9999)"),
});

const motoboySchema = z.object({
  fullName: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  document: z.string().trim().min(11, "CPF inválido").max(14),
  vehicle: z.string().trim().min(3, "Informe o modelo do veículo").max(100),
  whatsapp: z.string().refine(isValidWhatsApp, "WhatsApp inválido. Digite com DDD (ex: 15 99999-9999)"),
});

const categoryLabels: Record<string, string> = {
  lanches: "🍔 Lanches",
  pizzas: "🍕 Pizzas",
  restaurante: "🍽️ Restaurante / Marmitaria",
  adegas: "🍷 Adegas",
  japonesa: "🍣 Japonesa",
  saudavel: "🥗 Saudável",
  sobremesas: "🍰 Sobremesas",
  cafeteria: "☕ Cafeteria",
  churrasco: "🥩 Churrasco",
  farmacias: "💊 Farmácia / Drogaria",
  docerias: "🍰 Doceria / Confeitaria / Açaí",
};

/* ─── animated counter ─── */
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
const benefits = [
  { icon: QrCode, title: "Cardápio digital profissional", desc: "Fotos, preços e categorias. Atualização em tempo real pelo painel." },
  { icon: CreditCard, title: "PIX automático integrado", desc: "Receba pagamentos instantâneos com confirmação automática." },
  { icon: Bell, title: "Notificações em tempo real", desc: "Cada novo pedido dispara alerta sonoro e push notification." },
  { icon: BarChart3, title: "Painel financeiro completo", desc: "Veja comissões, repasses e faturamento em um só lugar." },
  { icon: Gift, title: "Programa de fidelidade", desc: "Clientes acumulam pontos e voltam a comprar automaticamente." },
  { icon: Smartphone, title: "Funciona no celular", desc: "Gerencie tudo pelo celular, sem precisar de computador." },
];

const howItWorks = [
  { step: "01", icon: Store, title: "Cadastre sua loja", desc: "Preencha os dados e seu cardápio fica pronto em minutos." },
  { step: "02", icon: QrCode, title: "Monte o cardápio", desc: "Adicione produtos, fotos e preços pelo painel de gestão." },
  { step: "03", icon: Bell, title: "Receba pedidos", desc: "Clientes pedem online e você recebe tudo organizado." },
  { step: "04", icon: TrendingUp, title: "Cresça seu negócio", desc: "Acompanhe relatórios e fidelize seus clientes." },
];

const testimonials = [
  { name: "João P.", role: "Pizzaria do João", text: "Desde que entrei no ItaSuper, meus pedidos triplicaram. O cardápio digital é profissional e fácil de usar.", rating: 5 },
  { name: "Maria L.", role: "Doceria Amor em Cada Fatia", text: "O PIX automático mudou minha vida! Não preciso mais ficar verificando comprovantes manualmente.", rating: 5 },
  { name: "Carlos R.", role: "Burger House", text: "O painel financeiro é incrível. Sei exatamente quanto vendi e quanto vou receber a cada semana.", rating: 5 },
];

const faqs = [
  { q: "Quanto tempo leva para começar a vender?", a: "Após o cadastro, sua loja pode estar ativa em menos de 24 horas. Basta montar seu cardápio e começar a receber pedidos." },
  { q: "Preciso de computador para gerenciar?", a: "Não! Tudo funciona perfeitamente pelo celular. O painel é 100% responsivo e otimizado para mobile." },
  { q: "Posso trocar de plano depois?", a: "Sim! Você pode mudar de plano a qualquer momento, sem multa ou fidelidade. Basta solicitar pelo painel." },
  { q: "Como funciona o período de teste?", a: "Nos planos pagos (Essencial e Crescimento), você ganha 7 dias grátis para testar tudo. O plano Comissão já é gratuito — sem mensalidade!" },
  { q: "Como faço para receber meus pagamentos?", a: "Os pagamentos via PIX são depositados diretamente na sua conta. Para pedidos em dinheiro/cartão, o repasse é semanal." },
];

const PartnerOnboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0); // 0 = landing, 1 = choose, 2 = plan (lojista), 3 = form
  const [partnerType, setPartnerType] = useState<PartnerType>(null);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [fullName, setFullName] = useState("");
  const [document, setDocument] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeCategory, setStoreCategory] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"fixed" | "hybrid" | "">("");

  const statsRef = useInView(0.3);
  const storesCount = useCountUp(50, 2000, statsRef.visible);
  const ordersCount = useCountUp(10, 2000, statsRef.visible);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  if (profile && (profile as any).role === "lojista") {
    navigate("/admin", { replace: true });
    return null;
  }
  if (profile && (profile as any).role === "motoboy") {
    navigate("/entregador", { replace: true });
    return null;
  }

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;
    const ext = imageFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("partner-images")
      .upload(path, imageFile, { upsert: true });
    if (error) { console.error("Upload error:", error); return null; }
    const { data: urlData } = supabase.storage.from("partner-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    setErrors({});
    if (partnerType === "lojista") {
      const result = lojistSchema.safeParse({ fullName, document, storeName, storeCategory, whatsapp });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach(e => { fieldErrors[e.path[0] as string] = e.message; });
        setErrors(fieldErrors);
        return;
      }
    } else {
      const result = motoboySchema.safeParse({ fullName, document, vehicle, whatsapp });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach(e => { fieldErrors[e.path[0] as string] = e.message; });
        setErrors(fieldErrors);
        return;
      }
    }

    setLoading(true);
    try {
      const avatarUrl = await uploadImage();
      const formattedWhatsapp = formatWhatsAppNumber(whatsapp);
      if (partnerType === "lojista") {
        const { error } = await supabase.rpc("register_as_lojista", {
          _full_name: fullName.trim(), _document: document.trim(), _store_name: storeName.trim(),
          _store_category: storeCategory, _avatar_url: avatarUrl, _whatsapp: formattedWhatsapp,
          _selected_plan: selectedPlan || "commission_only",
        } as any);
        if (error) throw error;
        toast.success("Cadastro realizado com sucesso! Bem-vindo ao ItaSuper. 🎉");
        navigate("/admin", { replace: true });
      } else {
        const { error } = await supabase.rpc("register_as_motoboy", {
          _full_name: fullName.trim(), _document: document.trim(), _vehicle: vehicle.trim(),
          _avatar_url: avatarUrl, _whatsapp: formattedWhatsapp,
        } as any);
        if (error) throw error;
        toast.success("Cadastro realizado com sucesso! Bem-vindo ao ItaSuper. 🎉");
        navigate("/entregador", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  const formStepNumber = partnerType === "lojista" ? 3 : 2;
  const totalSteps = partnerType === "lojista" ? 3 : 2;
  const currentFormStep = step === 0 ? 0 : step;
  const progressPercent = step > 0 ? (currentFormStep / totalSteps) * 100 : 0;

  /* ══════════════════════════════════════════════════════════════════
     STEP 0 — LANDING PAGE (persuasão)
     ══════════════════════════════════════════════════════════════════ */
  if (step === 0) {
    return (
      <div className="min-h-screen bg-background">
        {/* ── Hero ── */}
        <section className="relative py-16 md:py-24 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/20 pointer-events-none" />
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/8 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-accent/30 blur-3xl pointer-events-none" />

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary mb-6 animate-fade-in">
              <Zap className="h-4 w-4" />
              Seja parceiro ItaSuper
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-5 animate-fade-in">
              Transforme sua loja em um{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-primary">delivery digital</span>
                <span className="absolute bottom-1 left-0 w-full h-3 bg-primary/15 -z-0 rounded" />
              </span>
            </h1>

            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in leading-relaxed">
              Cardápio profissional, pedidos organizados e pagamentos automáticos.
              <span className="block mt-1 font-semibold text-primary">Comece grátis ou a partir de R$100/mês!</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in mb-3">
              <Button
                size="lg"
                onClick={() => {
                  if (!user) { navigate("/auth", { state: { from: "/parceiro" } }); return; }
                  setStep(1);
                }}
                className="text-base px-8 py-6 rounded-2xl shadow-lg shadow-primary/20"
              >
                Cadastrar minha loja — É grátis <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/portal-parceiro")} className="text-base px-8 py-6 rounded-2xl">
                Já sou parceiro
              </Button>
            </div>
            <p className="text-xs text-muted-foreground animate-fade-in">Sem cartão de crédito • Cancele quando quiser</p>

            <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground animate-fade-in mt-6">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-7 h-7 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-bold text-primary">
                    {["M", "J", "A", "R", "L"][i - 1]}
                  </div>
                ))}
              </div>
              <span>+50 lojistas já usam o ItaSuper</span>
            </div>
          </div>
        </section>

        {/* ── Como funciona ── */}
        <section className="py-16 px-4">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-3">Como funciona? 🚀</h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">Em 4 passos simples, sua loja está online.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {howItWorks.map((s, i) => (
                <div key={s.step} className="relative text-center group">
                  {i < 3 && <div className="hidden lg:block absolute top-6 left-[60%] w-[80%] h-px bg-border" />}
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

        {/* ── Stats ── */}
        <section ref={statsRef.ref} className="py-12 border-y border-border bg-muted/30">
          <div className="mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-4">
            {[
              { value: `${storesCount}+`, label: "Lojas parceiras" },
              { value: `${ordersCount}k+`, label: "Pedidos entregues" },
              { value: "< 5min", label: "Para montar o cardápio" },
              { value: "24h", label: "Suporte dedicado" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl md:text-4xl font-extrabold text-primary">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Benefits ── */}
        <section className="py-16 px-4">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-3">Tudo que você precisa para vender online</h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">Ferramentas profissionais para crescer seu negócio.</p>
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

        {/* ── Planos resumo ── */}
        <section className="py-16 px-4 bg-muted/20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-3">Planos que cabem no seu bolso 💰</h2>
            <p className="text-center text-muted-foreground mb-10 max-w-xl mx-auto">Sem contrato de fidelidade. Troque quando quiser.</p>
            <div className="grid sm:grid-cols-3 gap-5">
              {[
                { name: "Comissão", price: "R$0", sub: "/mês", desc: "6% por pedido", icon: Rocket, tags: ["Sem mensalidade", "PIX integrado", "Ideal para testar"], popular: false },
                { name: "Essencial", price: "R$90", sub: "/mês", desc: "0% de comissão", icon: Crown, tags: ["Zero comissão", "Lucro máximo", "Alto volume"], popular: true },
              ].map((plan) => (
                <Card key={plan.name} className={`rounded-2xl border-2 transition-all hover:shadow-lg relative ${plan.popular ? "border-primary shadow-md" : "border-border"}`}>
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-primary text-primary-foreground">⭐ Popular</span>
                  )}
                  <CardContent className="pt-8 pb-6 text-center">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <plan.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">{plan.name}</h3>
                    <div className="mt-2 mb-1">
                      <span className="text-3xl font-extrabold text-foreground">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">{plan.sub}</span>
                    </div>
                    <p className="text-sm font-semibold text-primary mb-4">{plan.desc}</p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {plan.tags.map(tag => (
                        <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button variant="outline" onClick={() => navigate("/planos")} className="rounded-2xl px-6">
                Ver comparativo completo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="py-16 px-4">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-3">O que nossos parceiros dizem ⭐</h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">Lojistas reais que transformaram seu delivery.</p>
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
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-16 px-4 bg-muted/20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-3">Perguntas frequentes</h2>
            <p className="text-center text-muted-foreground mb-10">Tire suas dúvidas antes de começar.</p>
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

        {/* ── CTA Final ── */}
        <section className="relative py-16 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/20 pointer-events-none" />
          <div className="relative mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
              <Rocket className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Pronto para vender mais?</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed max-w-lg mx-auto">
              Cadastre-se agora e tenha sua loja online em menos de 5 minutos.
              <span className="block mt-1 font-semibold text-primary">Comece grátis — sem cartão de crédito!</span>
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => {
                  if (!user) { navigate("/auth", { state: { from: "/parceiro" } }); return; }
                  setStep(1);
                }}
                className="text-base px-8 py-6 rounded-2xl shadow-lg shadow-primary/20"
              >
                Começar agora <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => window.open("https://wa.me/5522992796291?text=Olá! Tenho interesse em ser parceiro.", "_blank")}
                className="text-base px-8 py-6 rounded-2xl"
              >
                <MessageCircle className="mr-2 h-5 w-5" /> Falar conosco
              </Button>
            </div>
          </div>
        </section>

        {/* ── Guarantee ── */}
        <section className="py-10 px-4 bg-muted/30 border-y border-border">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Seguro e confiável</h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Pagamentos protegidos, dados criptografados e suporte dedicado. Sua loja em boas mãos.
            </p>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border px-4">
          <p className="font-semibold text-foreground mb-1">Itasuper</p>
          <p>© {new Date().getFullYear()} — Todos os direitos reservados</p>
          <div className="mt-3 flex items-center justify-center gap-4 text-xs">
            <a href="/termos-de-uso" className="hover:text-primary transition-colors">Termos</a>
            <a href="/politica-de-privacidade" className="hover:text-primary transition-colors">Política</a>
          </div>
        </footer>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     STEPS 1-3: FORM FLOW (original logic preserved)
     ══════════════════════════════════════════════════════════════════ */

  if (!user) {
    navigate("/auth", { state: { from: "/parceiro" }, replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => step > 1 ? setStep(step - 1) : setStep(0)}>
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-sm text-foreground">Seja um Parceiro</h1>
            <p className="text-xs text-muted-foreground">Passo {step} de {totalSteps}</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      <div className="px-4 py-6">
        {/* Step 1: Choose role */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-black text-foreground">Como quer participar?</h2>
              <p className="text-sm text-muted-foreground mt-1">Escolha como você quer fazer parte do ItaSuper</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { setPartnerType("lojista"); setStep(2); setSelectedPlan(""); }}
                className="w-full p-6 rounded-2xl border-2 transition-all text-left border-border bg-card hover:border-primary/50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Store className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">🏠 Quero Vender</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Abra sua loja e venda pelo ItaSuper</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => { setPartnerType("motoboy"); setStep(2); }}
                className="w-full p-6 rounded-2xl border-2 transition-all text-left border-border bg-card hover:border-primary/50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Bike className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">🏍️ Quero Entregar</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Faça entregas e ganhe dinheiro no ItaSuper</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2 (lojista): Plan Selection */}
        {step === 2 && partnerType === "lojista" && (
          <div className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-xl font-black text-foreground">Escolha seu plano</h2>
              <p className="text-sm text-muted-foreground mt-1">Sem contrato. Troque quando quiser.</p>
            </div>

            <button type="button" onClick={() => setSelectedPlan("fixed")}
              className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${selectedPlan === "fixed" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"><Package className="h-5 w-5 text-foreground" /></div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm text-foreground">Plano Essencial</h3>
                  <p className="text-xs text-muted-foreground">Ideal para alto volume</p>
                </div>
                <div className="text-right"><span className="text-lg font-black text-foreground">R$90</span><span className="text-xs text-muted-foreground">/mês</span></div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["0% taxa", "Dinheiro/Cartão", "Apenas motoboy próprio"].map(tag => (
                  <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tag}</span>
                ))}
              </div>
            </button>

            <button type="button" onClick={() => setSelectedPlan("hybrid")}
              className={`w-full text-left rounded-2xl border-2 p-4 transition-all relative ${selectedPlan === "hybrid" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
              <span className="absolute -top-2.5 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">⭐ Popular</span>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-primary" /></div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm text-foreground">Plano Crescimento</h3>
                  <p className="text-xs text-muted-foreground">Ideal para começar</p>
                </div>
                <div className="text-right"><span className="text-lg font-black text-foreground">R$100</span><span className="text-xs text-muted-foreground">/mês</span></div>
              </div>
              <p className="text-[10px] font-semibold text-primary mb-2">+ 2,5% por pedido entregue</p>
              <div className="flex flex-wrap gap-1.5">
                {["PIX integrado", "CRM completo", "Entrega plataforma*"].map(tag => (
                  <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{tag}</span>
                ))}
              </div>
            </button>

            <button type="button"
              onClick={() => { if (selectedPlan) setStep(3); else toast.error("Selecione um plano."); }}
              disabled={!selectedPlan}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              Próximo <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 2 (motoboy) or Step 3 (lojista): Form */}
        {((step === 2 && partnerType === "motoboy") || (step === 3 && partnerType === "lojista")) && partnerType && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-xl font-black text-foreground">
                {partnerType === "lojista" ? "Dados da sua Loja" : "Dados do Entregador"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Preencha os dados para começar</p>
            </div>

            <div className="flex justify-center">
              <button onClick={() => fileInputRef.current?.click()}
                className="relative w-24 h-24 rounded-2xl bg-muted border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden">
                {imagePreview ? (
                  <img loading="lazy" decoding="async" src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Foto</span>
                  </div>
                )}
                <div className="absolute bottom-1 right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Upload className="h-3 w-3 text-primary-foreground" />
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>

            <div className="space-y-4">
              <InputField icon={User} label="Nome Completo" placeholder="Seu nome completo" value={fullName} onChange={setFullName} error={errors.fullName} />
              <InputField icon={FileText} label="CPF / CNPJ" placeholder={partnerType === "lojista" ? "CPF ou CNPJ" : "Seu CPF"} value={document} onChange={setDocument} error={errors.document} inputMode="numeric" />

              <div>
                <label className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-500" />
                  {partnerType === "lojista" ? "WhatsApp do Estabelecimento" : "Seu WhatsApp para Contato"}
                </label>
                <p className="text-xs text-muted-foreground mb-2">Digite o número com DDD (ex: 15 99999-9999)</p>
                <input type="tel" inputMode="tel" placeholder="(14) 99999-9999" value={whatsapp}
                  onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-green-500/30 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
                {errors.whatsapp && <p className="text-xs text-destructive mt-1">{errors.whatsapp}</p>}
              </div>

              {partnerType === "lojista" && (
                <>
                  <InputField icon={Store} label="Nome da Loja" placeholder="Ex: Pizzaria do João" value={storeName} onChange={setStoreName} error={errors.storeName} />
                  <div>
                    <label className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-2">
                      <ChefHat className="h-4 w-4 text-muted-foreground" /> Categoria
                    </label>
                    <select value={storeCategory} onChange={(e) => setStoreCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none">
                      <option value="">Selecione a categoria</option>
                      {storeCategories.map(cat => (
                        <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
                      ))}
                    </select>
                    {errors.storeCategory && <p className="text-xs text-destructive mt-1">{errors.storeCategory}</p>}
                  </div>
                </>
              )}

              {partnerType === "motoboy" && (
                <InputField icon={Truck} label="Modelo do Veículo" placeholder="Ex: Honda Fan 150" value={vehicle} onChange={setVehicle} error={errors.vehicle} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom button */}
      {((step === 2 && partnerType === "motoboy") || (step === 3 && partnerType === "lojista")) && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border">
          <button onClick={handleSubmit} disabled={loading}
            className="w-full bg-secondary text-secondary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-secondary-foreground/30 border-t-secondary-foreground rounded-full animate-spin" /> Cadastrando...
              </span>
            ) : partnerType === "lojista" ? (
              <>Abrir Minha Loja <ArrowRight className="h-4 w-4" /></>
            ) : (
              <>Começar a Entregar <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

const InputField = ({ icon: Icon, label, placeholder, value, onChange, error, inputMode }: {
  icon: React.ElementType; label: string; placeholder: string; value: string;
  onChange: (v: string) => void; error?: string; inputMode?: "text" | "numeric";
}) => (
  <div>
    <label className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" /> {label}
    </label>
    <input type="text" inputMode={inputMode} placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

export default PartnerOnboarding;
