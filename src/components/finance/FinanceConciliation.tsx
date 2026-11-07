import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  classifyOrderSource,
  orderDisplayCode,
  paymentLabel,
  statusLabel,
  SOURCE_LABELS,
} from "@/pages/admin/components/orders/ordersReport";

/**
 * Conciliação do período (Relatórios — Fase D): o "quanto entrou" da loja,
 * decomposto em itens + taxas de entrega, por forma de pagamento, com o
 * extrato pedido a pedido exportável. Ao lado fica o quanto a loja deve à
 * plataforma (repasse acumulado atual), que continua explicado na aba
 * Cobranças.
 */

type Preset = "mes_atual" | "mes_passado" | "30d" | "90d" | "custom";

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function presetRange(p: Preset): { start: string; end: string } {
  const now = new Date();
  if (p === "mes_atual") {
    return { start: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: isoDate(now) };
  }
  if (p === "mes_passado") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: isoDate(first), end: isoDate(last) };
  }
  if (p === "30d") {
    const s = new Date(now); s.setDate(now.getDate() - 29);
    return { start: isoDate(s), end: isoDate(now) };
  }
  const s = new Date(now); s.setDate(now.getDate() - 89);
  return { start: isoDate(s), end: isoDate(now) };
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: "mes_atual", label: "Mês atual" },
  { key: "mes_passado", label: "Mês passado" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "custom", label: "Personalizado" },
];

