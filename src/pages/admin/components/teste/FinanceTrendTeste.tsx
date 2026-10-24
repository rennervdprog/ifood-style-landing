/**
 * TELA 4 — Tendência do Financeiro (/admin-teste).
 *
 * De volta os três blocos do original (StoreFinanceBasic), com as
 * mesmas fórmulas, calculados da MESMA lista do hook único:
 *  - Evolução de Vendas: subtotal por dia do período (dailyData).
 *  - Horários de Pico: nº de pedidos por hora (hourlyData).
 *  - Distribuição por Pagamento: nº e total (valor cobrado) por forma
 *    de pagamento, com os rótulos traduzidos de paymentLabelTeste
 *    (paymentBreakdown do original usava total_price).
 * Renderização leve com divs e tokens do tema (bg-primary/bg-muted),
 * sem biblioteca nova, sem hex inventado.
 */
import { useMemo } from "react";
import { format } from "date-fns";
import { formatBRL } from "@/lib/utils";
import {
  AdminCardTeste,
  AdminCardDescriptionTeste,
  AdminCardTitleTeste,
} from "./AdminBaseTeste";
import { paymentLabelTeste } from "./paymentLabelTeste";
import type { FinanceiroResumoTeste } from "./useFinanceiroTeste";

function Barra({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
      />
    </div>
  );
}

export default function FinanceTrendTeste({
  resumo,
}: {
  resumo: FinanceiroResumoTeste;
}) {
  const daily = useMemo(() => {
    if (resumo.pedidos.length === 0) return [];
    const map = new Map<string, { vendas: number; pedidos: number; ts: number }>();
    resumo.pedidos.forEach((p) => {
      const day = format(new Date(p.createdAt), "dd/MM");
      const cur = map.get(day) ?? {
        vendas: 0,
        pedidos: 0,
        ts: new Date(p.createdAt).getTime(),
      };
      cur.vendas += p.venda;
      cur.pedidos += 1;
      cur.ts = Math.min(cur.ts, new Date(p.createdAt).getTime());
      map.set(day, cur);
    });
    return [...map.entries()]
      .map(([day, d]) => ({ day, ...d }))
      .sort((a, b) => a.ts - b.ts);
  }, [resumo.pedidos]);

  const hourly = useMemo(() => {
    const hours: Record<number, number> = {};
    resumo.pedidos.forEach((p) => {
      const h = new Date(p.createdAt).getHours();
      hours[h] = (hours[h] || 0) + 1;
    });
    return Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}h`,
      pedidos: hours[h] || 0,
    })).filter((h) => h.pedidos > 0 || (h.hour >= "08h" && h.hour <= "23h"));
  }, [resumo.pedidos]);

  const byPayment = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    resumo.pedidos.forEach((p) => {
      const label = paymentLabelTeste(p.paymentMethod);
      const cur = map.get(label) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += p.cobrado;
      map.set(label, cur);
    });
    return [...map.entries()]
      .map(([label, d]) => ({ label, ...d }))
      .sort((a, b) => b.total - a.total);
  }, [resumo.pedidos]);

  if (resumo.isLoading) {
    return (
      <AdminCardTeste>
        <p className="py-8 text-center text-sm text-muted-foreground">
          Carregando tendência…
        </p>
      </AdminCardTeste>
    );
  }
  if (resumo.isError || resumo.pedidos.length === 0) {
    return (
      <AdminCardTeste>
        <AdminCardTitleTeste>Tendência</AdminCardTitleTeste>
        <AdminCardDescriptionTeste>
          {resumo.isError
            ? "Não foi possível carregar a tendência. Tente novamente."
            : "Sem pedidos neste período para mostrar tendência."}
        </AdminCardDescriptionTeste>
      </AdminCardTeste>
    );
  }

  const maxDaily = Math.max(0, ...daily.map((d) => d.vendas));
  const maxHourly = Math.max(0, ...hourly.map((h) => h.pedidos));
  const maxPayment = Math.max(0, ...byPayment.map((p) => p.total));

  return (
    <AdminCardTeste className="space-y-6">
      <div>
        <AdminCardTitleTeste>Tendência</AdminCardTitleTeste>
        <AdminCardDescriptionTeste>
          Evolução, horários de pico e formas de pagamento do período (
          {resumo.intervaloLabel}).
        </AdminCardDescriptionTeste>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-foreground">
          Evolução de Vendas
        </h3>
        <ul className="space-y-2">
          {daily.map((d) => (
            <li key={d.day} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">
                {d.day}
              </span>
              <Barra value={d.vendas} max={maxDaily} />
              <span className="w-24 shrink-0 text-right text-xs font-bold text-foreground">
                {formatBRL(d.vendas)} · {d.pedidos}{" "}
                {d.pedidos === 1 ? "pedido" : "pedidos"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-foreground">
          Horários de Pico
        </h3>
        <ul className="space-y-2">
          {hourly.map((h) => (
            <li key={h.hour} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">
                {h.hour}
              </span>
              <Barra value={h.pedidos} max={maxHourly} />
              <span className="w-24 shrink-0 text-right text-xs font-bold text-foreground">
                {h.pedidos} {h.pedidos === 1 ? "pedido" : "pedidos"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-foreground">
          Distribuição por Pagamento
        </h3>
        <ul className="space-y-2">
          {byPayment.map((p) => (
            <li key={p.label} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs text-muted-foreground">
                {p.label}
              </span>
              <Barra value={p.total} max={maxPayment} />
              <span className="w-24 shrink-0 text-right text-xs font-bold text-foreground">
                {formatBRL(p.total)} · {p.count}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </AdminCardTeste>
  );
}
