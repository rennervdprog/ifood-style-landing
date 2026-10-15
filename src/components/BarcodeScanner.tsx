import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { X, Camera } from "lucide-react";

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const start = async () => {
      try {
        const scanner = new Html5Qrcode("barcode-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (mountedRef.current) {
              onScan(decodedText);
            }
          },
          () => {}
        );
      } catch (err: any) {
        if (mountedRef.current) {
          setError("Não foi possível acessar a câmera. Verifique a permissão.");
        }
      }
    };
    start();
    return () => {
      mountedRef.current = false;
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white">
            <Camera className="h-5 w-5" />
            <span className="font-bold">Aponte para o código de barras</span>
          </div>
          <Button size="sm" variant="ghost" className="text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        {error ? (
          <p className="text-red-400 text-center py-8">{error}</p>
        ) : (
          <div id="barcode-reader" className="w-full rounded-lg overflow-hidden" />
        )}
        <p className="text-white/60 text-sm text-center mt-4">
          O código será lido automaticamente
        </p>
      </div>
    </div>
  );
}
