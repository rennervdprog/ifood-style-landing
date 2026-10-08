import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";

// ─── tipos (espelham o que PdvRelatorios calcula) ─────────────────────────────

export interface PdvPrintStats {
  totalSales: number;
  totalDiscount: number;
  totalCommission: number;
  avgTicket: number;
  count: number;
  byPayment: Record<string, number>;
  topProducts: { name: string; qty: number; revenue: number; abc: string }[];
  peakHour: { hour: number; count: number } | null;
  /** Conferência de caixa — presente no relatório de turno. */
  conferencia?: PdvPrintConferencia | null;
}

export interface PdvPrintOperator {
  user_id: string;
  name: string;
  count: number;
  total: number;
}

export interface PdvPrintConferencia {
  operador: string;
  periodo: string;
  abertura: number;
  vendas: number;
  vendasQtd: number;
  vendasPorPagamento: Record<string, number>;
  suprimentos: number;
  sangrias: number;
  saldoEsperado: number;
  valorContado: number | null;
  diferenca: number | null;
}

interface Props {
  storeId: string;
  periodLabel: string;
  dateRangeLabel: string;
  stats: PdvPrintStats;
  operators: PdvPrintOperator[];
}

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  maquininha_credito: "Crédito",
  maquininha_debito: "Débito",
  maquininha_pix: "PIX maquininha",
};

const th = "text-left text-[11px] uppercase tracking-wider text-gray-500 font-bold px-3 py-2 border-b border-gray-200";
const td = "px-3 py-2 border-b border-gray-100 text-[13px]";
const tdNum = "px-3 py-2 border-b border-gray-100 text-[13px] text-right tabular-nums font-semibold";

/**
 * Visão de relatório imprimível (A4) do PDV.
 * Renderizada dentro de um container `hidden print:block`; o botão
 * "Exportar PDF" chama window.print() e o CSS de impressão exibe
 * apenas este bloco.
 */
