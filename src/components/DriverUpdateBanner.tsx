import { useEffect, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { isCapacitorNative } from "@/lib/capacitorNative";
import { supabase } from "@/integrations/supabase/client";

/**
 * Banner persistente (não-dispensável) exibido no topo do painel do motoboy
 * quando a versão nativa instalada é mais antiga que a última versão publicada
 * no bucket `app-releases` (version-parceiro.json).
 *
 * Complementa o toast `checkAppVersion` (que só aparece 1x por versão) — este
 * fica visível o tempo todo até o entregador atualizar.
 */
const DOWNLOAD_URL = "https://itasuper.com.br/download";

function parseVersion(v: string): number[] {
  return v.split(".").map((n) => parseInt(n, 10) || 0);
}
function isOlder(installed: string, latest: string): boolean {
  const a = parseVersion(installed);
  const b = parseVersion(latest);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

const DriverUpdateBanner = () => {
  const [state, setState] = useState<{ installed: string; latest: string } | null>(null);

  useEffect(() => {
    if (!isCapacitorNative()) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.storage
          .from("app-releases")
          .download("version-parceiro.json");
        if (!data) return;
        const { version: latest } = JSON.parse(await data.text());
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const installed = info.version || "0.0.0";
        if (!cancelled && isOlder(installed, latest)) {
          setState({ installed, latest });
        }
      } catch {
        // silencioso
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  return (
    <div className="sticky top-0 z-40 bg-amber-500 text-amber-950 border-b-2 border-amber-600 shadow-md">
      <div className="px-4 py-2.5 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black leading-tight">Atualize o app do motoboy</p>
          <p className="text-xs leading-tight opacity-90">
            Você está na {state.installed}. Nova versão: {state.latest}.
          </p>
        </div>
        <button
          onClick={() => {
            try { window.open(DOWNLOAD_URL, "_blank"); } catch {}
          }}
          className="flex items-center gap-1.5 bg-amber-950 text-amber-50 text-xs font-black px-3 py-2 rounded-lg active:scale-95 flex-shrink-0"
        >
          <Download className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>
    </div>
  );
};

export default DriverUpdateBanner;