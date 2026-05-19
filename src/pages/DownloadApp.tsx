import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Download, ShieldCheck, Star, Bell, Wifi, MapPin,
  Camera, Mic, ChevronLeft, ChevronRight, Check,
  Smartphone, Apple, ArrowLeft, Package, Clock,
  BarChart3, MessageCircle, Zap,
} from "lucide-react";

const PERM_ICONS: Record<string, any> = {
  bell: Bell, wifi: Wifi, "map-pin": MapPin, camera: Camera,
  mic: Mic, smartphone: Smartphone,
};

const FEATURE_ICONS = [Package, Bell, BarChart3, MessageCircle, Clock, Zap];

interface AppData {
  app_name: string;
  tagline: string;
  description: string;
  version: string;
  size_mb: string;
  rating: number;
  downloads: string;
  apk_url: string | null;
  play_store_url: string | null;
  icon_url: string | null;
  screenshots: { url: string; caption?: string }[];
  permissions: { icon: string; title: string; desc: string }[];
  whats_new: string;
  developer: string;
  category: string;
  is_published: boolean;
}

const DEFAULT: AppData = {
  app_name: "ItaSuper Parceiro",
  tagline: "Gerencie sua loja e entregas com total controle",
  description: "O app oficial para lojistas e motoboys do ItaSuper.",
  version: "1.2.62",
  size_mb: "28 MB",
  rating: 5.0,
  downloads: "500+",
  apk_url: null,
  play_store_url: null,
  icon_url: "/icon-parceiro.png",
  screenshots: [],
  permissions: [
    { icon: "bell",    title: "Notificações", desc: "Para alertar sobre novos pedidos em tempo real" },
    { icon: "mic",     title: "Áudio",        desc: "Para tocar o alerta sonoro de novos pedidos" },
    { icon: "map-pin", title: "Localização",  desc: "Para calcular distâncias de entrega (opcional)" },
    { icon: "wifi",    title: "Internet",     desc: "Para sincronizar pedidos e dados da loja" },
    { icon: "camera",  title: "Câmera",       desc: "Para adicionar fotos ao cardápio (opcional)" },
  ],
  whats_new: "Melhorias de desempenho e correções de bugs.",
  developer: "ItaSuper",
  category: "Negócios",
  is_published: true,
};

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1,2,3,4,5].map(i => (
      <Star key={i} className={`h-3.5 w-3.5 ${i <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
    ))}
  </div>
);

const DownloadApp = () => {
  const [data, setData] = useState<AppData>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [screenshotIdx, setScreenshotIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  useEffect(() => {
    Promise.resolve(
      supabase
        .from("app_store_page" as any)
        .select("*")
        .eq("app_type", "parceiro")
        .eq("is_published", true)
        .maybeSingle()
    ).then(({ data: d }) => {
      if (d) setData(d as any);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleDownload = () => {
    const url = data.apk_url;
    if (!url) return;
    setDownloading(true);
    window.open(url, "_blank");
    setTimeout(() => setDownloading(false), 3000);
  };

  const descLines = data.description.split("\n").filter(Boolean);
  const shortDesc = descLines.slice(0, 2).join(" ");
  const hasMore = descLines.length > 2;

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Topbar ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <Link to="/" className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-bold text-foreground flex-1 truncate">{data.app_name}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto pb-24">

        {/* ── Header do app ── */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-start gap-4">
            {/* Ícone */}
            <div className="w-20 h-20 rounded-[22px] overflow-hidden border border-border/40 shrink-0 shadow-md bg-muted/30">
              {data.icon_url ? (
                <img src={data.icon_url} alt={data.app_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <Smartphone className="h-8 w-8 text-primary" />
                </div>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-xl font-black text-foreground leading-tight">{data.app_name}</h1>
              <p className="text-sm text-primary font-semibold mt-0.5">{data.developer}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{data.category}</p>
              <div className="flex items-center gap-2 mt-2">
                <Stars rating={data.rating} />
                <span className="text-xs text-muted-foreground">{data.rating.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-around mt-5 py-3 border-y border-border/40">
            {[
              { label: "Downloads", value: data.downloads },
              { label: "Avaliação", value: data.rating.toFixed(1) },
              { label: "Tamanho", value: data.size_mb },
              { label: "Versão", value: `v${data.version}` },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-sm font-black text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Botão de download ── */}
        <div className="px-4 pb-5">
          {data.play_store_url ? (
            <button
              onClick={() => window.open(data.play_store_url!, "_blank")}
              className="w-full h-13 bg-primary text-primary-foreground font-black rounded-2xl flex items-center justify-center gap-2 text-base active:scale-[0.98] transition-all shadow-lg shadow-primary/25 py-3.5"
            >
              <Download className="h-5 w-5" />
              Google Play Store
            </button>
          ) : data.apk_url ? (
            <div className="space-y-2">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full bg-primary text-primary-foreground font-black rounded-2xl flex items-center justify-center gap-2 text-base active:scale-[0.98] transition-all shadow-lg shadow-primary/25 py-3.5 disabled:opacity-70"
              >
                {downloading ? (
                  <>
                    <Check className="h-5 w-5" />
                    Iniciando download...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    Baixar APK — {data.size_mb}
                  </>
                )}
              </button>
              <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                Arquivo verificado e seguro · Requer Android 7.0+
              </p>
            </div>
          ) : (
            <div className="w-full bg-muted rounded-2xl py-4 text-center text-sm text-muted-foreground font-semibold">
              Em breve disponível para download
            </div>
          )}

          {/* iOS */}
          <div className="mt-3 flex items-center gap-3 bg-muted/40 rounded-2xl px-4 py-3 border border-border/40">
            <Apple className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-foreground">iOS — Em breve</p>
              <p className="text-[10px] text-muted-foreground">Use a versão web em itasuper.com.br</p>
            </div>
            <span className="text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">PWA</span>
          </div>
        </div>

        {/* ── Screenshots ── */}
        {data.screenshots.length > 0 && (
          <div className="pb-6">
            <div className="px-4 mb-3">
              <h2 className="text-base font-black text-foreground">Capturas de tela</h2>
            </div>
            <div className="relative">
              <div className="flex gap-3 overflow-x-auto px-4 scrollbar-hide pb-2">
                {data.screenshots.map((s, i) => (
                  <div key={i}
                    onClick={() => setScreenshotIdx(i)}
                    className={`shrink-0 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                      screenshotIdx === i ? "border-primary" : "border-border/40"
                    }`}
                    style={{ width: 160, height: 284 }}>
                    <img src={s.url} alt={s.caption || `Screenshot ${i+1}`}
                      className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Sobre o app ── */}
        <div className="px-4 pb-6 border-b border-border/40">
          <h2 className="text-base font-black text-foreground mb-3">Sobre este app</h2>
          <div className="text-sm text-foreground/80 leading-relaxed space-y-2">
            {showFullDesc || !hasMore ? (
              descLines.map((line, i) => <p key={i}>{line}</p>)
            ) : (
              <p>{shortDesc}...</p>
            )}
          </div>
          {hasMore && (
            <button
              onClick={() => setShowFullDesc(!showFullDesc)}
              className="text-primary text-sm font-bold mt-2"
            >
              {showFullDesc ? "Ver menos" : "Ver mais"}
            </button>
          )}
        </div>

        {/* ── Novidades ── */}
        {data.whats_new && (
          <div className="px-4 py-5 border-b border-border/40">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-black text-foreground">Novidades</h2>
              <span className="text-xs text-muted-foreground">v{data.version}</span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{data.whats_new}</p>
          </div>
        )}

        {/* ── Segurança dos dados ── */}
        <div className="px-4 py-5 border-b border-border/40">
          <h2 className="text-base font-black text-foreground mb-1">Segurança dos dados</h2>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Entenda como o app coleta e usa seus dados.
          </p>
          <div className="border border-border/60 rounded-2xl divide-y divide-border/40 overflow-hidden">
            {[
              { icon: ShieldCheck, text: "Dados criptografados em trânsito" },
              { icon: Check,       text: "Sem compartilhamento com terceiros" },
              { icon: Check,       text: "Exclusão de conta disponível" },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3 bg-card/50">
                  <Icon className="h-4 w-4 text-emerald-500 shrink-0" />
                  <p className="text-sm text-foreground/80">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Permissões ── */}
        {data.permissions.length > 0 && (
          <div className="px-4 py-5 border-b border-border/40">
            <h2 className="text-base font-black text-foreground mb-1">Permissões solicitadas</h2>
            <p className="text-xs text-muted-foreground mb-4">O app solicita acesso apenas ao necessário para funcionar.</p>
            <div className="space-y-3">
              {data.permissions.map((perm, i) => {
                const Icon = PERM_ICONS[perm.icon] || Bell;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{perm.title}</p>
                      <p className="text-xs text-muted-foreground">{perm.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Guia de instalação ── */}
        <div className="px-4 py-5">
          <h2 className="text-base font-black text-foreground mb-4">Como instalar</h2>
          <div className="space-y-3">
            {[
              { n: "01", title: "Baixe o APK",           desc: "Toque no botão de download acima para baixar o arquivo." },
              { n: "02", title: "Permita a instalação",  desc: "Android pedirá permissão para instalar de fontes externas. Toque em Configurações e autorize." },
              { n: "03", title: "Instale e abra",        desc: "Conclua a instalação e faça seu login. Pronto!" },
            ].map(step => (
              <div key={step.n} className="flex gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/40">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black shrink-0">
                  {step.n}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-4 pt-2 pb-8 text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Dúvidas?{" "}
            <Link to="/" className="text-primary font-bold">Fale com o suporte</Link>
          </p>
          <p className="text-[10px] text-muted-foreground">
            {data.developer} · v{data.version} · {data.category}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DownloadApp;
