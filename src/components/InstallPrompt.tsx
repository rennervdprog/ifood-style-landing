import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { useLocation } from "react-router-dom";
import { isGoNative } from "@/lib/gonative";
import { isCapacitorNative } from "@/lib/capacitorNative";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { pathname } = useLocation();
  // Não exibir em rotas de conversão (cobre botão "Finalizar pedido" no mobile)
  const isCheckoutFlow = /^\/(carrinho|checkout|pedido|finalizar)/i.test(pathname);

  useEffect(() => {
    // Don't show inside GoNative or Capacitor native app
    if (isGoNative() || isCapacitorNative()) return;

    // Don't show in iframe/preview
    try {
      if (window.self !== window.top) return;
    } catch { return; }
    if (window.location.hostname.includes("id-preview--") || window.location.hostname.includes("lovableproject.com")) return;

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Check if dismissed recently
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // Check visit count
    const visits = Number(localStorage.getItem("pwa-visit-count") || "0") + 1;
    localStorage.setItem("pwa-visit-count", String(visits));

    // iOS detection
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice && visits >= 2) {
      setShowPrompt(true);
      return;
    }

    // Android/Desktop install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (visits >= 2) setShowPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSGuide(false);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  };

  if (!showPrompt || isCheckoutFlow) return null;

  if (showIOSGuide) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 bg-card border border-border rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-4">
        <button onClick={handleDismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Como instalar no iPhone:</h3>
            <ol className="text-xs text-muted-foreground mt-1 space-y-1 list-decimal pl-3">
              <li>Toque no botão <strong>Compartilhar</strong> (ícone ↑) no Safari</li>
              <li>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></li>
              <li>Toque em <strong>"Adicionar"</strong></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-card border border-border rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-4">
      <button onClick={handleDismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <img loading="lazy" decoding="async" src="/logo-itasuper-128.webp" alt="ItaSuper" className="w-8 h-8 rounded-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-foreground">Instale o ItaSuper!</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Peça mais rápido direto da tela inicial.</p>
        </div>
        <button
          onClick={handleInstall}
          className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform"
        >
          <Download className="h-3.5 w-3.5" />
          Instalar
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
