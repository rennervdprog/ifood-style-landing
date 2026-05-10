import { useEffect, useState } from "react";
import { Smartphone, X, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isCapacitorNative } from "@/lib/capacitorNative";
import { isGoNative } from "@/lib/gonative";

/**
 * Banner exibido APENAS em navegadores Android (não-Capacitor, não-iOS),
 * sugerindo a instalação do APK nativo. Direciona para /download.
 *
 * Regras:
 * - Só aparece em Android web puro (Chrome / Samsung Internet / etc.).
 * - Nunca aparece dentro do app Capacitor / GoNative / iOS / preview / iframe.
 * - Respeita dismiss por 7 dias (localStorage).
 */
const DISMISS_KEY = "android-download-prompt-dismissed";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DownloadAppPrompt = () => {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Não mostrar dentro de qualquer app nativo
    if (isCapacitorNative() || isGoNative()) return;

    // Não mostrar em iframe / preview Lovable
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }
    const host = window.location.hostname;
    if (host.includes("id-preview--") || host.includes("lovableproject.com")) return;

    // Detectar Android (excluindo iOS e desktop)
    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    if (!isAndroid || isIOS) return;

    // Já estamos na página de download? não mostra
    if (window.location.pathname.startsWith("/download")) return;

    // Dismiss recente
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL_MS) return;

    // Pequeno delay para não competir com o LCP
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-card border border-border rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-4">
      <button
        onClick={dismiss}
        aria-label="Fechar"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Smartphone className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="font-bold text-sm text-foreground">Baixe o app no Android</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mais rápido, com notificações de pedido em tempo real.
          </p>
        </div>
        <button
          onClick={() => {
            setShow(false);
            navigate("/download");
          }}
          className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform"
        >
          <Download className="h-3.5 w-3.5" />
          Baixar
        </button>
      </div>
    </div>
  );
};

export default DownloadAppPrompt;