import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Bell, Bike, Download, MapPin, ShieldCheck, Zap,
} from "lucide-react";
import { ENTREGADOR_APP } from "@/lib/entregadorApp";

// Página pública de download do app ItaSuper Entregador (Android).
// Os dados da versão vivem em src/lib/entregadorApp.ts e o APK
// assinado em public/apps/ — atualizar os dois juntos a cada versão.
const DownloadApp = () => {
  const app = ENTREGADOR_APP;
  const apkUrl = `https://www.itasuper.com.br${app.apkPath}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{`Baixar ${app.name} (APK Android) — ItaSuper`}</title>
        <meta
          name="description"
          content={`Baixe grátis o ${app.name}: o app oficial do entregador ItaSuper. APK Android oficial, versão ${app.version}, ${app.sizeLabel}.`}
        />
        <link rel="canonical" href="https://www.itasuper.com.br/download" />
        <meta property="og:title" content={`Baixar ${app.name} — ItaSuper`} />
        <meta property="og:description" content="O app oficial do entregador ItaSuper: receba ofertas, aceite na tela do aviso e acompanhe sua rota." />
        <meta property="og:url" content="https://www.itasuper.com.br/download" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "MobileApplication",
          name: app.name,
          operatingSystem: "Android",
          applicationCategory: "BusinessApplication",
          softwareVersion: app.version,
          fileSize: app.sizeLabel,
          downloadUrl: apkUrl,
          installUrl: "https://www.itasuper.com.br/download",
          author: { "@type": "Organization", name: app.developer },
          offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
        })}</script>
      </Helmet>

      {/* ── Topbar ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <Link to="/" className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-bold text-foreground flex-1 truncate">{app.name}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto pb-16">
        {/* ── Cabeçalho do app ── */}
        <div className="px-4 pt-6 pb-2">
          <div className="flex items-start gap-4">
            <div className="w-[84px] h-[84px] rounded-[24px] bg-primary shadow-lg shadow-primary/35 flex items-center justify-center shrink-0">
              <Bike className="h-11 w-11 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-2xl font-black text-foreground leading-tight">{app.name}</h1>
              <p className="text-sm text-primary font-bold mt-0.5">{app.developer}</p>
              <p className="text-xs text-muted-foreground mt-0.5">App oficial do entregador · Android</p>
              <span className="inline-block mt-2.5 bg-primary text-primary-foreground text-[11px] font-extrabold px-2.5 py-1 rounded-full tracking-wide">
                VERSÃO {app.version}
              </span>
            </div>
          </div>

          {/* Números */}
          <div className="flex items-center justify-around mt-5 py-3.5 border-y border-border/40 text-center">
            {[
              { label: "Tamanho", value: app.sizeLabel },
              { label: "Versão", value: `v${app.version}` },
              { label: "Requer", value: `Android ${app.minAndroid}+` },
              { label: "Preço", value: "Grátis" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-sm font-black text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Botão de download ── */}
        <div className="px-4 pt-5 pb-1">
          <a
            href={app.apkPath}
            download
            className="w-full bg-primary text-primary-foreground font-black rounded-2xl flex items-center justify-center gap-2 text-base active:scale-[0.98] transition-all shadow-lg shadow-primary/25 py-4"
          >
            <Download className="h-5 w-5" />
            Baixar o app
          </a>
          <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1 mt-2.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            APK oficial assinado · arquivo verificado e seguro
          </p>
        </div>

        {/* ── Novidades ── */}
        <div className="px-4 py-6 border-b border-border/40">
          <h2 className="text-base font-black text-foreground mb-3">Novidades da versão {app.version}</h2>
          <ul className="space-y-2">
            {app.whatsNew.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-foreground/80 leading-relaxed">
                <span className="text-primary font-black">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Recursos ── */}
        <div className="px-4 py-6 border-b border-border/40">
          <h2 className="text-base font-black text-foreground mb-3">Feito para o seu dia de entregas</h2>
          <div className="space-y-4">
            {[
              {
                icon: Bell,
                title: "Ofertas na hora",
                desc: "O aviso de nova entrega aparece na tela mesmo com o app fechado, com o som de alerta.",
              },
              {
                icon: Zap,
                title: "Aceite no app",
                desc: "Toque em Ver entrega no aviso e aceite dentro do app, com a oferta já carregada na tela.",
              },
              {
                icon: MapPin,
                title: "Rota acompanhada",
                desc: "Sua posição é compartilhada com a loja durante a entrega, do início à finalização com PIN.",
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{f.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Como instalar ── */}
        <div className="px-4 py-6 border-b border-border/40">
          <h2 className="text-base font-black text-foreground mb-4">Como instalar</h2>
          <div className="space-y-2.5">
            {[
              { n: "01", title: "Baixe o APK", desc: `Toque no botão de download acima para baixar o arquivo (${app.sizeLabel}).` },
              { n: "02", title: "Permita a instalação", desc: "O Android vai pedir permissão para instalar de fontes externas. Toque em Configurações e autorize — é o app oficial do ItaSuper." },
              { n: "03", title: "Instale e entre", desc: "Conclua a instalação, abra o app e faça login com sua conta de entregador. Pronto para receber ofertas!" },
            ].map((step) => (
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

        {/* ── Lojista ── */}
        <div className="px-4 py-6">
          <div className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">É lojista?</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Sua loja é gerenciada pelo painel web, no celular ou no computador.
              </p>
            </div>
            <Link
              to="/portal-parceiro"
              className="shrink-0 bg-foreground text-background text-xs font-extrabold px-3.5 py-2.5 rounded-xl active:scale-95 transition-transform"
            >
              Acessar o painel
            </Link>
          </div>
        </div>

        {/* ── Rodapé ── */}
        <div className="px-4 pt-1 pb-6 text-center space-y-1">
          <p className="text-[11px] text-muted-foreground">
            <span className="font-bold text-foreground">{app.developer}</span> · {app.name} v{app.version}
          </p>
          <p className="text-[11px] text-muted-foreground">Feito em Araruama/RJ, para todo o Brasil</p>
        </div>
      </div>
    </div>
  );
};

export default DownloadApp;
