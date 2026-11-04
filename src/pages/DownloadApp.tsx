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
  const apkFileName = app.apkPath.split("/").pop() ?? "itasuper-entregador.apk";

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

        {/* ── Como instalar (tutorial visual com prints reais) ── */}
        <div className="px-4 py-6 border-b border-border/40">
          <h2 className="text-base font-black text-foreground mb-4">Como instalar</h2>
          <div className="space-y-7">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black shrink-0">1</div>
                <p className="text-sm font-bold text-foreground">Baixe e abra o arquivo</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                Toque em <span className="font-bold text-foreground">Baixar o app</span> aqui em cima. Depois, abra o arquivo{" "}
                <span className="font-bold text-foreground">{apkFileName}</span> na pasta <span className="font-bold text-foreground">Downloads</span>{" "}
                do celular (ou toque na notificação de download concluído).
              </p>
              <img src="/download/passo1-downloads.jpg" alt="Pasta Downloads do celular com o arquivo do app ItaSuper Entregador no topo da lista" loading="lazy" className="mt-3 w-full rounded-2xl border border-border/40" />
              <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                Na primeira vez, o Android pode pedir para <span className="font-bold text-foreground">permitir a instalação pelo navegador</span> —
                toque em Configurações/Permitir e ligue a opção. É rápido e só acontece uma vez.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black shrink-0">2</div>
                <p className="text-sm font-bold text-foreground">Se o Play Protect bloquear, toque em "Mais detalhes"</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                Pode aparecer o aviso <span className="font-bold text-foreground">"O app foi bloqueado para proteger seu dispositivo"</span>.
                Não toque em "Entendi" (ele cancela a instalação). Toque em <span className="font-bold text-foreground">Mais detalhes</span>.
              </p>
              <img src="/download/passo2-playprotect.jpg" alt="Aviso do Google Play Protect mostrando a opção Mais detalhes" loading="lazy" className="mt-3 w-full rounded-2xl border border-border/40" />
            </div>

            <div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black shrink-0">3</div>
                <p className="text-sm font-bold text-foreground">Toque em "Instalar assim mesmo"</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                Vai aparecer a opção <span className="font-bold text-foreground">Instalar assim mesmo</span>. Toque nela e aguarde a instalação terminar.
              </p>
              <img src="/download/passo3-instalar-assim-mesmo.jpg" alt="Aviso do Google Play Protect expandido, com a opção Instalar assim mesmo" loading="lazy" className="mt-3 w-full rounded-2xl border border-border/40" />
            </div>

            <div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black shrink-0">4</div>
                <p className="text-sm font-bold text-foreground">Pronto: abra e entre</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                Com o <span className="font-bold text-foreground">"App instalado"</span> na tela, toque em{" "}
                <span className="font-bold text-foreground">Abrir</span> e entre com a sua conta de entregador. Boas entregas!
              </p>
              <img src="/download/passo4-instalado.jpg" alt="Tela de confirmação App instalado, com os botões Concluído e Abrir" loading="lazy" className="mt-3 w-full rounded-2xl border border-border/40" />
            </div>
          </div>

          <div className="mt-7 flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-foreground/80">
              <span className="font-bold text-foreground">Por que esse aviso aparece?</span>{" "}
              O Google Play Protect mostra esse alerta para qualquer app instalado fora da Play Store, porque ele ainda não conhece o
              desenvolvedor. O app {app.name} é distribuído pelo site oficial <span className="font-bold text-foreground">itasuper.com.br</span>,
              com arquivo assinado — pode instalar sem medo.
            </p>
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
