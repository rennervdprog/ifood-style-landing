import { Rocket, TrendingUp, Crown, Sparkles, CreditCard, type LucideIcon } from "lucide-react";
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
  tagline: "Plano legado — não aceita novos cadastros",
  forWho: "Plano descontinuado. Mantido apenas para lojas que já estavam ativas.",
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
    "Plano legado (descontinuado)",
    "Novas lojas não podem selecionar",
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
  tagline: "Grátis pra começar — R$ 0/mês. Vira R$ 180/mês quando você faturar R$ 5.000",
  forWho: "Pra quem quer começar sem custo fixo e crescer sem pagar comissão por pedido",
  monthlyFee: 0,
  commissionRate: 0,
  pixFee: 1.99,
  deliveryFee: 2,
  icon: Crown,
  accent: "text-primary",
  accentBg: "bg-primary/10",
  badge: "🎁 Grátis pra começar",
  highlight: true,
  features: [
    "R$ 0/mês nos 2 primeiros meses",
    "Sobe pra R$ 180/mês após atingir R$ 5.000 em vendas",
    "Sem comissão por pedido",
    "Motoboy integrado + Suporte VIP",
    "PDV: módulo opcional (+ R$ 49/mês)",
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

const autonomy: PlanInfo = {
  id: "autonomy",
  name: "Autonomia",
  tagline: "Grátis pra começar — R$ 0/mês. Vira R$ 239,90/mês quando faturar R$ 2.500",
  forWho: "Pra quem quer máxima autonomia: fica com 100% da taxa de entrega que cobra",
  monthlyFee: 0,
  commissionRate: 0,
  pixFee: 1.99,
  deliveryFee: 0,
  icon: Crown,
  accent: "text-primary",
  accentBg: "bg-primary/10",
  badge: "🎁 Grátis pra começar",
  highlight: false,
  features: [
    "R$ 0/mês até atingir R$ 2.500 em vendas",
    "Sobe pra R$ 239,90/mês após o gatilho (com 30 dias de aviso)",
    "Sem comissão por pedido",
    "Sem taxa de R$2 da plataforma na entrega",
    "Você fica com 100% da taxa que cobra",
    "PIX online: R$1,99 por pedido (só se usar)",
    "PDV: módulo opcional (+ R$ 49/mês)",
  ],
  example: (_: number) => "",
};
autonomy.example = exampleText(autonomy);

const pdv_only: PlanInfo = {
  id: "pdv_only",
  name: "Somente PDV",
  tagline: "R$ 69/mês — só o caixa, sem delivery",
  forWho: "Pra quem já tem clientela na loja física e quer só a frente de caixa",
  monthlyFee: 69,
  commissionRate: 0,
  pixFee: 0,
  deliveryFee: 0,
  icon: CreditCard,
  accent: "text-primary",
  accentBg: "bg-primary/10",
  badge: "🏪 Balcão",
  highlight: false,
  features: [
    "PDV completo (vendas, sangria, fechamento)",
    "Cadastro de produtos ilimitado",
    "Relatórios financeiros do caixa",
    "Sem vitrine pública, sem delivery",
  ],
  example: (_: number) => "Sem pedidos online — você usa só o caixa presencial.",
};

export const PLANS: Record<StorePlanType, PlanInfo> = {
  commission_only,
  hybrid,
  fixed,
  supporter,
  autonomy,
  pdv_only,
};

/** Ordem padrão para exibição (do mais barato pro mais completo). */
/** Plano "supporter" (Apoiador) está desativado para novos cadastros — oculto em toda a UI pública. */
/** Plano "hybrid" (Crescimento) descontinuado para novos cadastros — oculto na UI pública.
 *  Lojas já vinculadas ao Crescimento continuam funcionando normalmente. */
/** Plano "commission_only" descontinuado para novos cadastros — oculto na UI pública.
 *  Lojas legado continuam funcionando com as regras antigas. */
export const PLANS_ORDER: StorePlanType[] = ["fixed", "autonomy"];

/** Linha única de explicação universal sobre a taxa de entrega. */
export const DELIVERY_FEE_NOTE =
  "Taxa de entrega: nos planos Comissão e Essencial a plataforma adiciona R$ 2,00 EM CIMA da taxa que você (lojista) cobra. Ex.: você cobra R$ 5 → cliente paga R$ 7. Os R$ 2 ficam com a plataforma, os R$ 5 são seus. Nada sai do seu caixa. No plano Autonomia esse acréscimo é zero — o cliente paga exatamente a taxa que você define.";

/** Linha única para a taxa PIX (apenas Essencial/Apoiador). */
export const PIX_FEE_NOTE =
  "Apenas pedidos pagos via PIX têm taxa de R$ 1,99 (cobrada no repasse). Dinheiro e cartão não têm taxa.";

/**
 * Label canônico do plano. Use SEMPRE isto em vez de strings soltas
 * ("Fixo Mensal", "Comissão", "Só Comissão", etc.) para garantir
 * consistência em todo o painel Super Admin e telas do lojista.
 */
export function planLabel(planType?: string | null): string {
  if (!planType) return "—";
  return PLANS[planType as StorePlanType]?.name ?? planType;
}
