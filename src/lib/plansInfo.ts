import { Rocket, TrendingUp, Crown, Sparkles, type LucideIcon } from "lucide-react";
import type { StorePlanType } from "@/hooks/useStorePlan";

/**
 * Fonte ÚNICA de verdade dos planos.
 * Use esses dados em TODAS as telas (PlanosPage, CadastroLojista,
 * StoreSubscription, etc) para manter linguagem e valores consistentes.
 */
export interface PlanInfo {
  id: StorePlanType;
  name: string;          // "Essencial", "Crescimento"...
  tagline: string;       // 1 frase curta
  forWho: string;        // "Pra quem..."
  monthlyFee: number;    // R$/mês
  commissionRate: number;// % por pedido (0–100)
  pixFee: number;        // R$ por PIX (lojista paga)
  deliveryFee: number;   // R$ por entrega plataforma (cliente paga, somado à taxa do lojista)
  icon: LucideIcon;
  accent: string;        // tailwind text color
  accentBg: string;      // tailwind bg color
  badge: string | null;
  highlight: boolean;
  /** Bullets curtos exibidos no card (4–5 itens). */
  features: string[];
  /** Frase de exemplo prática: "Em um pedido de R$50 via PIX, você fica com R$X". */
  example: (orderValue: number) => string;
}

/** Calcula quanto o lojista recebe líquido em 1 pedido (sem custo de produto). */
export function netPerOrder(plan: PlanInfo, orderValue: number, viaPix = true): number {
  const commission = orderValue * (plan.commissionRate / 100);
  const pix = viaPix ? plan.pixFee : 0;
  return Math.max(0, orderValue - commission - pix);
}

const exampleText = (plan: Omit<PlanInfo, "example">) => (orderValue: number) => {
  const net = netPerOrder(plan as PlanInfo, orderValue, true);
  return `Em um pedido de R$ ${orderValue} via PIX, você fica com R$ ${net.toFixed(2).replace(".", ",")}`;
};

/* ─── definições ─── */

const commission_only: PlanInfo = {
  id: "commission_only",
  name: "Comissão",
  tagline: "Comece sem pagar nada por mês",
  forWho: "Pra quem está começando e quer testar sem risco",
  monthlyFee: 0,
  commissionRate: 6,
  pixFee: 0,
  deliveryFee: 2,
  icon: Rocket,
  accent: "text-emerald-600 dark:text-emerald-400",
  accentBg: "bg-emerald-500/10",
  badge: null,
  highlight: false,
  features: [
    "Cardápio digital ilimitado",
    "PIX automático (sem taxa pra você)",
    "Notificação de pedidos no celular",
    "Todas as ferramentas básicas",
  ],
  example: (_: number) => "",
};
commission_only.example = exampleText(commission_only);

const hybrid: PlanInfo = {
  id: "hybrid",
  name: "Crescimento",
  tagline: "Comece por R$50 — cresce junto com você",
  forWho: "Pra lojas com volume médio que querem pagar menos por venda",
  monthlyFee: 50,
  commissionRate: 2.5,
  pixFee: 0,
  deliveryFee: 2,
  icon: TrendingUp,
  accent: "text-blue-600 dark:text-blue-400",
  accentBg: "bg-blue-500/10",
  badge: "⭐ Popular",
  highlight: false,
  features: [
    "Comissão reduzida (2,5%)",
    "Relatórios financeiros completos",
    "Destaque na vitrine + banners",
  ],
  example: (_: number) => "",
};
hybrid.example = exampleText(hybrid);

const fixed: PlanInfo = {
  id: "fixed",
  name: "Essencial",
  tagline: "Comece por R$90 — cresce junto com você",
  forWho: "Pra quem tem volume estável e quer ficar com 100% do pedido",
  monthlyFee: 90,
  commissionRate: 0,
  pixFee: 1.99,
  deliveryFee: 2,
  icon: Crown,
  accent: "text-primary",
  accentBg: "bg-primary/10",
  badge: "⭐ Mais escolhido",
  highlight: true,
  features: [
    "Sem comissão por pedido",
    "Relatórios 100% detalhados",
    "Motoboy integrado + Suporte VIP",
  ],
  example: (_: number) => "",
};
fixed.example = exampleText(fixed);

const supporter: PlanInfo = {
  id: "supporter",
  name: "Apoiador",
  tagline: "R$75 travado para sempre · Só 10 vagas",
  forWho: "Edição de lançamento — só 10 vagas, preço fixo pra sempre",
  monthlyFee: 75,
  commissionRate: 0,
  pixFee: 1.99,
  deliveryFee: 2,
  icon: Sparkles,
  accent: "text-amber-600 dark:text-amber-400",
  accentBg: "bg-amber-500/10",
  badge: "🚀 10 vagas",
  highlight: false,
  features: [
    "Mesmos benefícios do Essencial",
    "Preço de R$75 congelado pra sempre",
    "Selo de Apoiador na sua loja",
    "Suporte VIP prioritário",
  ],
  example: (_: number) => "",
};
supporter.example = exampleText(supporter);

export const PLANS: Record<StorePlanType, PlanInfo> = {
  commission_only,
  hybrid,
  fixed,
  supporter,
};

/** Ordem padrão para exibição (do mais barato pro mais completo). */
export const PLANS_ORDER: StorePlanType[] = ["commission_only", "hybrid", "fixed", "supporter"];

/** Linha única de explicação universal sobre a taxa de entrega. */
export const DELIVERY_FEE_NOTE =
  "Taxa de entrega: a plataforma adiciona R$ 2,00 EM CIMA da taxa que você (lojista) cobra. Ex.: você cobra R$ 5 → cliente paga R$ 7. Os R$ 2 ficam com a plataforma, os R$ 5 são seus. Nada sai do seu caixa.";

/** Linha única para a taxa PIX (apenas Essencial/Apoiador). */
export const PIX_FEE_NOTE =
  "Apenas pedidos pagos via PIX têm taxa de R$ 1,99 (cobrada no repasse). Dinheiro e cartão não têm taxa.";
