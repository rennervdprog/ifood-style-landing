/**
 * TELA 4 — Extrato (/admin-teste).
 *
 * O extrato NÃO consulta outra fonte: recebe o mesmo resumo do hook
 * único (useFinanceiroTeste) que a Conta do período. Por construção,
 * os totais do rodapé são os mesmos da conta, e cada pedido mostra o
 * líquido com a taxa discriminada (plataforma + comissão, quando há).
 * Reembolsos aparecem como linhas próprias, descontando do líquido.
 * Sem pedido no período, o vazio diz isso — nunca "R$ 0,00" ao lado
 * de um resumo com valor.
 * Ações client-side sobre o resumo: copiar o extrato em texto, baixar
 * CSV, filtrar por forma de pagamento e buscar pelo número do pedido
 * (prefixo do id). O rodapé mantém sempre os totais do período
 * (a conta); com filtro ativo, o cabeçalho informa quantos pedidos
 * estão exibidos.
 */
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { formatBRL } from "@/lib/utils";
import {
  AdminCardTeste,
  AdminCardDescriptionTeste,
  AdminCardTitleTeste,
  AdminMoneyTeste,
} from "./AdminBaseTeste";
import { paymentLabelTeste } from "./paymentLabelTeste";
import type {
  FinanceiroResumoTeste,
  PedidoFinanceiroTeste,
} from "./useFinanceiroTeste";

function linhaPedidoTexto(p: PedidoFinanceiroTeste) {
  const partes = [
    `Pedido #${p.id.slice(0, 6).toUpperCase()}`,
    format(new Date(p.createdAt), "dd/MM/yyyy HH:mm"),
    paymentLabelTeste(p.paymentMethod),
    `Venda ${formatBRL(p.venda)}`,
  ];
  if (p.desconto > 0) partes.push(`Desconto ${formatBRL(p.desconto)}`);
  if (p.frete > 0) partes.push(`Frete (cliente) ${formatBRL(p.frete)}`);
  partes.push(`Taxa de plataforma ${formatBRL(p.taxaPlataforma)}`);
  if (p.comissao > 0) partes.push(`Comissão ${formatBRL(p.comissao)}`);
  partes.push(`Líquido ${formatBRL(p.liquido)}`);
  return partes.join(" · ");
}

function toCsvCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

