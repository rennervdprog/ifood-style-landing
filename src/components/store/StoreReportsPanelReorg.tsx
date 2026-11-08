// Fase 4 da reorganização do painel (2026-11-08) — cópia Reorg, SOMENTE /admin-teste.
import { useMemo, useState, lazy, Suspense, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Calendar as CalIcon, Download, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { openWhatsApp } from "@/lib/whatsapp";
import OrdersStatement from "@/components/store/OrdersStatement";

const DailyRevenueChart = lazy(() =>
  import("@/components/admin/AdminCharts").then((m) => ({ default: m.DailyRevenueChart }))
);
const HourlyBarChart = lazy(() =>
  import("@/components/admin/AdminCharts").then((m) => ({ default: m.HourlyBarChart }))
);
const PaymentPieChart = lazy(() =>
  import("@/components/admin/AdminCharts").then((m) => ({ default: m.PaymentPieChart }))
);

type SubTab = "overview" | "sales" | "products" | "hours" | "bairros" | "clientes" | "funil" | "extrato";

// Mapas únicos de rótulos (o mapa local antigo não cobria os valores reais
// do banco — cash, maquininha_pix, whatsapp_bot etc. vazavam crus na tela).
import { PAYMENT_METHOD_LABELS as PAYMENT_LABELS, ORDER_SOURCE_LABELS as SOURCE_LABELS } from "@/lib/orderLabels";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_FULL = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function fmtPtBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function growth(cur: number, prev: number) {
  if (prev > 0) return ((cur - prev) / prev) * 100;
  return cur > 0 ? 100 : 0;
}

type Preset = "hoje" | "ontem" | "7d" | "30d" | "mes" | "mespassado" | "custom";

export default function StoreReportsPanelReorg({ storeId, storeName }: { storeId: string; storeName?: string }) {
  const today = useMemo(() => isoDate(new Date()), []);
  const [preset, setPreset] = useState<Preset>("hoje");
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [sub, setSub] = useState<SubTab>("overview");

  function applyPreset(p: Preset) {
    setPreset(p);
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);
    if (p === "hoje") { /* same day */ }
    else if (p === "ontem") { start.setDate(now.getDate() - 1); end.setDate(now.getDate() - 1); }
    else if (p === "7d") start.setDate(now.getDate() - 6);
    else if (p === "30d") start.setDate(now.getDate() - 29);
    else if (p === "mes") { start = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (p === "mespassado") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    }
    else return; // custom: mantém datas escolhidas
    setStartDate(isoDate(start));
    setEndDate(isoDate(end));
  }

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["store-report", storeId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_report" as any, {
        _store_id: storeId,
        _start_date: startDate,
        _end_date: endDate,
      });
      if (error) throw error;
      return data as any;
    },
    staleTime: 60_000,
    enabled: !!storeId && !!startDate && !!endDate,
  });

  // Pedidos brutos do período (com 1 dia de margem, filtrados pela data
  // local) — base dos cancelamentos por motivo.
  const { data: extraOrders } = useQuery({
    queryKey: ["store-report-extra", storeId, startDate, endDate],
    queryFn: async () => {
      const from = parseISO(startDate); from.setDate(from.getDate() - 1);
      const to = parseISO(endDate); to.setDate(to.getDate() + 1);
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, status, cancel_reason, total_price, neighborhood, client_lat, client_lng, client_id")
        .eq("store_id", storeId)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());
      if (error) throw error;
      return (data || []).filter((o: any) => {
        const d = isoDate(new Date(o.created_at));
        return d >= startDate && d <= endDate;
      });
    },
    staleTime: 60_000,
    enabled: !!storeId && !!startDate && !!endDate,
  });

  // Funil da loja: eventos de page_views da loja no período (mesma margem
  // de 1 dia + filtro pela data local da query de cancelamentos).
  const { data: funnelRows } = useQuery({
    queryKey: ["store-report-funnel", storeId, startDate, endDate],
    queryFn: async () => {
      const from = parseISO(startDate); from.setDate(from.getDate() - 1);
      const to = parseISO(endDate); to.setDate(to.getDate() + 1);
      const { data, error } = await supabase
        .from("page_views")
        .select("page, visitor_hash, created_at")
        .eq("store_id", storeId)
        .in("page", ["store_page", "product_view", "cart_view", "checkout"])
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .limit(20000);
      if (error) throw error;
      return (data || []).filter((r: any) => {
        const d = isoDate(new Date(r.created_at));
        return d >= startDate && d <= endDate;
      });
    },
    staleTime: 60_000,
    enabled: !!storeId && !!startDate && !!endDate,
  });

  // Catálogo ativo da loja — base dos "nunca venderam no período".
  const { data: catalogProducts } = useQuery({
    queryKey: ["store-catalog-products", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("store_id", storeId)
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 300_000,
    enabled: !!storeId,
  });

  // Histórico completo da loja (leve) + contatos — base da aba Clientes
  // (chave = telefone) e da lista de sumidos.
  const { data: historyData } = useQuery({
    queryKey: ["store-report-history", storeId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("orders")
        .select("id, created_at, status, total_price, client_id")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true })
        .limit(10000);
      if (error) throw error;
      const orders = rows || [];
      const contacts: Record<string, { name: string; phone: string }> = {};
      const ids = orders.slice(-2000).map((o: any) => o.id);
      if (ids.length) {
        try {
          const { data: cts } = await supabase.rpc("get_delivery_contacts" as any, { _order_ids: ids });
          for (const c of (cts as any[]) || []) {
            if (c?.user_id) contacts[c.user_id] = { name: c.full_name || "", phone: c.whatsapp_number || c.phone || "" };
          }
        } catch { /* sem contatos: a aba Clientes mostra a cobertura menor */ }
      }
      return { orders, contacts };
    },
    staleTime: 60_000,
    enabled: !!storeId,
  });

  // Slug + coordenadas da loja (link do cardápio no "chamar de volta" e
  // marcador da loja no mapa de calor).
  const { data: storeMeta } = useQuery({
    queryKey: ["store-report-meta", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("slug, latitude, longitude").eq("id", storeId).maybeSingle();
      return data as any;
    },
    staleTime: 300_000,
    enabled: !!storeId,
  });

  const resumo = data?.resumo || {};
  const prev = data?.resumo_anterior || {};
  const receita = Number(resumo.receita_total || 0);
  const pedidos = Number(resumo.pedidos || 0);
  const ticket = Number(resumo.ticket_medio || 0);
  const cancelRate = Number(resumo.taxa_cancelamento || 0);
  const gRev = growth(receita, Number(prev.receita_total || 0));
  const gOrd = growth(pedidos, Number(prev.pedidos || 0));
  const gTk = growth(ticket, Number(prev.ticket_medio || 0));

  const dias: Array<{ data: string; pedidos: number; receita: number }> = data?.dias || [];
  const horarios: Array<{ hora: number; pedidos: number; receita: number }> = data?.horarios || [];
  const pagamentos: Array<{ metodo: string; pedidos: number; receita: number }> = data?.pagamentos || [];
  const origem: Array<{ origem: string; pedidos: number; receita: number }> = data?.origem || [];
  const produtos: Array<{ product_id: string | null; nome: string; quantidade: number; receita: number; ticket_medio: number }> = data?.produtos || [];
  const pico = data?.horario_pico as { hora?: number; pedidos?: number } | null;
  const melhor = data?.melhor_dia as { dow?: number; pedidos?: number; receita?: number } | null;

  const dailyChart = dias.map((d) => {
    const [, m, day] = d.data.split("-");
    return { day: `${day}/${m}`, vendas: Math.round(Number(d.receita) * 100) / 100, pedidos: d.pedidos };
  });
  const hourlyChart = horarios
    .map((h) => ({ hour: `${String(h.hora).padStart(2, "0")}h`, pedidos: h.pedidos }))
    .filter((h) => h.pedidos > 0 || (parseInt(h.hour) >= 8 && parseInt(h.hour) <= 23));
  // Agrupa pelo RÓTULO: a RPC soma por valor cru, e valores diferentes com o
  // mesmo nome ('dinheiro' + 'cash' → "Dinheiro") viram UMA fatia só — senão
  // o gráfico e a legenda mostram "Dinheiro" duas vezes.
  const paymentPie = (() => {
    const byLabel = new Map<string, { name: string; value: number; total: number }>();
    for (const p of pagamentos) {
      const name = PAYMENT_LABELS[p.metodo] || p.metodo || "Outros";
      const cur = byLabel.get(name) || { name, value: 0, total: 0 };
      cur.value += Number(p.pedidos || 0);
      cur.total += Number(p.receita || 0);
      byLabel.set(name, cur);
    }
    return [...byLabel.values()];
  })();
  const PIE_COLORS = ["#10b981", "#3b82f6", "#FF8000", "#a855f7", "#ef4444", "#0ea5e9"];

  const totalProdReceita = produtos.reduce((s, p) => s + Number(p.receita || 0), 0);

  // Semana completa: agrega as linhas por data da RPC no dia da semana.
  const weekdayStats = useMemo(() => {
    const acc = WEEKDAYS.map((label, dow) => ({ label, dow, pedidos: 0, receita: 0 }));
    for (const d of dias) {
      const dow = parseISO(d.data).getDay();
      acc[dow].pedidos += Number(d.pedidos || 0);
      acc[dow].receita += Number(d.receita || 0);
    }
    return [1, 2, 3, 4, 5, 6, 0].map((dow) => acc[dow]);
  }, [dias]);
  const weekdayMaxReceita = Math.max(0, ...weekdayStats.map((w) => w.receita));

  // Cancelamentos por motivo: códigos conhecidos viram rótulo; motivo em
  // texto livre aparece como foi escrito; sem registro tem balde próprio.
  const cancelStats = useMemo(() => {
    const CANCEL_LABELS: Record<string, string> = {
      client_request: "Cliente pediu",
      pix_expirado: "Pix expirado",
      out_of_stock: "Falta de estoque",
      store_closed: "Loja fechada",
      other: "Outro motivo",
    };
    const map = new Map<string, { count: number; amount: number }>();
    let total = 0;
    let totalAmount = 0;
    for (const o of extraOrders || []) {
      if (o.status !== "cancelado") continue;
      total += 1;
      const amount = Number((o as any).total_price || 0);
      totalAmount += amount;
      const raw = String(o.cancel_reason || "").trim();
      const label = !raw ? "Sem motivo registrado" : CANCEL_LABELS[raw.toLowerCase()] || raw;
      const cur = map.get(label) || { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += amount;
      map.set(label, cur);
    }
    const sorted = [...map.entries()].sort((a, b) => b[1].amount - a[1].amount);
    const top = sorted.slice(0, 8).map(([label, v]) => ({ label, count: v.count, amount: v.amount }));
    const restRows = sorted.slice(8);
    if (restRows.length > 0) {
      top.push({
        label: "Outros motivos",
        count: restRows.reduce((s, [, v]) => s + v.count, 0),
        amount: restRows.reduce((s, [, v]) => s + v.amount, 0),
      });
    }
    return { total, totalAmount, rows: top };
  }, [extraOrders]);

  const noReasonRow = cancelStats.rows.find((r) => r.label === "Sem motivo registrado");
  const noReasonShare = noReasonRow && cancelStats.total > 0 ? noReasonRow.count / cancelStats.total : 0;

  // Mapa de calor dia × hora: cruza os pedidos brutos do período (a mesma
  // base dos cancelamentos), contando só os pedidos válidos.
  const heatmap = useMemo(() => {
    const grid: number[][] = WEEKDAYS.map(() => Array(24).fill(0));
    let max = 0;
    let peak = { dow: -1, hour: -1, count: 0 };
    for (const o of extraOrders || []) {
      if (o.status === "cancelado" || o.status === "aguardando_pagamento" || o.status === "aguardando_comprovante") continue;
      const d = new Date(o.created_at);
      const dow = d.getDay();
      const hour = d.getHours();
      grid[dow][hour] += 1;
      if (grid[dow][hour] > max) {
        max = grid[dow][hour];
        peak = { dow, hour, count: max };
      }
    }
    return { grid, max, peak };
  }, [extraOrders]);

  const heatBestDay = weekdayStats.reduce(
    (a, w) => (w.pedidos > (a?.pedidos || 0) ? w : a),
    null as null | { dow: number; pedidos: number }
  );
  const heatPeakHour = horarios.reduce(
    (a, h) => (h.pedidos > (a?.pedidos || 0) ? h : a),
    null as null | { hora: number; pedidos: number }
  );

  // Curva ABC sobre a receita de itens: A concentra até 80%, B até 95%.
  const abc = useMemo(() => {
    const sorted = [...produtos].sort((a, b) => Number(b.receita || 0) - Number(a.receita || 0));
    const total = sorted.reduce((sum, p) => sum + Number(p.receita || 0), 0);
    const byKey = new Map<string, "A" | "B" | "C">();
    const counts = { A: 0, B: 0, C: 0 };
    const rev = { A: 0, B: 0, C: 0 };
    let cum = 0;
    for (const p of sorted) {
      const prevShare = total > 0 ? cum / total : 1;
      const cls: "A" | "B" | "C" = prevShare < 0.8 ? "A" : prevShare < 0.95 ? "B" : "C";
      byKey.set((p.product_id || "") + p.nome, cls);
      counts[cls] += 1;
      rev[cls] += Number(p.receita || 0);
      cum += Number(p.receita || 0);
    }
    return { byKey, counts, rev, total };
  }, [produtos]);

  const neverSold = useMemo(() => {
    const sold = new Set(produtos.map((p) => p.product_id).filter(Boolean));
    return (catalogProducts || []).filter((p: any) => !sold.has(p.id));
  }, [catalogProducts, produtos]);

  // Etapas do funil: visualizações e visitantes únicos por evento.
  const funnelStages = useMemo(() => {
    const defs = [
      { page: "store_page", label: "Visitaram a loja" },
      { page: "product_view", label: "Viram um produto" },
      { page: "cart_view", label: "Abriram o carrinho" },
      { page: "checkout", label: "Foram ao checkout" },
    ];
    return defs.map((d) => {
      const rows = (funnelRows || []).filter((r: any) => r.page === d.page);
      const uniques = new Set(rows.map((r: any) => r.visitor_hash).filter(Boolean)).size;
      return { ...d, views: rows.length, uniques };
    });
  }, [funnelRows]);
  const funnelTop = Math.max(1, funnelStages[0]?.uniques || 0);

  // ─── Fase 2: Bairros (ranking normalizado + mapa de calor geográfico) ───
  const isValidOrder = (o: any) =>
    o.status !== "cancelado" && o.status !== "aguardando_pagamento" && o.status !== "aguardando_comprovante";

  const bairrosStats = useMemo(() => {
    const buckets = new Map<string, { count: number; revenue: number; spellings: Map<string, number> }>();
    for (const o of extraOrders || []) {
      if (!isValidOrder(o)) continue;
      const raw = String(o.neighborhood || "").trim();
      const key = raw.toLowerCase();
      const b = buckets.get(key) || { count: 0, revenue: 0, spellings: new Map<string, number>() };
      b.count += 1;
      b.revenue += Number(o.total_price || 0);
      if (raw) b.spellings.set(raw, (b.spellings.get(raw) || 0) + 1);
      buckets.set(key, b);
    }
    const rows = [...buckets.entries()].map(([key, b]) => {
      let label: string;
      if (key === "retirada") label = "Retirada";
      else if (key === "") label = "Sem bairro registrado";
      else if (key === "balcão" || key === "balcao") label = "Balcão (venda no local)";
      else label = [...b.spellings.entries()].sort((a, c) => c[1] - a[1])[0]?.[0] || key;
      return { label, count: b.count, revenue: b.revenue };
    });
    rows.sort((a, b) => b.count - a.count || b.revenue - a.revenue);
    return rows;
  }, [extraOrders]);
  const bairrosMax = Math.max(1, ...bairrosStats.map((b) => b.count));

  const mapData = useMemo(() => {
    const pts = (extraOrders || []).filter(
      (o: any) => isValidOrder(o) && o.client_lat != null && o.client_lng != null
    );
    const total = (extraOrders || []).length;
    const withCoords = (extraOrders || []).filter((o: any) => o.client_lat != null && o.client_lng != null).length;
    const empty = { points: [] as { x: number; y: number; n: number }[], withCoords, total, store: null as null | { x: number; y: number } };
    if (!pts.length) return empty;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const o of pts) {
      minLat = Math.min(minLat, Number(o.client_lat)); maxLat = Math.max(maxLat, Number(o.client_lat));
      minLng = Math.min(minLng, Number(o.client_lng)); maxLng = Math.max(maxLng, Number(o.client_lng));
    }
    if (storeMeta?.latitude != null && storeMeta?.longitude != null) {
      minLat = Math.min(minLat, Number(storeMeta.latitude)); maxLat = Math.max(maxLat, Number(storeMeta.latitude));
      minLng = Math.min(minLng, Number(storeMeta.longitude)); maxLng = Math.max(maxLng, Number(storeMeta.longitude));
    }
    const padLat = Math.max((maxLat - minLat) * 0.15, 0.002);
    const padLng = Math.max((maxLng - minLng) * 0.15, 0.002);
    minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng;
    const agg = new Map<string, { x: number; y: number; n: number }>();
    for (const o of pts) {
      const x = ((Number(o.client_lng) - minLng) / (maxLng - minLng)) * 300;
      const y = (1 - (Number(o.client_lat) - minLat) / (maxLat - minLat)) * 210;
      const k = `${Math.round(x / 8)}:${Math.round(y / 8)}`;
      const cur = agg.get(k) || { x, y, n: 0 };
      cur.n += 1;
      agg.set(k, cur);
    }
    const store = storeMeta?.latitude != null && storeMeta?.longitude != null
      ? { x: ((Number(storeMeta.longitude) - minLng) / (maxLng - minLng)) * 300, y: (1 - (Number(storeMeta.latitude) - minLat) / (maxLat - minLat)) * 210 }
      : null;
    return { points: [...agg.values()], withCoords, total, store };
  }, [extraOrders, storeMeta]);

  // ─── Fase 2: Clientes (chave = telefone) ───
  const clientesStats = useMemo(() => {
    const orders = (historyData?.orders || []).filter(isValidOrder);
    const contacts = historyData?.contacts || {};
    const normPhone = (raw: string) => {
      const d = String(raw || "").replace(/\D/g, "");
      if (d.length === 10 || d.length === 11) return `55${d}`;
      if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
      return "";
    };
    type ClientAgg = {
      phone: string; name: string; clientId: string;
      first: string; last: string; totalOrders: number; totalSpent: number;
      periodOrders: number; periodSpent: number; dates: string[];
    };
    const byPhone = new Map<string, ClientAgg>();
    let periodValid = 0;
    let periodIdentified = 0;
    for (const o of orders) {
      const day = isoDate(new Date(o.created_at));
      const inPeriod = day >= startDate && day <= endDate;
      if (inPeriod) periodValid += 1;
      const c = o.client_id ? contacts[o.client_id] : null;
      const phone = c ? normPhone(c.phone) : "";
      if (!phone) continue;
      if (inPeriod) periodIdentified += 1;
      const cur = byPhone.get(phone) || {
        phone, name: c?.name || "", clientId: o.client_id,
        first: day, last: day, totalOrders: 0, totalSpent: 0, periodOrders: 0, periodSpent: 0, dates: [] as string[],
      };
      if (c?.name && !cur.name) cur.name = c.name;
      if (day < cur.first) cur.first = day;
      if (day > cur.last) cur.last = day;
      cur.totalOrders += 1;
      cur.totalSpent += Number(o.total_price || 0);
      cur.dates.push(day);
      if (inPeriod) { cur.periodOrders += 1; cur.periodSpent += Number(o.total_price || 0); }
      byPhone.set(phone, cur);
    }
    const clients = [...byPhone.values()];
    const novos = clients.filter((c) => c.first >= startDate && c.first <= endDate).length;
    const recorrentes = clients.filter((c) => c.first < startDate && c.periodOrders > 0).length;
    const recompra = [30, 60, 90].map((w) => {
      const from = new Date(parseISO(endDate)); from.setDate(from.getDate() - (w - 1));
      const fromIso = isoDate(from);
      let active = 0, repeat = 0;
      for (const c of clients) {
        const n = c.dates.filter((d) => d >= fromIso && d <= endDate).length;
        if (n >= 1) active += 1;
        if (n >= 2) repeat += 1;
      }
      return { window: w, active, repeat, pct: active ? (repeat / active) * 100 : 0 };
    });
    const endMs = parseISO(endDate).getTime();
    const sumidos = clients
      .filter((c) => c.periodOrders === 0)
      .map((c) => ({ ...c, daysAgo: Math.floor((endMs - parseISO(c.last).getTime()) / 86400000) }))
      .filter((c) => c.daysAgo >= 30)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 15);
    return {
      periodValid, periodIdentified,
      coveragePct: periodValid ? (periodIdentified / periodValid) * 100 : 0,
      identifiedClients: clients.length,
      novos, recorrentes, recompra, sumidos,
    };
  }, [historyData, startDate, endDate]);

  const handleRecall = async (client: { phone: string; name: string; clientId: string }) => {
    try {
      await supabase.from("client_recall_logs" as any).insert({
        store_id: storeId,
        client_id: client.clientId,
        client_phone: String(client.phone || "").replace(/\D/g, ""),
        segment: "inactive",
        coupon_code: null,
      });
    } catch { /* o registro é apoio; a conversa abre mesmo assim */ }
    const first = (client.name || "").split(" ")[0] || "tudo bem";
    const link = storeMeta?.slug ? `https://itasuper.com.br/loja/${storeMeta.slug}` : "https://itasuper.com.br";
    openWhatsApp(client.phone, `Oi ${first}! Aqui é da ${storeName || "loja"} 😊 Sentimos sua falta! Dá uma olhada no cardápio e faz seu pedido por aqui: ${link} — esperamos você!`);
    toast.success("Boa! Agora é só apertar enviar na conversa que abriu.");
  };

  function exportCSV() {
    const lines: string[] = [];
    lines.push(`Relatório - ${storeName || "Loja"}`);
    lines.push(`Período: ${fmtPtBR(startDate)} a ${fmtPtBR(endDate)}`);
    lines.push("");
    lines.push("RESUMO");
    lines.push(`Receita,${formatCurrency(receita)}`);
    lines.push(`Pedidos,${pedidos}`);
    lines.push(`Ticket Médio,${formatCurrency(ticket)}`);
    lines.push(`Cancelamentos,${resumo.cancelados || 0}`);
    lines.push(`Taxa Cancelamento,${cancelRate.toFixed(2)}%`);
    lines.push("");
    lines.push("VENDAS POR DIA");
    lines.push("Data,Pedidos,Receita");
    dias.forEach((d) => lines.push(`${fmtPtBR(d.data)},${d.pedidos},${formatCurrency(Number(d.receita))}`));
    lines.push("");
    lines.push("PRODUTOS VENDIDOS");
    lines.push("Produto,Quantidade,Receita,% do total");
    produtos.forEach((p) => {
      const pct = totalProdReceita > 0 ? (Number(p.receita) / totalProdReceita) * 100 : 0;
      lines.push(`${p.nome},${p.quantidade},${formatCurrency(Number(p.receita))},${pct.toFixed(1)}%`);
    });
    lines.push("");
    lines.push("PAGAMENTOS");
    lines.push("Método,Pedidos,Receita");
    paymentPie.forEach((p) => lines.push(`${p.name},${p.value},${formatCurrency(p.total)}`));
    lines.push("");
    lines.push("ORIGEM DOS PEDIDOS");
    lines.push("Origem,Pedidos,Receita");
    origem.forEach((o) => lines.push(`${SOURCE_LABELS[o.origem] || o.origem},${o.pedidos},${formatCurrency(Number(o.receita))}`));
    lines.push("");
    lines.push("PEDIDOS POR HORÁRIO");
    lines.push("Hora,Pedidos,Receita");
    horarios.forEach((h) => lines.push(`${String(h.hora).padStart(2, "0")}:00,${h.pedidos},${formatCurrency(Number(h.receita))}`));
    lines.push("");
    lines.push("DIAS DA SEMANA");
    lines.push("Dia,Pedidos,Receita");
    weekdayStats.forEach((w) => lines.push(`${WEEKDAYS[w.dow]},${w.pedidos},${formatCurrency(w.receita)}`));
    lines.push("");
    lines.push("CANCELAMENTOS POR MOTIVO");
    lines.push("Motivo,Pedidos,Valor perdido");
    cancelStats.rows.forEach((r) => lines.push(`${r.label},${r.count},${formatCurrency(r.amount)}`));
    lines.push(`Total perdido,,${formatCurrency(cancelStats.totalAmount)}`);
    lines.push("");
    lines.push("FUNIL DA LOJA");
    lines.push("Etapa,Visitantes,Visualizações");
    funnelStages.forEach((s) => lines.push(`${s.label},${s.uniques},${s.views}`));
    lines.push(`Viraram pedido,${pedidos},`);
    lines.push("");
    lines.push("BAIRROS");
    lines.push("Bairro,Pedidos,Receita");
    bairrosStats.forEach((b) => lines.push(`${b.label},${b.count},${formatCurrency(b.revenue)}`));
    lines.push("");
    lines.push("CLIENTES");
    lines.push(`Identificados pelo telefone,${clientesStats.periodIdentified} de ${clientesStats.periodValid} pedidos do período`);
    lines.push(`Novos no período,${clientesStats.novos}`);
    lines.push(`Recorrentes no período,${clientesStats.recorrentes}`);
    clientesStats.recompra.forEach((r) => lines.push(`Recompra ${r.window} dias,${r.active ? r.pct.toFixed(1) : "0"}% (${r.repeat} de ${r.active} clientes)`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${(storeName || "loja").toLowerCase().replace(/\s+/g, "-")}-${startDate}_a_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado!");
  }

  const presets: { key: Preset; label: string }[] = [
    { key: "hoje", label: "Hoje" },
    { key: "ontem", label: "Ontem" },
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
    { key: "mes", label: "Este mês" },
    { key: "mespassado", label: "Mês passado" },
  ];
  const subs: { key: SubTab; label: string; desc: string }[] = [
    { key: "overview", label: "Visão geral", desc: "Resumo do período" },
    { key: "sales", label: "Vendas", desc: "Receita e pedidos por dia" },
    { key: "products", label: "Produtos", desc: "Mais vendidos e parados" },
    { key: "hours", label: "Horários", desc: "Picos e mapa de calor" },
    { key: "bairros", label: "Bairros", desc: "De onde vêm os pedidos" },
    { key: "clientes", label: "Clientes", desc: "Novos, recorrentes e sumidos" },
    { key: "funil", label: "Funil", desc: "Das visitas até a compra" },
    { key: "extrato", label: "Extrato de pedidos", desc: "Pedido a pedido, com impressão" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-bold text-foreground">Relatórios Detalhados</h3>
        <div className="flex items-center gap-2">
        <button
          onClick={exportCSV}
          disabled={!data || isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
        </div>
      </div>

      {/* Preset chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <CalIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            aria-pressed={preset === p.key}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              preset === p.key
                ? "bg-primary text-primary-foreground shadow shadow-primary/20"
                : "bg-card text-muted-foreground border border-border/60 hover:bg-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setPreset("custom")}
          aria-pressed={preset === "custom"}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
            preset === "custom"
              ? "bg-primary text-primary-foreground shadow shadow-primary/20"
              : "bg-card text-muted-foreground border border-border/60 hover:bg-accent"
          }`}
        >
          Personalizado
        </button>
      </div>

      {/* Custom date range */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-muted-foreground font-semibold">De</label>
        <input
          type="date"
          value={startDate}
          max={endDate}
          onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }}
          className="px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold"
        />
        <label className="text-xs text-muted-foreground font-semibold">até</label>
        <input
          type="date"
          value={endDate}
          min={startDate}
          max={today}
          onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }}
          className="px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold"
        />
        <button
          onClick={() => { const t = today; setStartDate(t); setEndDate(t); setPreset("hoje"); }}
          className="text-xs text-primary font-bold underline underline-offset-2"
        >
          Hoje
        </button>
      </div>

      {/* Sub-navegação em cartões (Fase 4 Reorg): grid 2×4 em vez de pastilhas */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {subs.map((s) => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            aria-pressed={sub === s.key}
            className={`rounded-2xl border p-3 text-left transition-all ${
              sub === s.key ? "border-primary bg-primary/10 ring-1 ring-primary/50" : "border-border bg-card hover:bg-accent"
            }`}
          >
            <span className={`block text-sm font-bold ${sub === s.key ? "text-primary" : "text-foreground"}`}>{s.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{s.desc}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Período: <strong>{fmtPtBR(startDate)}</strong> a <strong>{fmtPtBR(endDate)}</strong>
        {isFetching && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
      </p>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-xs">
          Erro ao carregar relatório. <button onClick={() => refetch()} className="underline font-bold">Tentar novamente</button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && pedidos === 0 && !error && sub !== "funil" && sub !== "extrato" && sub !== "clientes" && (
        <div className="p-8 rounded-2xl bg-card/60 border border-border/40 text-center">
          <p className="text-sm font-bold text-foreground">Nenhuma venda no período</p>
          <p className="text-xs text-muted-foreground mt-1">Selecione outra data para ver os resultados.</p>
        </div>
      )}

      {!isLoading && pedidos > 0 && (
        <>
          {(sub === "overview" || sub === "sales") && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Receita Total", value: formatCurrency(receita), g: gRev, color: "emerald" },
                { label: "Pedidos", value: String(pedidos), g: gOrd, color: "blue" },
                { label: "Ticket Médio", value: formatCurrency(ticket), g: gTk, color: "purple" },
                { label: "Taxa Cancelamento", value: `${cancelRate.toFixed(1)}%`, g: null as number | null, color: cancelRate > 5 ? "red" : "emerald" },
              ].map((k) => (
                <div key={k.label} className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br from-${k.color}-500/5 to-transparent`} />
                  <div className="relative">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{k.label}</p>
                    <p className={`text-2xl font-black tracking-tight mt-1 text-${k.color}-500`}>{k.value}</p>
                    {k.g !== null && (
                      <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${k.g >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {k.g >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {k.g >= 0 ? "+" : ""}{k.g.toFixed(1)}% vs período anterior
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {sub === "overview" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card/60 rounded-2xl p-4 border border-border/30">
                <p className="text-xs text-muted-foreground font-semibold uppercase">🔥 Horário de Pico</p>
                <p className="text-lg font-black text-foreground mt-1">{pico?.hora != null ? `${String(pico.hora).padStart(2, "0")}:00` : "—"}</p>
                <p className="text-xs text-muted-foreground">{pico?.pedidos ? `${pico.pedidos} pedidos` : "Sem dados"}</p>
              </div>
              <div className="bg-card/60 rounded-2xl p-4 border border-border/30">
                <p className="text-xs text-muted-foreground font-semibold uppercase">📅 Melhor Dia</p>
                <p className="text-lg font-black text-foreground mt-1">{melhor?.dow != null ? WEEKDAYS[melhor.dow] : "—"}</p>
                <p className="text-xs text-muted-foreground">{melhor?.receita ? formatCurrency(Number(melhor.receita)) : "Sem dados"}</p>
              </div>
            </div>
          )}

          {(sub === "overview" || sub === "sales") && origem.length > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-3">🚦 Origem dos Pedidos</p>
              <div className="space-y-2">
                {origem.map((o) => {
                  const pct = pedidos > 0 ? (o.pedidos / pedidos) * 100 : 0;
                  return (
                    <div key={o.origem} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-foreground w-20">{SOURCE_LABELS[o.origem] || o.origem}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-14 text-right">{o.pedidos}x</span>
                      <span className="text-xs font-bold text-emerald-500 w-24 text-right">{formatCurrency(Number(o.receita))}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(sub === "overview" || sub === "sales") && dailyChart.length > 1 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-4">📈 Evolução Diária</p>
              <div className="h-48">
                <Suspense fallback={null}>
                  <DailyRevenueChart data={dailyChart} />
                </Suspense>
              </div>
            </div>
          )}

          {sub === "hours" && heatmap.max > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-3">🌡️ Mapa de calor — pedidos por dia × hora</p>
              <div className="overflow-x-auto pb-1 -mx-1 px-1">
                <div className="min-w-[540px]">
                  <div className="grid gap-[3px]" style={{ gridTemplateColumns: "2rem repeat(24, minmax(0, 1fr))" }}>
                    <span />
                    {Array.from({ length: 24 }, (_, h) => (
                      <span key={h} className="text-xs text-muted-foreground text-center">
                        {h % 3 === 0 ? h : ""}
                      </span>
                    ))}
                    {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
                      <Fragment key={dow}>
                        <span className="text-xs font-semibold text-muted-foreground text-right pr-1 self-center">
                          {WEEKDAYS[dow]}
                        </span>
                        {heatmap.grid[dow].map((n, h) => (
                          <span
                            key={h}
                            title={`${WEEKDAYS[dow]} ${String(h).padStart(2, "0")}h: ${n} pedidos`}
                            className={`h-3.5 rounded-[3px] ${n === 0 ? "bg-muted" : ""}`}
                            style={
                              n > 0
                                ? { backgroundColor: `rgba(255, 106, 0, ${(0.14 + 0.86 * (n / heatmap.max)).toFixed(2)})` }
                                : undefined
                            }
                          />
                        ))}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
              {heatmap.peak.dow >= 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  📌 <strong className="text-foreground">
                    Seu pico é {WEEKDAYS_FULL[heatmap.peak.dow]} às {String(heatmap.peak.hour).padStart(2, "0")}h ({heatmap.peak.count} pedidos).
                  </strong>
                  {heatBestDay && heatPeakHour
                    ? ` Na semana, o dia mais forte é ${WEEKDAYS_FULL[heatBestDay.dow]} e a hora mais forte é ${String(heatPeakHour.hora).padStart(2, "0")}h.`
                    : ""}
                </p>
              )}
            </div>
          )}

          {(sub === "overview" || sub === "hours") && hourlyChart.length > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-4">🕐 Pedidos por Horário</p>
              <div className="h-36">
                <Suspense fallback={null}>
                  <HourlyBarChart data={hourlyChart} />
                </Suspense>
              </div>
            </div>
          )}

          {(sub === "overview" || sub === "hours") && weekdayMaxReceita > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-3">📅 Dias da Semana</p>
              <div className="space-y-2">
                {weekdayStats.map((w) => {
                  const pct = weekdayMaxReceita > 0 ? (w.receita / weekdayMaxReceita) * 100 : 0;
                  const isBest = w.receita === weekdayMaxReceita && w.receita > 0;
                  return (
                    <div key={w.dow} className="flex items-center gap-3">
                      <span className={`text-xs font-bold w-10 ${isBest ? "text-primary" : "text-foreground"}`}>{w.label}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right">{w.pedidos}x</span>
                      <span className="text-xs font-bold text-foreground w-24 text-right">{formatCurrency(w.receita)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">A semana inteira do período — o dia em destaque é o que mais vende.</p>
            </div>
          )}

          {(sub === "overview" || sub === "sales") && cancelStats.total > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-3">❌ Cancelamentos por Motivo ({cancelStats.total})</p>
              <div className="mb-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Perdido com cancelamentos</p>
                <p className="text-xl font-black text-destructive">
                  {formatCurrency(cancelStats.totalAmount)}{" "}
                  <span className="text-xs font-bold text-muted-foreground">em {cancelStats.total} pedidos</span>
                </p>
              </div>
              <div className="space-y-2">
                {cancelStats.rows.map((r) => {
                  const pct = cancelStats.totalAmount > 0 ? (r.amount / cancelStats.totalAmount) * 100 : 0;
                  return (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-foreground flex-1 min-w-0 truncate" title={r.label}>{r.label}</span>
                      <div className="w-28 h-2 bg-muted rounded-full overflow-hidden shrink-0">
                        <div className="h-full bg-destructive rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-28 text-right shrink-0">{formatCurrency(r.amount)} · {r.count}x</span>
                    </div>
                  );
                })}
              </div>
              {noReasonShare >= 0.3 ? (
                <p className="text-xs text-muted-foreground mt-3">
                  📌 <strong className="text-foreground">{Math.round(noReasonShare * 100)}% dos cancelamentos não têm motivo registrado</strong> — sem o motivo, não dá pra corrigir a causa.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-3">Por que os pedidos do período foram cancelados — é aqui que aparece o vazamento pra corrigir.</p>
              )}
            </div>
          )}

          {(sub === "overview" || sub === "sales") && paymentPie.length > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-4">💳 Métodos de Pagamento</p>
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 shrink-0">
                  <Suspense fallback={null}>
                    <PaymentPieChart data={paymentPie} colors={PIE_COLORS} />
                  </Suspense>
                </div>
                <div className="flex-1 space-y-2">
                  {paymentPie.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{p.name}</span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.value}x</span>
                      </div>
                      <span className="font-bold text-foreground">{formatCurrency(p.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {sub === "products" && produtos.length > 0 && (
            <div className="bg-card/60 rounded-2xl p-4 border border-border/30">
              <p className="text-xs font-bold text-foreground">
                Curva ABC: <span className="text-primary">A = {abc.counts.A} produtos · {abc.total > 0 ? ((abc.rev.A / abc.total) * 100).toFixed(0) : 0}% da receita</span>
                {" · "}B = {abc.counts.B} · C = {abc.counts.C}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Poucos produtos pagam a conta: a classe A concentra a receita de itens do período. A etiqueta A/B/C aparece em cada produto da lista abaixo.</p>
            </div>
          )}

          {(sub === "overview" || sub === "products") && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-foreground">🏆 Produtos Vendidos ({produtos.length})</p>
                <p className="text-xs text-muted-foreground">Ordenado por quantidade</p>
              </div>
              {produtos.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sem produtos vendidos no período</p>
              ) : (
                <div className="space-y-2.5">
                  {produtos.map((p, i) => {
                    const pct = totalProdReceita > 0 ? (Number(p.receita) / totalProdReceita) * 100 : 0;
                    return (
                      <div key={(p.product_id || "") + p.nome + i} className="flex items-center gap-3">
                        <span className={`text-xs font-black w-6 text-center ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                          {i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}.`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-1 gap-2">
                            <span className="font-bold text-foreground truncate">{p.nome}</span>
                            {(() => {
                              const cls = abc.byKey.get((p.product_id || "") + p.nome);
                              if (!cls) return null;
                              const clsStyle = cls === "A" ? "bg-primary text-primary-foreground" : cls === "B" ? "bg-foreground text-background" : "bg-muted text-muted-foreground";
                              return <span className={`text-xs font-black px-1.5 py-0.5 rounded-full shrink-0 ${clsStyle}`}>{cls}</span>;
                            })()}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-muted-foreground">{p.quantidade}x</span>
                              <span className="font-bold text-emerald-500">{formatCurrency(Number(p.receita))}</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {pct.toFixed(1)}% da receita · ticket médio {formatCurrency(Number(p.ticket_medio))}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {sub === "products" && neverSold.length > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-2">💤 Sem Vendas no Período ({neverSold.length})</p>
              <p className="text-xs text-muted-foreground mb-3">Produtos ativos do cardápio que não venderam nenhuma unidade no período — candidatos a sair do cardápio, virar combo ou ganhar destaque.</p>
              <div className="flex flex-wrap gap-1.5">
                {neverSold.map((p: any) => (
                  <span key={p.id} className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-1 rounded-full">{p.name}</span>
                ))}
              </div>
            </div>
          )}
          {sub === "bairros" && (
            <div className="space-y-4">
              <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
                <p className="text-xs font-bold text-foreground mb-1">📍 De onde vêm seus pedidos</p>
                <p className="text-xs text-muted-foreground mb-4">Pedidos válidos do período por bairro — grafias parecidas foram juntadas, e balcão e retirada ficam separados.</p>
                {bairrosStats.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum pedido válido no período.</p>
                ) : (
                  <div className="space-y-2.5">
                    {bairrosStats.map((b) => (
                      <div key={b.label}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-bold text-foreground">{b.label}</span>
                          <span className="text-xs text-muted-foreground"><strong className="text-foreground text-sm">{b.count}</strong> pedidos · {formatCurrency(b.revenue)}</span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(b.count / bairrosMax) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
                <p className="text-xs font-bold text-foreground mb-1">🗺️ Mapa de calor dos pedidos</p>
                <p className="text-xs text-muted-foreground mb-3">Onde os pedidos do período foram entregues — quanto mais pedidos no mesmo lugar, mais forte o laranja. O ponto escuro é a sua loja.</p>
                {mapData.points.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum pedido do período tem coordenada de entrega. O mapa acende conforme os endereços são resolvidos no checkout.</p>
                ) : (
                  <>
                    <svg viewBox="0 0 300 210" className="w-full rounded-xl bg-muted/50 border border-border/40">
                      {mapData.points.map((pt, i) => (
                        <g key={i}>
                          <circle cx={pt.x} cy={pt.y} r={10 + Math.min(14, pt.n * 3)} fill="#FF6A00" opacity={0.16} />
                          <circle cx={pt.x} cy={pt.y} r={3.5} fill="#FF6A00" opacity={0.65} />
                        </g>
                      ))}
                      {mapData.store && (
                        <circle cx={mapData.store.x} cy={mapData.store.y} r={7} fill="#1c1c1e" stroke="#fff" strokeWidth={2.5} />
                      )}
                    </svg>
                    <p className="text-xs text-muted-foreground mt-2">{mapData.withCoords} de {mapData.total} pedidos do período têm coordenadas ({mapData.total ? Math.round((mapData.withCoords / mapData.total) * 100) : 0}%) — o mapa acende nos pedidos válidos. O ranking por bairro, acima, vale pra todos os pedidos.</p>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {sub === "funil" && !isLoading && (
        <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
          <p className="text-xs font-bold text-foreground mb-1">🧭 Funil da Loja</p>
          <p className="text-xs text-muted-foreground mb-4">Do clique na vitrine ao checkout, no período selecionado. Visitantes = pessoas diferentes; visualizações = total de aberturas.</p>
          <div className="space-y-3">
            {funnelStages.map((st) => {
              const pct = (st.uniques / funnelTop) * 100;
              return (
                <div key={st.page}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">{st.label}</span>
                    <span className="text-xs text-muted-foreground"><strong className="text-foreground text-sm">{st.uniques}</strong> visitantes · {st.views} visualizações · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold text-foreground">Viraram pedido</span>
                <span className="text-xs text-muted-foreground"><strong className="text-foreground text-sm">{pedidos}</strong> pedidos no período</span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (pedidos / funnelTop) * 100)}%` }} />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">As etapas "viram um produto" e "abriram o carrinho" começaram a ser medidas agora — antes, só visita e checkout eram registrados. Os números dessas duas etapas crescem a partir de hoje.</p>
        </div>
      )}

      {sub === "extrato" && (
        <OrdersStatement storeId={storeId} storeName={storeName || "Loja"} />
      )}

      {sub === "clientes" && !isLoading && (
        <div className="space-y-4">
          <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
            <p className="text-xs font-bold text-foreground mb-1">👥 Clientes do período</p>
            <p className="text-xs text-muted-foreground mb-4">A ligação é pelo telefone — é o que amarra pedido logado, pedido guest e WhatsApp. Cobertura: {clientesStats.periodIdentified} de {clientesStats.periodValid} pedidos válidos do período têm cliente identificado ({clientesStats.coveragePct.toFixed(0)}%).</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs font-bold text-muted-foreground">NOVOS NO PERÍODO</p>
                <p className="text-xl font-black text-foreground">{clientesStats.novos}</p>
                <p className="text-xs text-muted-foreground">fizeram a primeira compra na loja</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs font-bold text-muted-foreground">RECORRENTES</p>
                <p className="text-xl font-black text-foreground">{clientesStats.recorrentes}</p>
                <p className="text-xs text-muted-foreground">já compravam e voltaram no período</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              {clientesStats.recompra.map((r) => (
                <div key={r.window} className="rounded-xl bg-muted/60 p-3 text-center">
                  <p className="text-xs font-bold text-muted-foreground">RECOMPRA {r.window}D</p>
                  <p className="text-lg font-black text-foreground">{r.active ? `${r.pct.toFixed(0)}%` : "—"}</p>
                  <p className="text-xs text-muted-foreground">{r.repeat} de {r.active} clientes</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Recompra = clientes que compraram 2 ou mais vezes dentro da janela, entre os que compraram nela.</p>
          </div>

          <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
            <p className="text-xs font-bold text-foreground mb-1">💤 Sumidos há 30+ dias ({clientesStats.sumidos.length})</p>
            <p className="text-xs text-muted-foreground mb-4">Quem já comprou e não pede há mais de 30 dias, contando até o fim do período selecionado. O botão abre o WhatsApp com a mensagem pronta — quem envia é você.</p>
            {clientesStats.sumidos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ninguém sumido por enquanto. 🎉</p>
            ) : (
              <div className="space-y-2">
                {clientesStats.sumidos.map((c) => (
                  <div key={c.phone} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{c.name || "Cliente"}</p>
                      <p className="text-xs text-muted-foreground">Último pedido {fmtPtBR(c.last)} · há {c.daysAgo} dias · {c.totalOrders} pedidos · {formatCurrency(c.totalSpent)}</p>
                    </div>
                    <button
                      onClick={() => handleRecall(c)}
                      className="shrink-0 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
                    >
                      Chamar de volta
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}