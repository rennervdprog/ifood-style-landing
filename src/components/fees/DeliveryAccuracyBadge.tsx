/**
 * Selo visual da precisão do cálculo de taxa de entrega.
 * Lê o `breakdown` retornado por calculateStoreOwnDeliveryFee/calculateDeliveryFee
 * e mostra um chip "📍 Precisa" / "📫 Endereço" / "⚠ Estimada por CEP".
 */
import { MapPin, MailQuestion, AlertTriangle } from "lucide-react";

interface Props {
  breakdown: string | null | undefined;
  className?: string;
}

type Level = "gps" | "address" | "cep" | "fallback";

function detect(text: string): Level {
  const t = text.toLowerCase();
  if (t.includes("precisão gps") || t.includes("· gps")) return "gps";
  if (t.includes("precisão endereço") || t.includes("· endereço")) return "address";
  if (t.includes("precisão cep") || t.includes("· cep")) return "cep";
  if (t.includes("não localizado") || t.includes("estimado")) return "fallback";
  return "address";
}

const STYLES: Record<Level, { label: string; cls: string; Icon: any }> = {
  gps:      { label: "Localização precisa",      cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", Icon: MapPin },
  address:  { label: "Endereço confirmado",      cls: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",                 Icon: MapPin },
  cep:      { label: "Estimativa por CEP",       cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",         Icon: MailQuestion },
  fallback: { label: "Estimativa aproximada",    cls: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",     Icon: AlertTriangle },
};

export default function DeliveryAccuracyBadge({ breakdown, className }: Props) {
  if (!breakdown) return null;
  const level = detect(breakdown);
  const s = STYLES[level];
  const Icon = s.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls} ${className ?? ""}`}
      title={breakdown}
    >
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}