export default function FinanceConciliation({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [preset, setPreset] = useState<Preset>("mes_atual");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = useMemo(() => {
    if (preset === "custom") {
      return { start: custom.from || isoDate(new Date()), end: custom.to || isoDate(new Date()) };
    }
    return presetRange(preset);
  }, [preset, custom]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["finance-conciliation", storeId, range.start, range.end],
    queryFn: async () => {
      const from = new Date(`${range.start}T00:00:00`); from.setDate(from.getDate() - 1);
      const to = new Date(`${range.end}T00:00:00`); to.setDate(to.getDate() + 1);
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, created_at, status, payment_method, order_source, neighborhood, subtotal, delivery_fee, total_price")
        .eq("store_id", storeId)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []).filter((o: any) => {
        if (o.status === "aguardando_pagamento" || o.status === "aguardando_comprovante") return false;
        const d = isoDate(new Date(o.created_at));
        return d >= range.start && d <= range.end;
      });
    },
    staleTime: 60_000,
    enabled: !!storeId,
  });

  const { data: balance } = useQuery({
    queryKey: ["finance-conciliation-balance", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_balances")
        .select("repasse_pendente, comissao_pendente")
        .eq("store_id", storeId)
        .maybeSingle();
      return data as any;
    },
    staleTime: 60_000,
    enabled: !!storeId,
  });

  const { data: publicStore } = useQuery({
    queryKey: ["finance-conciliation-split", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("stores_public")
        .select("platform_split_effective")
        .eq("id", storeId)
        .maybeSingle();
      return data as any;
    },
    staleTime: 300_000,
    enabled: !!storeId,
  });

  const valid = useMemo(() => (orders || []).filter((o: any) => o.status !== "cancelado"), [orders]);
  const cancelledCount = (orders || []).length - valid.length;
  const sumItens = valid.reduce((s: number, o: any) => s + Number(o.subtotal || 0), 0);
  const sumEntrega = valid.reduce((s: number, o: any) => s + Number(o.delivery_fee || 0), 0);
  const sumTotal = valid.reduce((s: number, o: any) => s + Number(o.total_price || 0), 0);
  const residual = sumTotal - sumItens - sumEntrega;

  const byPayment = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const o of valid) {
      const k = paymentLabel(o.payment_method);
      const cur = map.get(k) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(o.total_price || 0);
      map.set(k, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [valid]);

  const splitEfetivo = Number(publicStore?.platform_split_effective ?? 0.99);
  const repassePendente = Number(balance?.repasse_pendente || 0);
  const comissaoPendente = Number(balance?.comissao_pendente || 0);

  const exportCsv = () => {
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Data", "Pedido", "Origem", "Pagamento", "Status", "Subtotal", "Taxa de entrega", "Total"];
    const lines = (orders || []).map((o: any) =>
      [
        new Date(o.created_at).toLocaleString("pt-BR"),
        orderDisplayCode(o),
        SOURCE_LABELS[classifyOrderSource(o)],
        paymentLabel(o.payment_method),
        statusLabel(o.status),
        formatBRL(Number(o.subtotal || 0)),
        formatBRL(Number(o.delivery_fee || 0)),
        formatBRL(Number(o.total_price || 0)),
      ].map(esc).join(";")
    );
    lines.push(["", "", "", "", "TOTAL (sem cancelados)", formatBRL(sumItens), formatBRL(sumEntrega), formatBRL(sumTotal)].map(esc).join(";"));
    const blob = new Blob(["\uFEFF" + [header.map(esc).join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-${storeName.toLowerCase().replace(/\s+/g, "-")}-${range.start}_a_${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Extrato exportado!");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all ${
              preset === p.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <span className="flex flex-wrap items-center gap-1.5">
            <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="h-8 rounded-lg border border-border bg-card px-2 text-xs font-bold text-foreground" aria-label="Data inicial" />
            <span className="text-xs font-bold text-muted-foreground">até</span>
            <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="h-8 rounded-lg border border-border bg-card px-2 text-xs font-bold text-foreground" aria-label="Data final" />
          </span>
        )}
        <button
          onClick={exportCsv}
          disabled={isLoading || (orders || []).length === 0}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Exportar extrato CSV
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : valid.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center">
          <p className="text-sm font-bold text-foreground">Nenhuma venda no período</p>
          <p className="mt-1 text-xs text-muted-foreground">Escolha outro período pra ver a conciliação.</p>
        </div>
      ) : (
        <>
          <section className="border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-black text-foreground">Quanto entrou no período</h3>
              <p className="text-[11px] text-muted-foreground">{valid.length} pedidos válidos{cancelledCount > 0 ? ` · ${cancelledCount} cancelados fora da conta` : ""}</p>
            </div>
            <div className="space-y-2 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Vendas de itens</span><span className="font-bold tabular-nums">{formatBRL(sumItens)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Taxas de entrega recebidas dos clientes</span><span className="font-bold tabular-nums">{formatBRL(sumEntrega)}</span></div>
              {Math.abs(residual) > 0.005 && (
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{residual < 0 ? "Descontos (cupons e ajustes)" : "Acréscimos"}</span><span className="font-bold tabular-nums">{formatBRL(residual)}</span></div>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-base"><span className="font-black">Total que entrou pra loja</span><span className="font-black tabular-nums text-primary">{formatBRL(sumTotal)}</span></div>
            </div>
            <div className="border-t border-border px-4 py-3">
              <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground">Por forma de pagamento</p>
              <div className="space-y-1.5">
                {byPayment.map(([label, v]) => (
                  <div key={label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{label} <span className="text-[11px]">({v.count}x)</span></span>
                    <span className="font-bold tabular-nums">{formatBRL(v.total)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-border px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Repasse ItaSuper acumulado (hoje)</span>
                <span className="font-bold tabular-nums">{formatBRL(repassePendente + comissaoPendente)}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatBRL(splitEfetivo)} por entrega, cobrado nas rodadas de segunda — detalhes e quitação na aba Cobranças. O Pix direto cai 100% na conta da loja; este valor é só a parte da plataforma.
              </p>
            </div>
          </section>

          <section className="border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-black text-foreground">Extrato do período</h3>
              <p className="text-[11px] text-muted-foreground">Pedido a pedido — é a lista que sai no CSV, pra conferir com a maquininha e com o banco.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-black">Data</th>
                    <th className="px-4 py-2 font-black">Pedido</th>
                    <th className="px-4 py-2 font-black">Pagamento</th>
                    <th className="px-4 py-2 font-black">Status</th>
                    <th className="px-4 py-2 text-right font-black">Subtotal</th>
                    <th className="px-4 py-2 text-right font-black">Entrega</th>
                    <th className="px-4 py-2 text-right font-black">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(orders || []).map((o: any) => (
                    <tr key={o.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")} {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-2 font-bold">{orderDisplayCode(o)}</td>
                      <td className="px-4 py-2">{paymentLabel(o.payment_method)}</td>
                      <td className="px-4 py-2">{statusLabel(o.status)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatBRL(Number(o.subtotal || 0))}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatBRL(Number(o.delivery_fee || 0))}</td>
                      <td className="px-4 py-2 text-right font-bold tabular-nums">{formatBRL(Number(o.total_price || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
