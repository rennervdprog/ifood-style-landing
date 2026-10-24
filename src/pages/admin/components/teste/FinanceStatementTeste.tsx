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
 */
import { format } from "date-fns";
import { formatBRL } from "@/lib/utils";
import {
  AdminCardTeste,
  AdminCardDescriptionTeste,
  AdminCardTitleTeste,
  AdminMoneyTeste,
} from "./AdminBaseTeste";
import type { FinanceiroResumoTeste } from "./useFinanceiroTeste";

function paymentLabel(method: string) {
  if (method === "pix") return "Pix";
  if (method === "cartao") return "Cartão";
  if (method === "dinheiro") return "Dinheiro";
  return method || "—";
}

export default function FinanceStatementTeste({
  resumo,
}: {
  resumo: FinanceiroResumoTeste;
}) {
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
          <ul className="divide-y divide-border">
            {resumo.pedidos.map((p) => (
              <li key={p.id} className="space-y-1 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold text-foreground">
                    Pedido #{p.id.slice(0, 6).toUpperCase()} ·{" "}
                    {format(new Date(p.createdAt), "dd/MM/yyyy HH:mm")}
                  </span>
                  <AdminMoneyTeste value={formatBRL(p.liquido)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {paymentLabel(p.paymentMethod)} · Venda{" "}
                  {formatBRL(p.venda)}
                  {p.frete > 0 && ` · Frete ${formatBRL(p.frete)}`} · Taxa de
                  plataforma {formatBRL(p.taxaPlataforma)}
                  {p.comissao > 0 && ` · Comissão ${formatBRL(p.comissao)}`}
                  {p.taxaPlataforma === 0 && p.comissao === 0 &&
                    " · Sem taxa do ItaSuper"}
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
