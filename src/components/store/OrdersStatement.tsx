import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { printThermalReceipt } from "@/lib/thermalPrint";
import {
  buildOrdersCsv,
  classifyOrderSource,
  openOrdersReport,
  orderDisplayCode,
  paymentLabel,
  statusLabel,
  SOURCE_LABELS,
} from "@/pages/admin/components/orders/ordersReport";

/**
 * Extrato de pedidos (sub-aba de Relatórios, pedido do Renner 2026-11-07):
 * um "extrato, só que de pedidos" — período próprio de 7/15/30 dias,
 * resumo do período, a lista completa dos pedidos com valor, a notinha
 * de cada pedido (mesma impressão do cartão do pedido), o relatório
 * imprimível do período e o CSV da mesma lista. Reaproveita os helpers
 * da Fase A (ordersReport) e a impressão térmica oficial (thermalPrint).
 */

type Days = 7 | 15 | 30;

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtPtBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const PERIODS: { key: Days; label: string }[] = [
  { key: 7, label: "7 dias" },
  { key: 15, label: "15 dias" },
  { key: 30, label: "30 dias" },
];

export default function OrdersStatement({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [days, setDays] = useState<Days>(7);
  const range = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    return { start: isoDate(start), end: isoDate(end) };
  }, [days]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders-statement", storeId, range.start, range.end],
    queryFn: async () => {
      const from = new Date(`${range.start}T00:00:00`); from.setDate(from.getDate() - 1);
      const to = new Date(`${range.end}T00:00:00`); to.setDate(to.getDate() + 1);
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name))")
        .eq("store_id", storeId)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);
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

  // Contatos dos clientes do recorte (nome/telefone) — alimentam o CSV,
  // o relatório e a notinha, como os getters das telas de pedidos.
  const clientIds = useMemo(
    () => [...new Set((orders || []).map((o: any) => o.client_id).filter(Boolean))],
    [orders]
  );
  const { data: profiles } = useQuery({
    queryKey: ["orders-statement-profiles", storeId, clientIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, whatsapp_number, phone")
        .in("user_id", clientIds as string[]);
      if (error) throw error;
      return data || [];
    },
    staleTime: 300_000,
    enabled: clientIds.length > 0,
  });
  const profileMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of profiles || []) map.set((p as any).user_id, p);
    return map;
  }, [profiles]);
  const getters = useMemo(
    () => ({
      getClientName: (clientId: string) => profileMap.get(clientId)?.full_name || "Cliente",
      getClientWhatsApp: (clientId: string) =>
        profileMap.get(clientId)?.whatsapp_number || profileMap.get(clientId)?.phone || "",
    }),
    [profileMap]
  );

  // Configuração de impressão da loja (vias e largura) — mesmos padrões
  // do botão Imprimir do cartão do pedido.
  const { data: storeRow } = useQuery({
    queryKey: ["orders-statement-store", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("settings").eq("id", storeId).maybeSingle();
      return data as any;
    },
    staleTime: 300_000,
    enabled: !!storeId,
  });

  const valid = useMemo(() => (orders || []).filter((o: any) => o.status !== "cancelado"), [orders]);
  const cancelledCount = (orders || []).length - valid.length;
  const revenue = valid.reduce((s: number, o: any) => s + Number(o.total_price || 0), 0);
  const ticket = valid.length ? revenue / valid.length : 0;

  const handlePrintOrder = async (order: any) => {
    const settings = (storeRow?.settings as any) || {};
    const copies = (settings.print_copies === 1 ? 1 : 2) as 1 | 2;
    const paperWidth = (settings.print_paper_width === 58 ? 58 : 80) as 58 | 80;
    let name = getters.getClientName(order.client_id);
    let phone = getters.getClientWhatsApp(order.client_id);
    // Mesmo resgate do painel: se o contato não veio no mapa, busca na RPC.
    if (!name || name === "Cliente" || !phone) {
      try {
        const { data } = await supabase.rpc("get_delivery_contacts", { _order_ids: [order.id] });
        const row = (data || []).find((r: any) => r.user_id === order.client_id) || (data || [])[0];
        if (row) {
          if (row.full_name) name = row.full_name;
          if (!phone) phone = row.whatsapp_number || row.phone || "";
        }
      } catch {
        /* segue com o que houver */
      }
    }
    printThermalReceipt(order, storeName || "Loja", name || "Cliente", phone, { copies, paperWidth });
  };

  const handleReport = () => {
    const ok = openOrdersReport({
      storeName: storeName || "Loja",
      periodLabel: `${fmtPtBR(range.start)} a ${fmtPtBR(range.end)} (${days} dias)`,
      filtersLabel: "Sem filtros",
      orders: orders || [],
      getters,
    });
    if (!ok) toast.error("Não consegui abrir o relatório. Libere as janelas pop-up e tente de novo.");
  };

  const handleCsv = () => {
    const csv = buildOrdersCsv(orders || [], getters);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-pedidos-${(storeName || "loja").toLowerCase().replace(/\s+/g, "-")}-${range.start}_a_${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Extrato exportado!");
  };

  return (
    <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
      <p className="text-xs font-bold text-foreground mb-1">🧾 Extrato de Pedidos</p>
      <p className="text-[10px] text-muted-foreground mb-4">
        A lista dos pedidos do período, um por um com o valor — como um extrato, só que de pedidos. O período aqui é só desta sub-aba.
      </p>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setDays(p.key)}
            aria-pressed={days === p.key}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
              days === p.key
                ? "bg-primary text-primary-foreground shadow shadow-primary/20"
                : "bg-card text-muted-foreground border border-border/60 hover:bg-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        Período: <strong className="text-foreground">{fmtPtBR(range.start)}</strong> a{" "}
        <strong className="text-foreground">{fmtPtBR(range.end)}</strong>
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={handleReport}
          disabled={isLoading || (orders || []).length === 0}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          <FileText className="h-3.5 w-3.5" /> Gerar relatório
        </button>
        <button
          onClick={handleCsv}
          disabled={isLoading || (orders || []).length === 0}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border text-foreground text-xs font-bold disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (orders || []).length === 0 ? (
        <div className="mt-4 p-8 rounded-xl bg-card border border-border/40 text-center">
          <p className="text-sm font-bold text-foreground">Nenhum pedido no período</p>
          <p className="text-xs text-muted-foreground mt-1">Escolha 15 ou 30 dias pra ver mais pedidos.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              { label: "Pedidos no período", value: String(valid.length) },
              { label: "Faturamento", value: formatBRL(revenue) },
              { label: "Ticket médio", value: formatBRL(ticket) },
              { label: "Cancelados (fora do total)", value: String(cancelledCount) },
            ].map((k) => (
              <div key={k.label} className="bg-card rounded-xl p-3.5 border border-border/40">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{k.label}</p>
                <p className="text-xl font-black tracking-tight mt-1 text-foreground tabular-nums">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 divide-y divide-border/50 rounded-xl border border-border/40 bg-card overflow-hidden">
            {(orders || []).map((o: any) => {
              const cancelled = o.status === "cancelado";
              return (
                <div key={o.id} className={`flex items-center gap-2.5 px-3.5 py-2.5 ${cancelled ? "opacity-60" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-foreground tabular-nums">
                      {orderDisplayCode(o)}{" "}
                      <span className="text-[11px] font-semibold text-muted-foreground">{fmtWhen(o.created_at)}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {SOURCE_LABELS[classifyOrderSource(o)]} · {paymentLabel(o.payment_method)} ·{" "}
                      {o.neighborhood === "RETIRADA" ? "Retirada" : o.neighborhood || "—"}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                      cancelled
                        ? "bg-destructive/10 text-destructive"
                        : o.status === "finalizado" || o.status === "entregue"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {statusLabel(o.status)}
                  </span>
                  <span className="text-[13px] font-bold text-foreground tabular-nums shrink-0">
                    {formatBRL(Number(o.total_price || 0))}
                  </span>
                  <button
                    onClick={() => handlePrintOrder(o)}
                    title="Imprimir a notinha deste pedido"
                    aria-label={`Imprimir a notinha do pedido ${orderDisplayCode(o)}`}
                    className="p-2 bg-muted rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
