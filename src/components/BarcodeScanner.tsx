// @ts-nocheck
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Camera } from "lucide-react";

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

/**
 * Scanner de código de barras simplificado.
 * Usa a câmera via input file (funciona sem dependências extras).
 * Para scanner em tempo real, integrar html5-qrcode + atualizar bun.lockb.
 */
export default function BarcodeScanner({ onScan, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [manual, setManual] = useState("");

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white">
            <Camera className="h-5 w-5" />
            <span className="font-bold">Código de barras</span>
          </div>
          <Button size="sm" variant="ghost" className="text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full h-14 text-base"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="h-5 w-5 mr-2" /> Tirar foto do código
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                // Por enquanto: pede digitação manual após a foto
                // TODO: integrar leitura via API quando o lockfile for atualizado
                toast.info("Foto capturada! Digite o código abaixo.");
              }
            }}
          />

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ou digite o código..."
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg bg-white/10 text-white placeholder:text-white/40 border border-white/20"
            />
            <Button
              disabled={!manual.trim()}
              onClick={() => onScan(manual.trim())}
            >
              Buscar
            </Button>
          </div>
        </div>

        <p className="text-white/60 text-sm text-center mt-4">
          Digite o código de barras do produto
        </p>
      </div>
    </div>
  );
}

import { toast } from "sonner";
