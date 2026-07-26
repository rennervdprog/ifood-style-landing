import { Info } from "lucide-react";

interface Props {
  mode: "store" | "client" | "driver";
  storeFee?: number;
  /** Taxa da plataforma sobre a entrega (override do plano). Default R$ 2. */
  platformFee?: number;
  className?: string;
}

/** Texto curto e contextual sobre a parte da plataforma na taxa de entrega. */
export default function DeliveryFeeExplainer({ mode, storeFee, platformFee = 2, className = "" }: Props) {
  const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
  const PLATFORM_FEE = platformFee;

  const text = (() => {
    if (mode === "store") {
      if (storeFee != null) {
        const total = storeFee + PLATFORM_FEE;
        return `O cliente verá ${fmt(total)} de taxa de entrega: ${fmt(storeFee)} ficam com você + ${fmt(PLATFORM_FEE)} da plataforma. Nada sai do seu caixa.`;
      }
      return `A plataforma soma ${fmt(PLATFORM_FEE)} em cima da sua taxa. O cliente paga, você recebe a sua parte inteira.`;
    }
    if (mode === "client") {
      return `A taxa de entrega vai para a loja (que paga o motoboy). ${fmt(PLATFORM_FEE)} ajudam a manter o app no ar.`;
    }
    // driver
    return `Você recebe a parte do motoboy combinada com a loja. ${fmt(PLATFORM_FEE)} da taxa total ficam com a plataforma.`;
  })();

  return (
    <div
      className={`flex gap-2 items-start text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 ${className}`}
    >
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
      <span>{text}</span>
    </div>
  );
}