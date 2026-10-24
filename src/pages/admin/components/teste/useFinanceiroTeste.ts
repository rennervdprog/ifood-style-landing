/**
 * TELA 4 — Fonte única do Financeiro (/admin-teste).
 *
 * Por que este hook existe: no original, o Resumo e o Extrato bebem de
 * fontes diferentes — o Resumo soma pedidos da tabela `orders`
 * (RecebidoNoMesCard) e o Extrato soma só `financial_transactions`
 * (FinancialStatement). Resultado visto ao vivo: Resumo com valor e
 * 30 pedidos, Extrato zerado. Aqui os dois blocos consomem EXATAMENTE
 * a mesma lista de pedidos e a mesma conta; o extrato nunca pode
 * zerar havendo pedidos no resumo do mesmo período.
 *
 * Conta (por pedido entregue/finalizado, reconciliada com o original):
 *   venda      = subtotal
 *   frete      = delivery_fee (o que o cliente pagou pela entrega)
 *   cobrado    = total_price ?? (subtotal + frete) — o valor cobrado
 *     do cliente. O original calculava Faturamento/Receita líquida
 *     sobre total_price, enquanto esta cópia usava só subtotal e
 *     ignorava descontos — por isso os números divergiam.
 *   desconto   = max(0, subtotal + frete − cobrado) — a diferença entre
 *     o subtotal e o valor cobrado, explicitada em linha própria em
 *     vez de sumir da conta.
 *   taxa de plataforma = R$ 0,99 por pedido com frete (delivery_fee > 0),
 *     usando o override do plano, senão a config global, senão 0,99.
 *     (O fallback "2" que aparece em RecebidoNoMesCard/StoreFinanceBasic
 *     é legado e NÃO é usado aqui: o split canônico é 0,99, como em
 *     useStorePlan e PlanSummaryCard.)
 *   comissão   = subtotal × commission_rate do plano (0 quando não há)
 *   taxa PIX   = R$ 0,00 — Pix direto na conta da loja, sem taxa do
 *     ItaSuper. O texto de taxa PIX por pedido do original é legado e NÃO
 *     entra na conta desta cópia.
 *   líquido    = cobrado − taxa de plataforma − comissão
 * Conta do período:
 *   Líquido = Bruto (Σ venda) + Frete cobrado do cliente (Σ frete)
 *     − Descontos (Σ desconto) − Taxa de plataforma − Comissão
 *     (se rate > 0) − Reembolsos.
 * Checagem na loja demo (30 pedidos finalizados): 3.030,00 + 0,99
 *   − 185,00 − 0,99 − 0 = 2.845,00 — igual à Receita líquida do
 *   original. Antes desta correção o líquido aqui era 3.029,01; a
 *   mudança para 2.845,00 É a correção, não regressão.
 * Reembolsos não vivem em `orders`: vêm de `financial_transactions`
 * (kind "refund", pagos/liquidados) no mesmo período, como linha
 * própria do extrato, e entram na conta final.
 * Indicadores (FinanceIndicatorsTeste) e Tendência (FinanceTrendTeste)
 * calculam da MESMA lista: Faturamento = Σ cobrado; Ticket médio =
 * Σ subtotal ÷ nº de pedidos (fórmula original); Crescimento =
 * (Σ subtotal período − Σ subtotal período anterior) ÷ Σ subtotal
 * anterior, com o período anterior de igual duração. "Tudo" não tem
 * crescimento (mostra "—").
 * Nada aqui muda dado, fluxo de saque ou fluxo de pagamento — só a
 * decomposição e a coerência entre os blocos.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

export type FinanceiroPeriodoTeste =
  | "hoje"
  | "7d"
  | "30d"
  | "mes_atual"
  | "tudo";

export const FINANCEIRO_PERIODOS_TESTE: {
  key: FinanceiroPeriodoTeste;
  label: string;
}[] = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "mes_atual", label: "Mês atual" },
  { key: "tudo", label: "Tudo" },
];

/** Taxa de plataforma por entrega — modelo atual, sem legado. */
export const TAXA_PLATAFORMA_POR_ENTREGA_TESTE = 0.99;

