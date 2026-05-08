import { 
  Smartphone, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Apple, 
  Store, 
  ExternalLink, 
  ShieldCheck, 
  Info, 
  Check,
  ArrowRight,
  Globe,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AppVersionData {
  version: string;
  url: string;
  updated_at: string;
  app_name: string;
}
 
 const DownloadApp = () => {
  // Configurações Globais
  const [appType, setAppType] = useState<"client" | "partner">("client");
  const [versions, setVersions] = useState<Record<string, AppVersionData | null>>({
    client: null,
    partner: null
  });

  useEffect(() => {
    const fetchVersions = async () => {
      const fetchType = async (type: "client" | "partner") => {
        try {
          const { data } = await supabase.storage
            .from('app-releases')
            .download(`version-${type === 'client' ? 'cliente' : 'parceiro'}.json`);
          
          if (data) {
            const text = await data.text();
            const json = JSON.parse(text);
            setVersions(prev => ({ ...prev, [type]: json }));
          }
        } catch (error) {
          console.warn(`Failed to fetch version for ${type}:`, error);
        }
      };

      fetchType("client");
      fetchType("partner");
    };

    fetchVersions();
  }, []);
  
  const config = {
    client: {
      name: "ItaSuper",
      isAvailableOnPlayStore: false,
      playStoreUrl: "https://play.google.com/store/apps/details?id=app.itasuper.cliente",
      apkUrl: versions.client?.url || "https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/app-releases/itasuper-cliente.apk",
      version: versions.client?.version || "1.0.0",
      icon: "/icon-cliente.png",
      description: "Peça comida, mercado e muito mais com o melhor delivery da região."
    },
    partner: {
      name: "ItaSuper Parceiro",
      isAvailableOnPlayStore: false,
      playStoreUrl: "https://play.google.com/store/apps/details?id=app.itasuper.parceiro",
      apkUrl: versions.partner?.url || "https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/app-releases/itasuper-parceiro.apk",
      version: versions.partner?.version || "1.0.0",
      icon: "/icon-parceiro.png",
      description: "Gerencie sua loja e suas entregas de forma profissional e eficiente."
    }
  };

  const currentConfig = config[appType];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      {/* Hero Section Background */}
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-primary/10 via-background to-background -z-10" />

      <div className="max-w-5xl mx-auto px-4 pt-12 pb-24 space-y-16">
        {/* Header */}
        <header className="flex flex-col items-center text-center space-y-6">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-1 rounded-3xl bg-white shadow-xl border border-primary/10"
          >
            <img src="/logo-itasuper-128.webp" alt="Logo" className="w-20 h-20 rounded-2xl" />
          </motion.div>

          <div className="space-y-2">
            <Badge variant="outline" className="px-4 py-1 rounded-full text-primary border-primary/20 bg-primary/5">
              Aplicativo Oficial
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
              {currentConfig.name}
            </h1>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              {currentConfig.description}
            </p>
          </div>

          {/* Switcher */}
          <div className="inline-flex p-1 bg-muted rounded-xl">
            <button 
              onClick={() => setAppType("client")}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${appType === "client" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Para Clientes
            </button>
            <button 
              onClick={() => setAppType("partner")}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${appType === "partner" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Para Parceiros
            </button>
          </div>
        </header>

        {/* Download Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <AnimatePresence mode="wait">
            <motion.div
              key={appType}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <Card className="border-2 shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4">
                  <img src={currentConfig.icon} alt="Icon" className="w-12 h-12 rounded-xl opacity-20 grayscale" />
                </div>
                
                <CardHeader>
                  <div className="flex items-center gap-3 text-primary mb-2">
                    <Smartphone className="h-6 w-6" />
                    <span className="font-bold uppercase tracking-wider text-xs">Versão Android</span>
                  </div>
                  <CardTitle className="text-2xl font-black">Pronto para download</CardTitle>
                  <CardDescription>
                    {currentConfig.isAvailableOnPlayStore 
                      ? "Baixe diretamente da Google Play Store." 
                      : "Instale a versão beta diretamente no seu aparelho."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {currentConfig.isAvailableOnPlayStore ? (
                    <Button 
                      size="lg" 
                      className="w-full h-16 text-lg font-bold gap-3 rounded-2xl shadow-md hover:shadow-lg transition-all"
                      onClick={() => window.open(currentConfig.playStoreUrl, "_blank")}
                    >
                      <Store className="h-6 w-6" />
                      Google Play Store
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Button 
                        size="lg" 
                        className="w-full h-16 text-lg font-bold gap-3 rounded-2xl shadow-md hover:shadow-lg transition-all"
                        onClick={() => window.open(currentConfig.apkUrl, "_blank")}
                      >
                        <Download className="h-6 w-6" />
                        Baixar APK Direto
                      </Button>
                      <p className="text-[11px] text-muted-foreground flex items-start gap-2 px-1">
                        <Info className="h-3 w-3 mt-0.5 shrink-0" />
                        O download direto requer permissão de "Instalar apps de fontes desconhecidas" no seu Android.
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-600 font-semibold text-xs">
                      <ShieldCheck className="h-4 w-4" />
                      Arquivo Seguro
                    </div>
                    {currentConfig.version && (
                      <div className="text-[10px] text-muted-foreground">
                        V. {currentConfig.version} • Beta
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-muted bg-muted/30">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-background rounded-xl border border-border shadow-sm">
                    <Apple className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm">Disponível em breve no iOS</h4>
                    <p className="text-xs text-muted-foreground">Estamos trabalhando na versão para App Store.</p>
                  </div>
                  <Badge variant="secondary" className="bg-muted text-[10px]">COMING SOON</Badge>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Tutorial Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <HelpCircle className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-xl font-black tracking-tight">Guia de Instalação</h2>
            </div>

            <Tabs defaultValue="android" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="android" className="flex items-center gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary">
                  <Smartphone className="h-4 w-4" /> Android
                </TabsTrigger>
                <TabsTrigger value="ios" className="flex items-center gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary">
                  <Apple className="h-4 w-4" /> iOS
                </TabsTrigger>
              </TabsList>

              <TabsContent value="android" className="mt-6 space-y-4">
                {[
                  {
                    step: "01",
                    title: "Baixe o APK",
                    text: "Clique no botão azul de download para baixar o arquivo instalador."
                  },
                  {
                    step: "02",
                    title: "Permita a instalação",
                    text: "Ao abrir, seu sistema Android pode pedir permissão para instalar apps fora da Play Store. Toque em 'Configurações' e autorize."
                  },
                  {
                    step: "03",
                    title: "Tudo pronto!",
                    text: "Conclua a instalação e abra o app. Você já pode fazer seu login e aproveitar."
                  }
                ].map((item, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex gap-4 p-4 rounded-2xl border border-border/50 bg-background/50 hover:bg-background transition-colors"
                  >
                    <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary flex items-center justify-center rounded-xl font-black text-sm">
                      {item.step}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm">{item.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
                    </div>
                  </motion.div>
                ))}
              </TabsContent>

              <TabsContent value="ios" className="mt-6 space-y-4">
                <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-2xl border border-orange-200 dark:border-orange-900 mb-6 flex gap-3 items-start">
                  <Info className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-800 dark:text-orange-200 leading-relaxed font-medium">
                    Enquanto não estamos na App Store, você pode usar a versão Web App (PWA) que funciona exatamente como um aplicativo.
                  </p>
                </div>

                {[
                  {
                    step: "01",
                    title: "Abra no Safari",
                    text: "Acesse nosso site oficial pelo navegador Safari do seu iPhone."
                  },
                  {
                    step: "02",
                    title: "Compartilhar",
                    text: "Toque no ícone de compartilhar (quadrado com seta para cima) na barra inferior."
                  },
                  {
                    step: "03",
                    title: "Tela de Início",
                    text: "Escolha a opção 'Adicionar à Tela de Início'. O ícone aparecerá junto aos seus outros apps."
                  }
                ].map((item, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex gap-4 p-4 rounded-2xl border border-border/50 bg-background/50 hover:bg-background transition-colors"
                  >
                    <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary flex items-center justify-center rounded-xl font-black text-sm">
                      {item.step}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm">{item.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
                    </div>
                  </motion.div>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Features/Trust Section */}
        <section className="pt-8 border-t border-border/50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-4 bg-muted/50 rounded-2xl">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <h5 className="font-bold text-sm">Atualizações Automáticas</h5>
              <p className="text-xs text-muted-foreground">O app se mantém atualizado sempre que abri-lo.</p>
            </div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-4 bg-muted/50 rounded-2xl">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h5 className="font-bold text-sm">Segurança de Dados</h5>
              <p className="text-xs text-muted-foreground">Seus dados são criptografados e protegidos.</p>
            </div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-4 bg-muted/50 rounded-2xl">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <h5 className="font-bold text-sm">Experiência Completa</h5>
              <p className="text-xs text-muted-foreground">Acesso total a cupons, rastreamento e notificações.</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center space-y-4 pt-12">
          <p className="text-xs text-muted-foreground">
            Problemas com a instalação? <Link to="/contato" className="text-primary font-bold hover:underline">Fale com o suporte</Link>
          </p>
          <div className="flex items-center justify-center gap-6 pt-4">
            <Link to="/" className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              Voltar ao Site <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DownloadApp;