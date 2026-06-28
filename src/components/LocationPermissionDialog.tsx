/**
 * Diálogo unificado de permissão de GPS.
 *
 * Uso típico:
 *   const [open, setOpen] = useState(false);
 *   ...
 *   <LocationPermissionDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     onGranted={(coords) => { ... }}
 *   />
 *
 * Cobre os 3 cenários comuns:
 *  - prompt: pede permissão (botão dispara o prompt nativo do navegador/SO).
 *  - denied: instruções específicas + botão "Tentar de novo".
 *  - services_off (APK/Android): botão abre direto a tela de localização do SO.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Settings2, RefreshCw } from "lucide-react";
import {
  checkLocationPermission,
  requestLocationPermission,
  readGps,
} from "@/lib/location";
import type { Coordinates, PermissionResult } from "@/lib/location";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGranted?: (coords: Coordinates) => void;
  title?: string;
  description?: string;
}

function browserHint(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("chrome") && !ua.includes("edg")) {
    return 'Clique no cadeado ao lado do endereço → "Localização" → Permitir, depois recarregue a página.';
  }
  if (ua.includes("firefox")) {
    return 'Clique no ícone à esquerda do endereço → permissões → libere "Acessar sua localização".';
  }
  if (ua.includes("safari")) {
    return "No Safari: Ajustes → Sites → Localização → Permitir para este site.";
  }
  return 'Abra as permissões do site no seu navegador e libere a "Localização".';
}

export function LocationPermissionDialog({
  open,
  onOpenChange,
  onGranted,
  title = "Permitir localização",
  description = "Usamos seu GPS para calcular a taxa de entrega exata e encontrar lojas próximas.",
}: Props) {
  const [perm, setPerm] = useState<PermissionResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    checkLocationPermission().then((r) => alive && setPerm(r));
    return () => {
      alive = false;
    };
  }, [open]);

  async function handleAllow() {
    setBusy(true);
    try {
      const r = await requestLocationPermission();
      setPerm(r);
      if (r.state === "granted") {
        const g = await readGps({ forceFresh: true });
        if (g.coords) {
          onGranted?.(g.coords);
          onOpenChange(false);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const state = perm?.state ?? "prompt";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <MapPin className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>

        {state === "denied" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Permissão bloqueada</p>
            <p className="mt-1">{perm?.message || browserHint()}</p>
          </div>
        )}

        {state === "services_off" && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            <p className="font-medium">GPS desligado</p>
            <p className="mt-1">{perm?.message || "Ative a localização no seu celular."}</p>
          </div>
        )}

        {state === "unsupported" && (
          <div className="rounded-md border bg-muted p-3 text-sm">
            Seu dispositivo não suporta GPS. Use o endereço cadastrado ou CEP.
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {(state === "prompt" || state === "denied") && (
            <Button onClick={handleAllow} disabled={busy} className="w-full">
              <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              {state === "denied" ? "Tentar novamente" : "Permitir localização"}
            </Button>
          )}
          {perm?.openSettings && (
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                try {
                  await perm.openSettings?.();
                } catch {
                  /* noop */
                }
              }}
            >
              <Settings2 className="mr-2 h-4 w-4" /> Abrir configurações
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LocationPermissionDialog;
