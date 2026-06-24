import { Banknote, CreditCard, Smartphone, type LucideIcon } from "lucide-react";

/** Definição de uma forma de pagamento do PDV. */
export interface PdvMethod {
  id: string;
  label: string;
  icon: LucideIcon;
  color: keyof typeof PDV_METHOD_COLORS;
  /** Se precisa calcular troco (dinheiro). */
  needsChange: boolean;
}

/** Formas de pagamento aceitas no PDV (ordem importa: F4 cicla nesta ordem). */
export const PDV_METHODS: PdvMethod[] = [
  { id: "dinheiro",           label: "Dinheiro", icon: Banknote,   color: "emerald", needsChange: true  },
  { id: "maquininha_credito", label: "Crédito",  icon: CreditCard, color: "blue",    needsChange: false },
  { id: "maquininha_debito",  label: "Débito",   icon: CreditCard, color: "indigo",  needsChange: false },
  { id: "maquininha_pix",     label: "PIX",      icon: Smartphone, color: "orange",  needsChange: false },
];

/** Classes Tailwind por cor lógica de forma de pagamento. */
export const PDV_METHOD_COLORS = {
  emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 data-[sel=true]:bg-emerald-500 data-[sel=true]:text-white data-[sel=true]:border-emerald-500",
  blue:    "bg-blue-500/10 text-blue-600 border-blue-500/25 data-[sel=true]:bg-blue-500 data-[sel=true]:text-white data-[sel=true]:border-blue-500",
  indigo:  "bg-indigo-500/10 text-indigo-600 border-indigo-500/25 data-[sel=true]:bg-indigo-500 data-[sel=true]:text-white data-[sel=true]:border-indigo-500",
  orange:  "bg-primary/10 text-primary border-primary/25 data-[sel=true]:bg-primary data-[sel=true]:text-white data-[sel=true]:border-primary",
} as const;

/**
 * Compat: alias antigo COLOR_MAP usado em PdvPage.
 * Tipado como Record<string, string> para casar com o uso atual.
 */
export const COLOR_MAP: Record<string, string> = PDV_METHOD_COLORS;