export default function FinanceStatementTeste({
  resumo,
}: {
  resumo: FinanceiroResumoTeste;
}) {
  const [filtroPagamento, setFiltroPagamento] = useState("todas");
  const [busca, setBusca] = useState("");
  const [copiado, setCopiado] = useState(false);

  const formas = useMemo(() => {
    const map = new Map<string, string>();
    resumo.pedidos.forEach((p) => {
      if (!map.has(p.paymentMethod)) {
        map.set(p.paymentMethod, paymentLabelTeste(p.paymentMethod));
      }
    });
    return [...map.entries()];
  }, [resumo.pedidos]);

  const exibidos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return resumo.pedidos.filter((p) => {
      if (filtroPagamento !== "todas" && p.paymentMethod !== filtroPagamento)
        return false;
      if (q && !p.id.toLowerCase().startsWith(q)) return false;
      return true;
    });
  }, [resumo.pedidos, filtroPagamento, busca]);

  const filtroAtivo = filtroPagamento !== "todas" || busca.trim() !== "";

  const copiar = async () => {
    const linhas = exibidos.map(linhaPedidoTexto);
    const texto = [
      `Extrato — ${resumo.intervaloLabel}`,
      ...linhas,
      ...resumo.reembolsos.map(
        (r) =>
          `Reembolso ao cliente · ${format(new Date(r.createdAt), "dd/MM/yyyy HH:mm")} · − ${formatBRL(r.valor)}`,
      ),
      `Bruto ${formatBRL(resumo.bruto)} · Frete ${formatBRL(resumo.freteTotal)} · Descontos − ${formatBRL(resumo.descontosTotal)} · Taxas − ${formatBRL(resumo.taxas)} · Reembolsos − ${formatBRL(resumo.reembolsosTotal)} · Líquido ${formatBRL(resumo.liquido)}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem acesso à área de transferência: não falha a tela.
    }
  };

  const baixarCsv = () => {
    const header = "data,pedido,pagamento,venda,frete,desconto,taxa,líquido";
    const linhas = exibidos.map((p) =>
      [
        format(new Date(p.createdAt), "dd/MM/yyyy HH:mm"),
        `#${p.id.slice(0, 6).toUpperCase()}`,
        paymentLabelTeste(p.paymentMethod),
        p.venda.toFixed(2),
        p.frete.toFixed(2),
        p.desconto.toFixed(2),
        p.taxaPlataforma.toFixed(2),
        p.liquido.toFixed(2),
      ]
        .map(toCsvCell)
        .join(";"),
    );
    const rodape = [
      "",
      "Totais do período",
      `Bruto;${resumo.bruto.toFixed(2)}`,
      `Frete;${resumo.freteTotal.toFixed(2)}`,
      `Descontos;${resumo.descontosTotal.toFixed(2)}`,
      `Taxas;${resumo.taxas.toFixed(2)}`,
      `Reembolsos;${resumo.reembolsosTotal.toFixed(2)}`,
      `Líquido;${resumo.liquido.toFixed(2)}`,
    ].join("\n");
    const csv = [header, ...linhas, rodape].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "extrato.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminCardTeste id="financeiro-extrato" className="scroll-mt-24 space-y-4">
      <div>
        <AdminCardTitleTeste>Extrato</AdminCardTitleTeste>
        <AdminCardDescriptionTeste>
          Os mesmos {resumo.countPedidos} pedidos da conta acima, com o
          líquido de cada um e a taxa discriminada.
        </AdminCardDescriptionTeste>
      </div>

      {resumo.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Carregando extrato…
        </p>
      ) : resumo.isError ? (
        <p className="text-sm text-foreground">
          Não foi possível carregar o extrato. Tente novamente.
        </p>
      ) : resumo.pedidos.length === 0 && resumo.reembolsos.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum pedido entregue neste período — por isso o extrato está
          vazio. Quando houver pedido, ele aparece aqui e na conta acima.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copiar}
              className="rounded-full border border-border bg-card px-3 py-2 text-sm font-bold text-foreground"
            >
              {copiado ? "Copiado!" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={baixarCsv}
              className="rounded-full border border-border bg-card px-3 py-2 text-sm font-bold text-foreground"
            >
              Baixar Extrato
            </button>
            <select
              aria-label="Filtrar por forma de pagamento"
              value={filtroPagamento}
              onChange={(e) => setFiltroPagamento(e.target.value)}
              className="rounded-full border border-border bg-card px-3 py-2 text-sm font-bold text-foreground"
            >
              <option value="todas">Todas</option>
              {formas.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="search"
              aria-label="Buscar por número do pedido"
              placeholder="Buscar nº do pedido"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="rounded-full border border-border bg-card px-3 py-2 text-sm text-foreground"
            />
          </div>
          {filtroAtivo && (
            <p className="text-xs text-muted-foreground">
              Exibindo {exibidos.length} de {resumo.countPedidos} pedidos.
            </p>
          )}
          <ul className="divide-y divide-border">
            {exibidos.map((p) => (
              <li key={p.id} className="space-y-1 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold text-foreground">
                    Pedido #{p.id.slice(0, 6).toUpperCase()} ·{" "}
                    {format(new Date(p.createdAt), "dd/MM/yyyy HH:mm")}
                  </span>
                  <AdminMoneyTeste value={formatBRL(p.liquido)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {paymentLabelTeste(p.paymentMethod)} · Venda{" "}
                  {formatBRL(p.venda)}
                  {p.desconto > 0 && ` · Desconto ${formatBRL(p.desconto)}`}
                  {p.frete > 0 &&
                    ` · Frete (cliente) ${formatBRL(p.frete)}`}
                  {` · Taxa de plataforma ${formatBRL(p.taxaPlataforma)}`}
                  {p.comissao > 0 && ` · Comissão ${formatBRL(p.comissao)}`}
                </p>
              </li>
            ))}
            {resumo.reembolsos.map((r) => (
              <li key={r.id} className="space-y-1 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold text-foreground">
                    Reembolso ao cliente ·{" "}
                    {format(new Date(r.createdAt), "dd/MM/yyyy HH:mm")}
                  </span>
                  <AdminMoneyTeste value={`− ${formatBRL(r.valor)}`} />
                </div>
                {r.referenceCode && (
                  <p className="text-xs text-muted-foreground">
                    Referência {r.referenceCode}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted-foreground">Bruto</span>
              <AdminMoneyTeste value={formatBRL(resumo.bruto)} />
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Frete cobrado do cliente
              </span>
              <AdminMoneyTeste value={`+ ${formatBRL(resumo.freteTotal)}`} />
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted-foreground">Descontos</span>
              <AdminMoneyTeste
                value={`− ${formatBRL(resumo.descontosTotal)}`}
              />
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted-foreground">Taxas</span>
              <AdminMoneyTeste value={`− ${formatBRL(resumo.taxas)}`} />
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted-foreground">Reembolsos</span>
              <AdminMoneyTeste value={`− ${formatBRL(resumo.reembolsosTotal)}`} />
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-bold text-foreground">Líquido</span>
              <AdminMoneyTeste value={formatBRL(resumo.liquido)} className="text-base" />
            </div>
          </div>
        </>
      )}
    </AdminCardTeste>
  );
}