export default function PdvRelatorioPrint({
  storeId,
  periodLabel,
  dateRangeLabel,
  stats,
  operators,
}: Props) {
  const { data: storeName } = useQuery({
    queryKey: ["pdv-print-store-name", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("name")
        .eq("id", storeId)
        .maybeSingle();
      return data?.name ?? "Loja";
    },
  });

  const generatedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const payments = Object.entries(stats.byPayment).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-white text-black mx-auto max-w-[190mm] p-8 text-sm">
      {/* Cabeçalho */}
      <div className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-black">{storeName ?? "Loja"}</h1>
        <p className="text-base font-semibold text-gray-700 mt-0.5">Relatório PDV — {periodLabel}</p>
        <p className="text-xs text-gray-500 mt-1">
          Período: {dateRangeLabel} · Gerado em {generatedAt}
        </p>
      </div>

      {/* Conferência de caixa (relatório de turno) */}
      {stats.conferencia && (
        <>
          <h2 className="text-sm font-black uppercase tracking-wider mb-2">Conferência de caixa</h2>
          <table className="w-full mb-6">
            <tbody>
              {[
                ["Operador", stats.conferencia.operador],
                ["Abertura", formatBRL(stats.conferencia.abertura)],
                [`Vendas (${stats.conferencia.vendasQtd})`, formatBRL(stats.conferencia.vendas)],
                ...Object.entries(stats.conferencia.vendasPorPagamento)
                  .sort((a, b) => b[1] - a[1])
                  .map(([m, v]): [string, string] => [
                    `· ${PAYMENT_LABELS[m] ?? m}`,
                    formatBRL(v),
                  ]),
                ["Suprimentos", formatBRL(stats.conferencia.suprimentos)],
                ["Sangrias", formatBRL(stats.conferencia.sangrias)],
                ["Saldo esperado", formatBRL(stats.conferencia.saldoEsperado)],
                ...(stats.conferencia.valorContado !== null
                  ? [["Valor contado", formatBRL(stats.conferencia.valorContado)] as [string, string][]]
                  : []),
                ...(stats.conferencia.diferenca !== null
                  ? [[
                      "Diferença",
                      Math.abs(stats.conferencia.diferenca) < 0.05
                        ? "Conferido"
                        : stats.conferencia.diferenca > 0
                          ? `Sobra ${formatBRL(stats.conferencia.diferenca)}`
                          : `Falta ${formatBRL(Math.abs(stats.conferencia.diferenca))}`,
                    ] as [string, string][]]
                  : []),
              ].map(([label, value]) => (
                <tr key={label}>
                  <td className={td + " text-gray-600"}>{label}</td>
                  <td className={tdNum}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Resumo */}
      <h2 className="text-sm font-black uppercase tracking-wider mb-2">Resumo</h2>      <table className="w-full mb-6">
        <tbody>
          {[
            ["Faturamento", formatBRL(stats.totalSales)],
            ["Nº de vendas", String(stats.count)],
            ["Ticket médio", formatBRL(stats.avgTicket)],
            ["Descontos", formatBRL(stats.totalDiscount)],
            ["Comissão plataforma", formatBRL(stats.totalCommission)],
          ].map(([label, value]) => (
            <tr key={label}>
              <td className={td + " text-gray-600"}>{label}</td>
              <td className={tdNum}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagamentos */}
      <h2 className="text-sm font-black uppercase tracking-wider mb-2">Formas de pagamento</h2>
      <table className="w-full mb-6">
        <thead>
          <tr>
            <th className={th}>Método</th>
            <th className={th + " text-right"}>Valor</th>
            <th className={th + " text-right"}>%</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(([method, value]) => (
            <tr key={method}>
              <td className={td}>{PAYMENT_LABELS[method] ?? method}</td>
              <td className={tdNum}>{formatBRL(value)}</td>
              <td className={tdNum}>
                {stats.totalSales > 0 ? ((value / stats.totalSales) * 100).toFixed(1) + "%" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Produtos */}
      {stats.topProducts.length > 0 && (
        <>
          <h2 className="text-sm font-black uppercase tracking-wider mb-2">
            Produtos (Curva ABC)
          </h2>
          <table className="w-full mb-6">
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>Produto</th>
                <th className={th + " text-right"}>Qtd</th>
                <th className={th + " text-right"}>Receita</th>
                <th className={th + " text-right"}>Classe</th>
              </tr>
            </thead>
            <tbody>
              {stats.topProducts.map((p, i) => (
                <tr key={`${p.name}-${i}`}>
                  <td className={td}>{i + 1}</td>
                  <td className={td}>{p.name}</td>
                  <td className={tdNum}>{p.qty}</td>
                  <td className={tdNum}>{formatBRL(p.revenue)}</td>
                  <td className={tdNum}>{p.abc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Operadores */}
      {operators.length > 0 && (
        <>
          <h2 className="text-sm font-black uppercase tracking-wider mb-2">
            Produtividade por operador
          </h2>
          <table className="w-full mb-6">
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>Operador</th>
                <th className={th + " text-right"}>Vendas</th>
                <th className={th + " text-right"}>Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((o, i) => (
                <tr key={o.user_id}>
                  <td className={td}>{i + 1}</td>
                  <td className={td}>{o.name}</td>
                  <td className={tdNum}>{o.count}</td>
                  <td className={tdNum}>{formatBRL(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {stats.peakHour && (
        <p className="text-xs text-gray-600 mb-6">
          Horário de pico: {String(stats.peakHour.hour).padStart(2, "0")}:00 —{" "}
          {stats.peakHour.count} vendas
        </p>
      )}

      <p className="text-[11px] text-gray-400 border-t border-gray-200 pt-3">
        Relatório gerado pelo ItaSuper PDV em {generatedAt}
      </p>
    </div>
  );
}
