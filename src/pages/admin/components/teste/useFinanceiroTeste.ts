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
 * Conta (por pedido entregue/finalizado, mesma base do resumo original):
 *   venda      = subtotal
 *   taxa de plataforma = R$ 0,99 por pedido com frete (delivery_fee > 0),
 *     usando o override do plano, senão a config global, senão 0,99.
 *     (O fallback "2" que aparece em RecebidoNoMesCard/StoreFinanceBasic
 *     é legado e NÃO é usado aqui: o split canônico é 0,99, como em
 *     useStorePlan e PlanSummaryCard.)
 *   comissão   = subtotal × commission_rate do plano (0 quando não há)
 *   taxa PIX   = R$ 0,00 — Pix direto na conta da loja, sem taxa do
 *     ItaSuper. O texto de taxa PIX por pedido do original é legado e NÃO
 *     entra na conta desta cópia.
 *   líquido    = venda − taxa de plataforma − comissão
 * O frete cobrado do cliente aparece à parte em cada linha e NÃO é
 * somado ao líquido (mesma conta do resumo original, que parte do
 * subtotal). Reembolsos não vivem em `orders`: vêm de
 * `financial_transactions` (kind "refund", pagos/liquidados) no mesmo
 * período, como linha própria do extrato, e entram na conta final:
 *   líquido final = bruto − taxas − reembolsos
 * Nada aqui muda dado, fluxo de saque ou fluxo de pagamento — só a
 * decomposição e a coerência entre os dois blocos.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subDays } from "date-fns";

export type FinanceiroPeriodoTeste = "mes_atual" | "30d" | "tudo";

export const FINANCEIRO_PERIODOS_TESTE: {
  key: FinanceiroPeriodoTeste;
  label: string;
}[] = [
  { key: "mes_atual", label: "Mês atual" },
  { key: "30d", label: "Últimos 30 dias" },
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
  pedidos: PedidoFinanceiroTeste[];
  reembolsos: ReembolsoFinanceiroTeste[];
  /** Nº de pedidos entregues/finalizados no período. */
  countPedidos: number;
  /** Nº de pedidos com frete (base da taxa de plataforma). */
  countEntregas: number;
  bruto: number;
  taxaPlataforma: number;
  comissao: number;
  taxas: number;
  reembolsosTotal: number;
  liquido: number;
  taxaPlataformaPorEntrega: number;
  commissionRate: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

function resolvePeriodo(periodo: FinanceiroPeriodoTeste, now: Date) {
  if (periodo === "mes_atual")
    return { from: startOfMonth(now), to: endOfMonth(now) };
  if (periodo === "30d") return { from: subDays(now, 30), to: now };
  return { from: undefined, to: undefined };
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
          .select("id, subtotal, delivery_fee, payment_method, status, created_at")
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
    const inRange = (iso: string) => {
      const d = new Date(iso);
      if (range.from && d < range.from) return false;
      if (range.to && d > range.to) return false;
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

    const pedidos: PedidoFinanceiroTeste[] = (data?.orders ?? [])
      .filter((o) => inRange(o.created_at))
      .map((o) => {
        const venda = Number(o.subtotal ?? 0);
        const frete = Number(o.delivery_fee ?? 0);
        const taxaPlataforma = frete > 0 ? taxaSplit : 0;
        const comissao = venda * commissionRate;
        return {
          id: String(o.id),
          createdAt: String(o.created_at),
          paymentMethod: String(o.payment_method ?? ""),
          venda,
          frete,
          taxaPlataforma,
          comissao,
          liquido: venda - taxaPlataforma - comissao,
        };
      });
    const reembolsos: ReembolsoFinanceiroTeste[] = (data?.refunds ?? [])
      .filter((t) => inRange(t.created_at))
      .map((t) => ({
        id: String(t.id),
        createdAt: String(t.created_at),
        referenceCode: String(t.reference_code ?? ""),
        valor: Number(t.amount ?? 0),
      }));

    const bruto = pedidos.reduce((s, p) => s + p.venda, 0);
    const taxaPlataforma = pedidos.reduce((s, p) => s + p.taxaPlataforma, 0);
    const comissao = pedidos.reduce((s, p) => s + p.comissao, 0);
    const reembolsosTotal = reembolsos.reduce((s, r) => s + r.valor, 0);
    return {
      periodo,
      pedidos,
      reembolsos,
      countPedidos: pedidos.length,
      countEntregas: pedidos.filter((p) => p.frete > 0).length,
      bruto,
      taxaPlataforma,
      comissao,
      taxas: taxaPlataforma + comissao,
      reembolsosTotal,
      liquido: bruto - taxaPlataforma - comissao - reembolsosTotal,
      taxaPlataformaPorEntrega: taxaSplit,
      commissionRate,
      isLoading,
      isError,
      refetch: () => void refetch(),
    };
  }, [data, periodo, isLoading, isError, refetch]);
}
