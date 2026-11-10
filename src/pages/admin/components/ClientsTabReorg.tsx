// Fase 4 da reorganização do painel (2026-11-08) — cópia Reorg, SOMENTE /admin-teste.
import { memo, useMemo, useState } from "react";
import {
  Users, Heart, UserX, MapPinned, Search, AlertTriangle, ChevronUp, ChevronDown, Star,
  Sparkles, Repeat, Crown, Clock, TrendingUp, Calendar, Download, ArrowUpDown,
  MessageCircle, X, Send, CheckCircle2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { openWhatsApp } from "@/lib/whatsapp";
import { formatBRL } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import EmptyState from "@/components/EmptyState";
import TutorialHelpButton from "@/components/TutorialHelp";
import { statusColors } from "../constants";

export type ClientFilter =
  | "all" | "new" | "weekly" | "vip" | "atrisk"
  | "inactive30" | "inactive45" | "inactive60" | "highticket" | "location";
export type ClientSort = "orders" | "spent" | "recent" | "inactive";

const SEGMENT_BADGE: Record<string, { label: string; cls: string }> = {
  vip:      { label: "VIP",       cls: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  weekly:   { label: "Semanal",   cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  new:      { label: "Novo",      cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  atrisk:   { label: "Em risco",  cls: "bg-primary/15 text-primary dark:text-primary" },
  inactive: { label: "Inativo",   cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  active:   { label: "Ativo",     cls: "bg-muted text-muted-foreground" },
};

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", credito: "Crédito", debito: "Débito",
  cartao: "Cartão", vr: "VR", va: "VA",
};

const buildCampaignMessage = (client: any, storeName: string): string => {
  const first = (client.name || "").split(" ")[0] || "amigo(a)";
  switch (client.segment) {
    case "inactive":
      return `Oi ${first}! Sentimos sua falta no ${storeName} 😢 Que tal voltar com 15% OFF no seu próximo pedido? 🎁`;
    case "atrisk":
      return `Oi ${first}! Faz um tempo que você não pede no ${storeName}. Preparamos algo especial pra você hoje! 🍔`;
    case "vip":
    case "weekly":
      return `Oi ${first}! Obrigado por ser cliente fiel do ${storeName} 💛 Tem um brinde te esperando no próximo pedido!`;
    case "new":
      return `Oi ${first}! Que bom te ter como cliente do ${storeName} 🎉 Tem novidades no cardápio, dá uma olhada!`;
    default:
      return `Oi ${first}! Novidades no ${storeName} 🍔 Dá uma olhada no cardápio!`;
  }
};

const exportClientsCSV = (clients: any[], storeName: string) => {
  const header = ["Nome", "Telefone", "Bairro", "Pedidos", "Total Gasto", "Ticket Médio", "Último pedido (dias)", "Segmento"];
  const rows = clients.map(c => [
    c.name, c.phone || "", c.neighborhood || "", c.totalOrders,
    c.totalSpent.toFixed(2).replace(".", ","),
    c.ticketMedio.toFixed(2).replace(".", ","),
    c.daysSinceLastOrder,
    SEGMENT_BADGE[c.segment]?.label || c.segment,
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clientes-${storeName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

interface ClientsTabProps {
  clientFilter: ClientFilter;
  setClientFilter: (f: ClientFilter) => void;
  clientSearch: string;
  setClientSearch: (s: string) => void;
  filteredClients: any[];
  expandedClient: string | null;
  setExpandedClient: (id: string | null) => void;
  storeName?: string;
  storeId?: string;
  storeSlug?: string;
  clientCounts?: {
    total: number; new: number; weekly: number; vip: number;
    atrisk: number; inactive30: number; inactive45: number; inactive60: number; highticket: number;
  };
  clientSort?: ClientSort;
  setClientSort?: (s: ClientSort) => void;
}

const ClientsTabReorgImpl = ({
  clientFilter, setClientFilter, clientSearch, setClientSearch,
  filteredClients, expandedClient, setExpandedClient, storeName,
  storeId, storeSlug,
  clientCounts, clientSort = "orders", setClientSort,
}: ClientsTabProps) => {
  const counts = clientCounts || { total: 0, new: 0, weekly: 0, vip: 0, atrisk: 0, inactive30: 0, inactive45: 0, inactive60: 0, highticket: 0 };
  const totalInactive = counts.inactive30 + counts.inactive45 + counts.inactive60;

  // ── Chamar de volta (Fase 1): registro de cliques + retorno em 14 dias ──
  const DAY_MS = 24 * 60 * 60 * 1000;
  const queryClient = useQueryClient();
  const [recallClient, setRecallClient] = useState<any | null>(null);
  const [recallCoupon, setRecallCoupon] = useState<string>("");
  const [recallMessage, setRecallMessage] = useState("");
  const [recallSending, setRecallSending] = useState(false);
  const [creatingVolta, setCreatingVolta] = useState(false);
  const [showCalled, setShowCalled] = useState(false);

  const { data: recallLogs } = useQuery({
    queryKey: ["client-recall-logs", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_recall_logs" as any)
        .select("*")
        .eq("store_id", storeId)
        .order("clicked_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: storeCoupons } = useQuery({
    queryKey: ["coupons", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons" as any)
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["client-recall-orders", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const since = new Date(Date.now() - 45 * DAY_MS).toISOString();
      const { data, error } = await supabase
        .from("orders" as any)
        .select("id, client_id, total_price, status, created_at")
        .eq("store_id", storeId)
        .gte("created_at", since)
        .neq("status", "cancelado")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const activeCoupons = useMemo(
    () =>
      (storeCoupons || []).filter(
        (c: any) =>
          c.is_active &&
          (!c.expires_at || new Date(c.expires_at).getTime() > Date.now()) &&
          (c.max_uses == null || (c.used_count || 0) < c.max_uses)
      ),
    [storeCoupons]
  );

  const lastRecallByClient = useMemo(() => {
    const m = new Map<string, any>();
    (recallLogs || []).forEach((l: any) => {
      if (!m.has(l.client_id)) m.set(l.client_id, l);
    });
    return m;
  }, [recallLogs]);

  const calledDaysAgo = (clientId: string): number | null => {
    const l = lastRecallByClient.get(clientId);
    if (!l) return null;
    return Math.floor((Date.now() - new Date(l.clicked_at).getTime()) / DAY_MS);
  };

  const isRecentlyCalled = (clientId: string) => {
    const d = calledDaysAgo(clientId);
    return d !== null && d < 30;
  };

  const recallStats = useMemo(() => {
    const logs30 = (recallLogs || []).filter(
      (l: any) => Date.now() - new Date(l.clicked_at).getTime() < 30 * DAY_MS
    );
    const firstCall = new Map<string, number>();
    logs30.forEach((l: any) => {
      const t = new Date(l.clicked_at).getTime();
      const prev = firstCall.get(l.client_id);
      if (prev === undefined || t < prev) firstCall.set(l.client_id, t);
    });
    let returned = 0;
    let revenue = 0;
    firstCall.forEach((t0, cid) => {
      const back = (recentOrders || []).find((o: any) => {
        if (o.client_id !== cid) return false;
        const t = new Date(o.created_at).getTime();
        return t > t0 && t <= t0 + 14 * DAY_MS;
      });
      if (back) {
        returned++;
        revenue += Number(back.total_price) || 0;
      }
    });
    return { called: firstCall.size, returned, revenue };
  }, [recallLogs, recentOrders]);

  const isRecallFilter =
    clientFilter === "atrisk" || clientFilter === "inactive30" ||
    clientFilter === "inactive45" || clientFilter === "inactive60";

  const visibleClients = useMemo(() => {
    if (!isRecallFilter || showCalled) return filteredClients;
    return filteredClients.filter((c: any) => !isRecentlyCalled(c.clientId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredClients, isRecallFilter, showCalled, lastRecallByClient]);
  const hiddenCalledCount = filteredClients.length - visibleClients.length;

  const buildRecallMessage = (client: any, coupon: any): string => {
    const first = (client.name || "").split(" ")[0] || "tudo bem";
    const link = storeSlug ? `https://itasuper.com.br/loja/${storeSlug}` : "https://itasuper.com.br";
    if (coupon) {
      const benefit =
        coupon.discount_type === "percentage"
          ? `${Number(coupon.discount_value)}% de desconto`
          : coupon.discount_type === "fixed"
            ? `${formatBRL(Number(coupon.discount_value))} de desconto`
            : "frete grátis";
      const min = Number(coupon.min_order_value) > 0 ? ` em pedidos acima de ${formatBRL(Number(coupon.min_order_value))}` : "";
      return `Oi ${first}! Aqui é da ${storeName || "loja"} 😊 Sentimos sua falta! Preparamos um presente pra você voltar: o cupom ${coupon.code} dá ${benefit} no seu próximo pedido${min}. É só pedir pelo nosso cardápio: ${link} — esperamos você!`;
    }
    return `Oi ${first}! Aqui é da ${storeName || "loja"} 😊 Sentimos sua falta! Dá uma olhada no cardápio e faz seu pedido por aqui: ${link} — esperamos você!`;
  };

  const openRecall = (client: any) => {
    const def = activeCoupons.find((c: any) => c.code === "VOLTA10") || activeCoupons[0] || null;
    setRecallClient(client);
    setRecallCoupon(def ? def.code : "");
    setRecallMessage(buildRecallMessage(client, def));
  };

  const onRecallCouponChange = (code: string) => {
    setRecallCoupon(code);
    if (!recallClient) return;
    const coupon = activeCoupons.find((c: any) => c.code === code) || null;
    setRecallMessage(buildRecallMessage(recallClient, coupon));
  };

  const createVoltaCoupon = async () => {
    if (!storeId) return;
    setCreatingVolta(true);
    try {
      const { error } = await supabase.from("coupons" as any).insert({
        code: "VOLTA10",
        description: "R$ 10 de desconto pra quem voltou, em pedidos acima de R$ 30",
        discount_type: "fixed",
        discount_value: 10,
        min_order_value: 30,
        max_uses: null,
        first_order_only: false,
        expires_at: new Date(Date.now() + 30 * DAY_MS).toISOString(),
        is_active: true,
        store_id: storeId,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["coupons", storeId] });
      setRecallCoupon("VOLTA10");
      if (recallClient) {
        setRecallMessage(
          buildRecallMessage(recallClient, { code: "VOLTA10", discount_type: "fixed", discount_value: 10, min_order_value: 30 })
        );
      }
      toast.success("Cupom VOLTA10 criado e ativo por 30 dias!");
    } catch {
      toast.error("Não consegui criar o cupom. Tente pela aba Cupons.");
    } finally {
      setCreatingVolta(false);
    }
  };

  const confirmRecall = async () => {
    if (!recallClient || !storeId) return;
    setRecallSending(true);
    try {
      const { error } = await supabase.from("client_recall_logs" as any).insert({
        store_id: storeId,
        client_id: recallClient.clientId,
        client_phone: String(recallClient.phone || "").replace(/\D/g, ""),
        segment: recallClient.segment,
        coupon_code: recallCoupon || null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["client-recall-logs", storeId] });
      openWhatsApp(recallClient.phone, recallMessage);
      setRecallClient(null);
      toast.success("Boa! Agora é só apertar enviar na conversa que abriu.");
    } catch {
      toast.error("Não consegui registrar a chamada. Tente de novo.");
    } finally {
      setRecallSending(false);
    }
  };

  // Fase 4 Reorg: só Em risco e Inativos viram cartões de destaque — os demais
  // segmentos vivem só nos chips abaixo (antes cards e chips se repetiam).
  const metricCards = [
    { key: "atrisk" as ClientFilter,  label: "Em risco",    value: counts.atrisk,   icon: Clock,    cls: "from-primary/15 to-primary/5 text-primary" },
    { key: "inactive30" as ClientFilter, label: "Inativos", value: totalInactive,   icon: UserX,    cls: "from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400" },
  ];

  const chips: { key: ClientFilter; label: string; icon: any; count?: number }[] = [
    { key: "all",        label: "Todos",         icon: Users,    count: counts.total },
    { key: "vip",        label: "VIP",           icon: Crown,    count: counts.vip },
    { key: "weekly",     label: "Semanais",      icon: Repeat,   count: counts.weekly },
    { key: "new",        label: "Novos 30d",     icon: Sparkles, count: counts.new },
    { key: "atrisk",     label: "Em risco 15-30d", icon: Clock,  count: counts.atrisk },
    { key: "inactive30", label: "Inativos 30d",  icon: UserX,    count: counts.inactive30 },
    { key: "inactive45", label: "Inativos 45d",  icon: UserX,    count: counts.inactive45 },
    { key: "inactive60", label: "Inativos 60d+", icon: UserX,    count: counts.inactive60 },
    { key: "highticket", label: "Alto ticket",   icon: TrendingUp, count: counts.highticket },
    { key: "location",   label: "Por bairro",    icon: MapPinned },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-3">
      {/* Ajuda desta tela (Fase 2 dos tutoriais, 2026-11-10) */}
      <div className="flex justify-end">
        <TutorialHelpButton tutorialId="clients" />
      </div>
      {/* Cartões de destaque (Fase 4 Reorg): só Em risco e Inativos */}
      <div className="grid grid-cols-2 gap-2">
        {metricCards.map(m => (
          <button key={m.key} onClick={() => setClientFilter(m.key)}
            className={`bg-gradient-to-br ${m.cls} border border-border rounded-2xl p-3 text-left transition-all hover:shadow-md ${
              clientFilter === m.key ? "ring-2 ring-primary/60" : ""
            }`}>
            <div className="flex items-center justify-between mb-1">
              <m.icon className="h-4 w-4" />
              <span className="text-xs font-bold uppercase opacity-70">{m.label}</span>
            </div>
            <p className="text-2xl font-black text-foreground">{m.value}</p>
          </button>
        ))}
      </div>

      {/* Chips de segmento */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {chips.map(f => (
          <button key={f.key} onClick={() => setClientFilter(f.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              clientFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}>
            <f.icon className="h-3.5 w-3.5" /> {f.label}
            {typeof f.count === "number" && (
              <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${
                clientFilter === f.key ? "bg-primary-foreground/20" : "bg-muted"
              }`}>{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Busca + ordenação + export */}
      <div className="flex gap-2 items-stretch">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)}
            placeholder="Buscar nome, bairro, telefone..."
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        {setClientSort && (
          <div className="relative">
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <select value={clientSort} onChange={e => setClientSort(e.target.value as ClientSort)}
              className="appearance-none pl-8 pr-7 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="orders">Mais pedidos</option>
              <option value="spent">Maior gasto</option>
              <option value="recent">Mais recente</option>
              <option value="inactive">Mais inativo</option>
            </select>
          </div>
        )}
        <button onClick={() => exportClientsCSV(filteredClients, storeName || "loja")}
          disabled={filteredClients.length === 0}
          title="Exportar CSV"
          className="px-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-accent/40 disabled:opacity-40 disabled:cursor-not-allowed">
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>

      {(clientFilter === "inactive30" || clientFilter === "inactive45" || clientFilter === "inactive60") && filteredClients.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-xs text-primary dark:text-primary">
            <span className="font-bold">{filteredClients.length} clientes</span> sem pedidos —
            envie uma campanha de reativação com cupom no WhatsApp.
          </p>
        </div>
      )}

      {isRecallFilter && storeId && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
          <p className="text-xs font-bold text-foreground">Chamados de volta</p>
          {recallStats.called === 0 ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              Ninguém foi chamado ainda. Quando você chamar, aqui aparece quantos voltaram a pedir e quanto venderam.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Chamados: <b className="text-foreground">{recallStats.called}</b> · Voltaram:{" "}
              <b className="text-foreground">{recallStats.returned}</b> · Vendas de retorno:{" "}
              <b className="text-foreground">{formatCurrency(recallStats.revenue)}</b>{" "}
              <span className="opacity-70">(primeiro pedido em até 14 dias depois da chamada)</span>
            </p>
          )}
          {hiddenCalledCount > 0 && (
            <button
              onClick={() => setShowCalled(!showCalled)}
              className="text-xs font-bold text-primary mt-1.5 underline underline-offset-2"
            >
              {showCalled
                ? "Ocultar quem já foi chamado"
                : `${hiddenCalledCount} já chamado(s) nos últimos 30 dias — mostrar`}
            </button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {visibleClients.length === 0 ? (
          clientFilter === "all" && !clientSearch.trim() ? (
            <EmptyState
              icon={<Users className="h-10 w-10" />}
              title="Nenhum cliente ainda"
              description="Seus clientes aparecem aqui sozinhos, a partir do primeiro pedido de cada um. Com o tempo, esta tela mostra quem compra sempre e quem está sumindo — e você chama de volta quem esfriou. Compartilhe o link do seu cardápio pra trazer o primeiro."
            />
          ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-bold">
              {hiddenCalledCount > 0 ? "Todos deste segmento já foram chamados nos últimos 30 dias" :
               clientFilter === "atrisk" ? "Nenhum cliente em risco — bom trabalho!" :
               clientFilter === "inactive30" || clientFilter === "inactive45" || clientFilter === "inactive60" ? "Nenhum cliente inativo neste período" :
               "Nenhum cliente encontrado"}
            </p>
          </div>
          )
        ) : visibleClients.map(client => (
          <div key={client.clientId} className="bg-card border border-border rounded-2xl overflow-hidden">
            <button onClick={() => setExpandedClient(expandedClient === client.clientId ? null : client.clientId)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{client.name}</p>
                    <span className="bg-primary/10 text-primary text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">{client.totalOrders}</span>
                    {(() => {
                      const b = SEGMENT_BADGE[client.segment] || SEGMENT_BADGE.active;
                      return (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${b.cls}`}>
                          {b.label}
                        </span>
                      );
                    })()}
                    {client.isHighTicket && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        Alto ticket
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{client.daysSinceLastOrder === 0 ? "Hoje" : `${client.daysSinceLastOrder}d atrás`}</span>
                    <span>•</span>
                    <span>{client.neighborhood || "—"}</span>
                    {client.ordersLast30 > 0 && (
                      <>
                        <span>•</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{client.ordersLast30}/30d</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expandedClient === client.clientId ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {(client.segment === "atrisk" || client.segment === "inactive") && client.phone && storeId && isRecentlyCalled(client.clientId) && (
              <div className="px-3 pb-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  Chamado há {calledDaysAgo(client.clientId)} dia(s) — volta pra fila depois de 30 dias. Pra chamar de novo agora, abra o cliente e use o menu Ações.
                </p>
              </div>
            )}

            {expandedClient === client.clientId && (
              <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                    <p className="text-sm font-black text-foreground">{formatCurrency(client.totalSpent)}</p>
                    <p className="text-xs text-muted-foreground">LTV</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                    <p className="text-sm font-black text-foreground">{formatCurrency(client.ticketMedio)}</p>
                    <p className="text-xs text-muted-foreground">Ticket Médio</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                      <p className="text-xs font-black text-foreground truncate">{client.favProduct}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Favorito</p>
                  </div>
                </div>

                {/* Insights extras */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {client.avgFrequencyDays > 0 && (
                    <div className="bg-muted/30 rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">Frequência</p>
                      <p className="font-bold text-foreground">a cada {client.avgFrequencyDays}d</p>
                    </div>
                  )}
                  {client.nextOrderInDays !== null && (
                    <div className="bg-muted/30 rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">Próxima compra</p>
                      <p className={`font-bold ${client.nextOrderInDays < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                        {client.nextOrderInDays < 0 ? `Atrasada ${Math.abs(client.nextOrderInDays)}d` :
                         client.nextOrderInDays === 0 ? "Hoje" : `em ${client.nextOrderInDays}d`}
                      </p>
                    </div>
                  )}
                  {client.preferredPayment && (
                    <div className="bg-muted/30 rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">Pagamento preferido</p>
                      <p className="font-bold text-foreground">{PAYMENT_LABELS[client.preferredPayment] || client.preferredPayment}</p>
                    </div>
                  )}
                  <div className="bg-muted/30 rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">Cliente desde</p>
                    <p className="font-bold text-foreground">{client.daysSinceFirstOrder}d</p>
                  </div>
                  {client.cancelRate > 0 && (
                    <div className="bg-muted/30 rounded-lg px-3 py-2 col-span-2">
                      <p className="text-xs text-muted-foreground">Taxa de cancelamento</p>
                      <p className={`font-bold ${client.cancelRate > 20 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                        {client.cancelRate.toFixed(0)}%
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2">Últimos Pedidos</p>
                  <div className="space-y-1.5">
                    {client.orders.slice(0, 5).map((order: any) => {
                      const sc = statusColors[order.status] || statusColors.pendente;
                      return (
                        <div key={order.id} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${sc.bg} ${sc.text}`}>
                              {sc.label}
                            </span>
                            <span className="text-foreground font-medium">#{order.id.slice(0, 6).toUpperCase()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
                            <span className="font-bold text-foreground">{formatBRL(Number(order.total_price))}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {client.phone && (
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground font-bold rounded-xl px-4 py-2 text-xs min-h-[44px] active:scale-95 transition-transform">
                          Ações <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-60">
                        {(client.segment === "atrisk" || client.segment === "inactive") && storeId ? (
                          <DropdownMenuItem onClick={() => openRecall(client)}>
                            <MessageCircle className="h-4 w-4 mr-2" />
                            {client.segment === "inactive" ? "Reativar c/ cupom" : "Chamar de volta"}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => openWhatsApp(client.phone!, buildCampaignMessage(client, storeName || "nossa loja"))}>
                            <MessageCircle className="h-4 w-4 mr-2" />
                            {client.segment === "inactive" ? "Reativar c/ cupom" :
                             client.segment === "atrisk" ? "Reengajar" :
                             client.segment === "vip" || client.segment === "weekly" ? "Agradecer" :
                             client.segment === "new" ? "Boas-vindas" : "Mensagem"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => openWhatsApp(client.phone!, `Olá ${client.name}! Novidades no ${storeName}! 🍔`)}>
                          <Sparkles className="h-4 w-4 mr-2" /> Promoção
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {recallClient && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setRecallClient(null)}
        >
          <div
            className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3 max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-foreground">
                  Chamar {(recallClient.name || "").split(" ")[0]} de volta
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  A conversa abre no <b>seu</b> WhatsApp (Web no computador ou aplicativo no celular), com a
                  mensagem pronta. Você confere, ajusta se quiser e aperta enviar — a plataforma não envia nada sozinha.
                </p>
              </div>
              <button onClick={() => setRecallClient(null)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Cupom oferecido</label>
              {activeCoupons.length > 0 ? (
                <select
                  value={recallCoupon}
                  onChange={e => onRecallCouponChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {activeCoupons.map((c: any) => (
                    <option key={c.id} value={c.code}>
                      {c.code} —{" "}
                      {c.discount_type === "percentage"
                        ? `${Number(c.discount_value)}% off`
                        : c.discount_type === "fixed"
                          ? `${formatBRL(Number(c.discount_value))} off`
                          : "frete grátis"}
                      {Number(c.min_order_value) > 0 ? ` acima de ${formatBRL(Number(c.min_order_value))}` : ""}
                    </option>
                  ))}
                  <option value="">Sem cupom — só a mensagem</option>
                </select>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Sua loja ainda não tem cupom ativo. Crie o modelo de volta com 1 clique:
                  </p>
                  <button
                    onClick={createVoltaCoupon}
                    disabled={creatingVolta}
                    className="w-full py-2.5 rounded-xl border border-primary/50 text-primary text-xs font-bold disabled:opacity-50"
                  >
                    {creatingVolta ? "Criando..." : "Criar cupom VOLTA10 — R$ 10 acima de R$ 30"}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Mensagem (pode editar)</label>
              <textarea
                value={recallMessage}
                onChange={e => setRecallMessage(e.target.value)}
                rows={6}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setRecallClient(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground"
              >
                Agora não
              </button>
              <button
                onClick={confirmRecall}
                disabled={recallSending || !recallClient.phone}
                className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {recallSending ? "Abrindo..." : "Abrir no WhatsApp"}
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Depois de chamar, o cliente fica marcado como chamado por 30 dias e sai desta fila.{" "}
              <b>Dica de ritmo:</b> chame poucos clientes por dia, espaçado — mensagem de gente de verdade não cai em bloqueio.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const ClientsTabReorg = memo(ClientsTabReorgImpl);
export default ClientsTabReorg;