export interface PedidoFinanceiroTeste {
  id: string;
  createdAt: string;
  paymentMethod: string;
  venda: number;
  frete: number;
  cobrado: number;
  desconto: number;
  taxaPlataforma: number;
  comissao: number;
  liquido: number;
}

export interface ReembolsoFinanceiroTeste {
  id: string;
  createdAt: string;
  referenceCode: string;
  valor: number;
}

export interface FinanceiroResumoTeste {
  periodo: FinanceiroPeriodoTeste;
  /** Rótulo do intervalo do período, ex.: "18/10 — 24/10". */
  intervaloLabel: string;
  pedidos: PedidoFinanceiroTeste[];
  reembolsos: ReembolsoFinanceiroTeste[];
  /** Nº de pedidos entregues/finalizados no período. */
  countPedidos: number;
  /** Nº de pedidos com frete (base da taxa de plataforma). */
  countEntregas: number;
  /** Σ subtotal do período. */
  bruto: number;
  /** Σ total_price do período — o Faturamento dos indicadores. */
  faturamento: number;
  /** Σ delivery_fee do período (frete cobrado do cliente). */
  freteTotal: number;
  /** Σ desconto do período (subtotal + frete − cobrado, quando > 0). */
  descontosTotal: number;
  taxaPlataforma: number;
  comissao: number;
  taxas: number;
  reembolsosTotal: number;
  liquido: number;
  /** Σ subtotal ÷ nº de pedidos (fórmula original). */
  ticketMedio: number;
  /** Crescimento em % vs. o período anterior; null = sem base ("—"). */
  crescimentoPercent: number | null;
  taxaPlataformaPorEntrega: number;
  commissionRate: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

interface Range {
  from?: Date;
  to?: Date;
}

function resolvePeriodo(periodo: FinanceiroPeriodoTeste, now: Date): Range {
  if (periodo === "hoje")
    return { from: startOfDay(now), to: endOfDay(now) };
  if (periodo === "7d")
    return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
  if (periodo === "30d")
    return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  if (periodo === "mes_atual")
    return { from: startOfMonth(now), to: endOfMonth(now) };
  return {};
}

/** Faixa anterior de igual duração (Hoje → ontem; Tudo → nenhuma). */
function resolvePeriodoAnterior(
  periodo: FinanceiroPeriodoTeste,
  now: Date,
): Range | null {
  if (periodo === "hoje") {
    const ontem = subDays(now, 1);
    return { from: startOfDay(ontem), to: endOfDay(ontem) };
  }
  if (periodo === "7d")
    return {
      from: startOfDay(subDays(now, 13)),
      to: endOfDay(subDays(now, 7)),
    };
  if (periodo === "30d")
    return {
      from: startOfDay(subDays(now, 59)),
      to: endOfDay(subDays(now, 30)),
    };
  if (periodo === "mes_atual") {
    const anterior = subMonths(now, 1);
    return { from: startOfMonth(anterior), to: endOfMonth(anterior) };
  }
  return null;
}

export function useFinanceiroTeste(
  storeId: string,
  periodo: FinanceiroPeriodoTeste,
): FinanceiroResumoTeste {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["financeiro-teste", storeId],
    queryFn: async () => {
      const [ordersRes, planRes, cfgRes, refundsRes] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, subtotal, total_price, delivery_fee, payment_method, status, created_at",
          )
          .eq("store_id", storeId)
          .in("status", ["entregue", "finalizado"])
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("store_plans")
          .select("plan_type, commission_rate, platform_delivery_split_override")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("admin_settings")
          .select("value")
          .eq("key", "delivery_fee_config")
          .maybeSingle(),
        (supabase as any)
          .from("financial_transactions")
          .select("id, amount, status, transaction_kind, created_at, reference_code")
          .eq("store_id", storeId)
          .eq("transaction_kind", "refund")
          .in("status", ["paid", "settled"])
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      return {
        orders: (ordersRes.data ?? []) as any[],
        plan: planRes.data as any,
        globalSplit: Number((cfgRes.data?.value as any)?.platform_split ?? NaN),
        refunds: (refundsRes.data ?? []) as any[],
      };
    },
    enabled: !!storeId,
    refetchInterval: 30_000,
  });

  return useMemo(() => {
    const now = new Date();
    const range = resolvePeriodo(periodo, now);
    const prevRange = resolvePeriodoAnterior(periodo, now);
    const inRange = (iso: string, r: Range) => {
      const d = new Date(iso);
      if (r.from && d < r.from) return false;
      if (r.to && d > r.to) return false;
      return true;
    };
    const split = Number(
      data?.plan?.platform_delivery_split_override ??
        (Number.isFinite(data?.globalSplit) ? data.globalSplit : NaN) ??
        TAXA_PLATAFORMA_POR_ENTREGA_TESTE,
    );
    const taxaSplit = Number.isFinite(split)
      ? split
      : TAXA_PLATAFORMA_POR_ENTREGA_TESTE;
    const commissionRate = Number(data?.plan?.commission_rate ?? 0) / 100;

    const mapPedido = (o: any): PedidoFinanceiroTeste => {
      const venda = Number(o.subtotal ?? 0);
      const frete = Number(o.delivery_fee ?? 0);
      const cobrado =
        o.total_price != null ? Number(o.total_price) : venda + frete;
      const desconto = Math.max(0, venda + frete - cobrado);
      const taxaPlataforma = frete > 0 ? taxaSplit : 0;
      const comissao = venda * commissionRate;
      return {
        id: String(o.id),
        createdAt: String(o.created_at),
        paymentMethod: String(o.payment_method ?? ""),
        venda,
        frete,
        cobrado,
        desconto,
        taxaPlataforma,
        comissao,
        liquido: cobrado - taxaPlataforma - comissao,
      };
    };
    const todos = (data?.orders ?? []).map(mapPedido);
    const pedidos = todos.filter((p) => inRange(p.createdAt, range));
    const pedidosAnteriores = prevRange
      ? todos.filter((p) => inRange(p.createdAt, prevRange))
      : [];
    const reembolsos: ReembolsoFinanceiroTeste[] = (data?.refunds ?? [])
      .filter((t) => inRange(t.created_at, range))
      .map((t) => ({
        id: String(t.id),
        createdAt: String(t.created_at),
        referenceCode: String(t.reference_code ?? ""),
        valor: Number(t.amount ?? 0),
      }));

    const bruto = pedidos.reduce((s, p) => s + p.venda, 0);
    const faturamento = pedidos.reduce((s, p) => s + p.cobrado, 0);
    const freteTotal = pedidos.reduce((s, p) => s + p.frete, 0);
    const descontosTotal = pedidos.reduce((s, p) => s + p.desconto, 0);
    const taxaPlataforma = pedidos.reduce((s, p) => s + p.taxaPlataforma, 0);
    const comissao = pedidos.reduce((s, p) => s + p.comissao, 0);
    const reembolsosTotal = reembolsos.reduce((s, r) => s + r.valor, 0);
    const subtotalAnterior = pedidosAnteriores.reduce(
      (s, p) => s + p.venda,
      0,
    );
    const crescimentoPercent =
      prevRange && subtotalAnterior > 0
        ? ((bruto - subtotalAnterior) / subtotalAnterior) * 100
        : null;
    const intervaloLabel =
      range.from && range.to
        ? format(range.from, "dd/MM") === format(range.to, "dd/MM")
          ? format(range.from, "dd/MM")
          : `${format(range.from, "dd/MM")} — ${format(range.to, "dd/MM")}`
        : "Todo o período";
    return {
      periodo,
      intervaloLabel,
      pedidos,
      reembolsos,
      countPedidos: pedidos.length,
      countEntregas: pedidos.filter((p) => p.frete > 0).length,
      bruto,
      faturamento,
      freteTotal,
      descontosTotal,
      taxaPlataforma,
      comissao,
      taxas: taxaPlataforma + comissao,
      reembolsosTotal,
      liquido:
        bruto + freteTotal - descontosTotal - taxaPlataforma - comissao - reembolsosTotal,
      ticketMedio: pedidos.length > 0 ? bruto / pedidos.length : 0,
      crescimentoPercent,
      taxaPlataformaPorEntrega: taxaSplit,
      commissionRate,
      isLoading,
      isError,
      refetch: () => void refetch(),
    };
  }, [data, periodo, isLoading, isError, refetch]);
}
