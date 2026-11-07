import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Bell, Bike, Check, Loader2, Plus, X } from "lucide-react";
import { AdminOrderCardTeste } from "../components/AdminOrderCardTeste";
import type { OrderStatus, OrderTabKey } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import OrdersToolbar, { type PeriodKey, type SourceKey } from "../components/orders/OrdersToolbar";
import { classifyOrderSource, matchesExtraFilters, buildOrdersCsv, openOrdersReport, paymentLabel, EMPTY_EXTRA_FILTERS, type OrdersExtraFilters } from "../components/orders/ordersReport";
import OrdersStatusPillsTeste from "../components/orders/OrdersStatusPillsTeste";
import PixDirectAlert from "../components/orders/PixDirectAlert";
import OrdersEmptyStateTeste from "../components/orders/OrdersEmptyStateTeste";
import OrderCardSkeleton from "../components/orders/OrderCardSkeleton";
import TutorialHelpButton from "@/components/TutorialHelp";
import ManualOrderFlow from "@/components/orders/ManualOrderFlow";

interface Props {
  store: any;
  orders: any[] | undefined;
  historyOrders?: any[];
  isLoading: boolean;
  filteredOrders: any[];
  orderCounters: any;
  orderTabs: any[];
  activeTab: OrderTabKey;
  setActiveTab: (t: OrderTabKey) => void;
  expandedAddresses: Set<string>;
  cancelConfirm: any;
  cancelReason: string;
  setCancelReason: (r: string) => void;
  cancellingOrder?: boolean;
  setCancelConfirm: (v: any) => void;
  isOwnDelivery: boolean;
  hasLinkedDrivers: boolean;
  driversLoading: boolean;
  onlineDrivers: any[];
  linkedStoreDrivers: any[];
  pendingCount: number;
  settlementSearch: string;
  setSettlementSearch: (s: string) => void;
  toggleAddress: (id: string) => void;
  storeName: string | undefined;
  getClientName: (id: string) => string;
  getClientWhatsApp: (id: string) => string;
  getDriverName: (id: string) => string;
  getRequiredAddonHighlights: (o: any) => any;
  getMainAction: (status: any, o: any) => any;
  buildAcceptWhatsAppHref: (o: any) => string;
  buildReadyWhatsAppHref: (o: any) => string;
  evolutionConnected?: boolean;
  updateOrderStatus: (id: string, status: any, assignedDriverId?: string | null) => void;
  /** Erro da query de pedidos (shell) — quando presente, mostra estado de erro, não "vazio". */
  ordersError?: unknown;
  onRetryOrders?: () => void;
  handleAcceptOrder: (o: any) => void;
  handleCancelOrder: (o: any) => void;
  handlePrint: (o: any) => void;
  invalidateOrders: () => void;
}

/**
 * CÓPIA DE TESTE (/admin-teste) de OrdersSection.
 * Idêntica ao original, EXCETO:
 *  a. usa AdminOrderCardTeste / OrdersStatusPillsTeste / OrdersEmptyStateTeste;
 *  b. filtro de origem corrigido: a origem é classificada pela mesma regra do
 *     resumo (só 'pdv' e 'manual' têm balde próprio; todo o resto — NULL,
 *     'balcao' ou qualquer outro valor — conta como delivery). Antes, o
 *     filtro exigia igualdade estrita com 'delivery' e sumia com pedidos
 *     delivery cuja origem não era exatamente 'delivery' (o checkout do
 *     cliente não grava order_source);
 *  c. falha ao carregar mostra erro com "Tentar novamente", nunca "vazio".
 */
// classifyOrderSource vem de components/orders/ordersReport (balde whatsapp incluído).

export default function OrdersSectionTeste(props: Props) {
  const {
    store, orders, historyOrders, isLoading, filteredOrders, orderTabs, activeTab, setActiveTab,
    expandedAddresses, cancelConfirm, setCancelConfirm,
    cancelReason, setCancelReason, cancellingOrder,
    isOwnDelivery, hasLinkedDrivers, driversLoading, onlineDrivers, linkedStoreDrivers,
    pendingCount, settlementSearch, setSettlementSearch, toggleAddress,
    getClientName, getClientWhatsApp, getDriverName, getRequiredAddonHighlights, getMainAction,
    buildAcceptWhatsAppHref, buildReadyWhatsAppHref, updateOrderStatus, handleAcceptOrder,
    handleCancelOrder, handlePrint, invalidateOrders, evolutionConnected,
    ordersError, onRetryOrders,
  } = props;

  const [period, setPeriod] = useState<PeriodKey>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceKey>("all");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [extraFilters, setExtraFilters] = useState<OrdersExtraFilters>(EMPTY_EXTRA_FILTERS);
  const [manualOpen, setManualOpen] = useState(false);

  const pixPending = useMemo(
    () => (orders || []).filter((o: any) => o.status === "comprovante_enviado"),
    [orders]
  );
  const [pixBusyId, setPixBusyId] = useState<string | null>(null);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [pixProofPreview, setPixProofPreview] = useState<{ url: string; order: any } | null>(null);

  // ─── Agrupar pedidos pro motoboy ───
  // Pedidos de entrega (não-retirada) em preparo ou já prontos, ainda sem
  // motoboy a caminho: são os que podem sair juntos numa viagem só.
  const groupEligible = useMemo(
    () =>
      (orders || []).filter(
        (o: any) =>
          isOwnDelivery &&
          hasLinkedDrivers &&
          o.neighborhood !== "RETIRADA" &&
          !o.driver_id &&
          (o.status === "preparando" || o.status === "pronto_para_entrega")
      ),
    [orders, isOwnDelivery, hasLinkedDrivers]
  );
  const [groupSelected, setGroupSelected] = useState<string[]>([]);
  const [groupDriverId, setGroupDriverId] = useState<string>("");
  const [groupConfirmOpen, setGroupConfirmOpen] = useState(false);
  const [groupBusy, setGroupBusy] = useState(false);

  // Seleção só mantém pedidos que continuam elegíveis (status pode mudar
  // por Realtime enquanto a tela está aberta).
  useEffect(() => {
    setGroupSelected((prev) => prev.filter((id) => groupEligible.some((o: any) => o.id === id)));
  }, [groupEligible]);

  // Com um motoboy só vinculado, ele é o destino natural do grupo.
  useEffect(() => {
    if ((linkedStoreDrivers?.length || 0) === 1) setGroupDriverId(linkedStoreDrivers![0].user_id);
  }, [linkedStoreDrivers]);

  const toggleGroupOrder = (id: string) =>
    setGroupSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectedGroupOrders = groupEligible.filter((o: any) => groupSelected.includes(o.id));
  const groupDriverName = groupDriverId ? getDriverName(groupDriverId) : null;

  const confirmGroupDispatch = async () => {
    if (groupBusy || selectedGroupOrders.length < 2) return;
    setGroupBusy(true);
    const target = groupDriverId || null;
    try {
      // 1) Designa o motoboy ANTES de mudar qualquer status (mesma regra do
      // card individual: pronto dispara push/Realtime pros entregadores).
      for (const o of selectedGroupOrders) {
        if ((o as any).assigned_driver_id !== target) {
          const { error } = await (supabase as any).rpc("store_assign_order_driver", {
            _order_id: o.id,
            _driver_user_id: target,
          });
          if (error) throw error;
        }
      }
      // 2) Marca como pronto os que ainda estão em preparo (os já prontos
      // ficam como estão — só ganharam a designação).
      for (const o of selectedGroupOrders) {
        if (o.status === "preparando") {
          await updateOrderStatus(o.id, "pronto_para_entrega", target);
        }
      }
      toast.success(
        target
          ? `${selectedGroupOrders.length} pedidos prontos — ${groupDriverName} leva todos numa viagem só!`
          : `${selectedGroupOrders.length} pedidos prontos — abertos pros motoboys, numa viagem só!`
      );
      setGroupSelected([]);
      setGroupConfirmOpen(false);
      setActiveTab("pronto_para_entrega");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao agrupar os pedidos");
    } finally {
      setGroupBusy(false);
    }
  };

  const openProof = async (order: any) => {
    if (!order?.pix_proof_url) return;
    if (proofUrls[order.id]) { setPixProofPreview({ url: proofUrls[order.id], order }); return; }
    const { data, error } = await supabase.storage
      .from("pix-proofs")
      .createSignedUrl(order.pix_proof_url, 60 * 10);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o comprovante"); return; }
    setProofUrls((p) => ({ ...p, [order.id]: data.signedUrl }));
    setPixProofPreview({ url: data.signedUrl, order });
  };

  const confirmPix = async (order: any) => {
    setPixBusyId(order.id);
    try {
      const { error } = await (supabase as any).rpc("confirm_pix_proof", { p_order_id: order.id });
      if (error) throw error;
      toast.success("Pagamento confirmado! Pedido em preparo.");
      invalidateOrders();
      try { (window as any).__autoPrintDeliveryOrder?.(order.id, order.order_source); } catch {}
    } catch (e: any) {
      toast.error(e?.message || "Erro ao confirmar");
    } finally {
      setPixBusyId(null);
    }
  };

  const confirmPixExternal = async (order: any) => {
    setPixBusyId(order.id);
    try {
      const { error } = await (supabase as any).rpc("confirm_pix_external", { p_order_id: order.id });
      if (error) throw error;
      toast.success("Pagamento confirmado (WhatsApp)! Pedido em preparo.");
      invalidateOrders();
      try { (window as any).__autoPrintDeliveryOrder?.(order.id, order.order_source); } catch {}
    } catch (e: any) {
      toast.error(e?.message || "Erro ao confirmar");
    } finally {
      setPixBusyId(null);
    }
  };

  const refusePix = async (order: any) => {
    const reason = prompt("Motivo da recusa (será visível ao cliente):");
    if (!reason || !reason.trim()) return;
    setPixBusyId(order.id);
    try {
      const { error } = await (supabase as any).rpc("refuse_pix_proof", { p_order_id: order.id, p_reason: reason.trim() });
      if (error) throw error;
      toast.success("Comprovante recusado.");
      invalidateOrders();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao recusar");
    } finally {
      setPixBusyId(null);
    }
  };

  const periodRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    if (period === "today") return { from: start.getTime(), to: Infinity };
    if (period === "yesterday") {
      const y = new Date(start); y.setDate(y.getDate() - 1);
      return { from: y.getTime(), to: start.getTime() };
    }
    if (period === "7d") {
      const s = new Date(start); s.setDate(s.getDate() - 6);
      return { from: s.getTime(), to: Infinity };
    }
    if (period === "30d") {
      const s = new Date(start); s.setDate(s.getDate() - 29);
      return { from: s.getTime(), to: Infinity };
    }
    if (period === "custom") {
      const from = customRange.from ? new Date(`${customRange.from}T00:00:00`).getTime() : -Infinity;
      let to = Infinity;
      if (customRange.to) {
        const d = new Date(`${customRange.to}T00:00:00`);
        d.setDate(d.getDate() + 1);
        to = d.getTime();
      }
      return { from, to };
    }
    return { from: -Infinity, to: Infinity };
  }, [period, customRange]);

  const finalOrders = useMemo(() => {
    return filteredOrders.filter((o: any) => {
      // Pedidos PIX direto aguardando comprovante ficam invisíveis pro lojista
      // até o cliente enviar o comprovante.
      if (o.status === "aguardando_comprovante") return false;
      // Pedido pendente (aguardando aceite) NUNCA é escondido pelo filtro de
      // período: um pendente antigo com o filtro "Hoje" sumia da lista e o
      // botão "Ver pendentes" parecia não fazer nada.
      if (o.status !== "pendente") {
        const t = new Date(o.created_at).getTime();
        if (t < periodRange.from || t >= periodRange.to) return false;
      }
      if (sourceFilter !== "all") {
        if (classifyOrderSource(o) !== sourceFilter) return false;
      }
      if (!matchesExtraFilters(o, extraFilters)) return false;
      return true;
    });
  }, [filteredOrders, periodRange, sourceFilter, extraFilters]);

  // "Ver pendentes": além de trocar a aba, abre o período para "Tudo" —
  // pendentes de dias anteriores continuam visíveis e acionáveis.
  const goToPending = () => {
    setPeriod("all");
    setActiveTab("pendente");
  };

// ─── Relatórios (Fase A): recorte sobre o histórico completo da loja ───
  const reportBase = historyOrders ?? orders;

  const periodSummary = useMemo(() => {
    const inRange = (reportBase || []).filter((o: any) => {
      if (o.status === "aguardando_pagamento" || o.status === "aguardando_comprovante") return false;
      const t = new Date(o.created_at).getTime();
      if (t < periodRange.from || t >= periodRange.to) return false;
      return matchesExtraFilters(o, extraFilters);
    });
    const base = inRange.filter((o: any) => o.status !== "cancelado");
    let total = 0, pdvCount = 0, pdvTotal = 0, deliveryCount = 0, deliveryTotal = 0, manualCount = 0, manualTotal = 0, whatsappCount = 0, whatsappTotal = 0;
    for (const o of base) {
      const price = Number(o.total_price || 0);
      total += price;
      const src = classifyOrderSource(o);
      if (src === "pdv") { pdvCount++; pdvTotal += price; }
      else if (src === "manual") { manualCount++; manualTotal += price; }
      else if (src === "whatsapp") { whatsappCount++; whatsappTotal += price; }
      else { deliveryCount++; deliveryTotal += price; }
    }
    return {
      count: base.length, total,
      ticketMedio: base.length ? total / base.length : 0,
      cancelledCount: inRange.length - base.length,
      pdvCount, pdvTotal, deliveryCount, deliveryTotal, manualCount, manualTotal, whatsappCount, whatsappTotal,
    };
  }, [reportBase, periodRange, extraFilters]);

  const paymentOptions = useMemo(
    () => [...new Set((reportBase || []).map((o: any) => o.payment_method).filter(Boolean))].sort() as string[],
    [reportBase]
  );
  const neighborhoodOptions = useMemo(
    () => [...new Set((reportBase || []).map((o: any) => o.neighborhood).filter((n: any) => n && n !== "RETIRADA"))].sort() as string[],
    [reportBase]
  );
  const productOptions = useMemo(() => {
    const names = new Set<string>();
    for (const o of reportBase || []) {
      for (const i of o.order_items || []) {
        if (i?.products?.name) names.add(i.products.name);
      }
    }
    return [...names].sort();
  }, [reportBase]);

  const reportSet = useMemo(() => {
    const search = (settlementSearch || "").toLowerCase().trim();
    const searchDigits = search.replace(/\D/g, "");
    return (reportBase || []).filter((o: any) => {
      if (o.status === "aguardando_pagamento" || o.status === "aguardando_comprovante") return false;
      const t = new Date(o.created_at).getTime();
      if (t < periodRange.from || t >= periodRange.to) return false;
      if (sourceFilter !== "all" && classifyOrderSource(o) !== sourceFilter) return false;
      if (!matchesExtraFilters(o, extraFilters)) return false;
      if (search) {
        const phone = (getClientWhatsApp(o.client_id) || "").replace(/\D/g, "");
        const hit =
          o.id.slice(0, 8).toLowerCase().includes(search) ||
          String(o.order_number ?? "").includes(search) ||
          getClientName(o.client_id).toLowerCase().includes(search) ||
          (o.neighborhood || "").toLowerCase().includes(search) ||
          (o.driver_id ? getDriverName(o.driver_id).toLowerCase().includes(search) : false) ||
          (searchDigits.length >= 3 && phone.includes(searchDigits));
        if (!hit) return false;
      }
      return true;
    });
  }, [reportBase, periodRange, sourceFilter, extraFilters, settlementSearch, getClientName, getClientWhatsApp, getDriverName]);

  const exportCsv = useMemo(
    () => buildOrdersCsv(reportSet, { getClientName, getClientWhatsApp }),
    [reportSet, getClientName, getClientWhatsApp]
  );

  const periodLabelText = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR");
    if (period === "today") return `Hoje (${fmt(new Date())})`;
    if (period === "yesterday") { const d = new Date(); d.setDate(d.getDate() - 1); return `Ontem (${fmt(d)})`; }
    if (period === "7d") return "Últimos 7 dias";
    if (period === "30d") return "Últimos 30 dias";
    if (period === "custom") {
      const de = customRange.from ? fmt(new Date(`${customRange.from}T00:00:00`)) : "início";
      const ate = customRange.to ? fmt(new Date(`${customRange.to}T00:00:00`)) : "hoje";
      return `Personalizado: ${de} a ${ate}`;
    }
    return "Todo o período";
  }, [period, customRange]);

  const filtersLabelText = useMemo(() => {
    const parts: string[] = [];
    if (sourceFilter !== "all") parts.push(`origem ${{ delivery: "Delivery", whatsapp: "WhatsApp", pdv: "PDV", manual: "Manual" }[sourceFilter]}`);
    if (extraFilters.payment) parts.push(`pagamento ${paymentLabel(extraFilters.payment)}`);
    if (extraFilters.fulfillment === "delivery") parts.push("só entrega");
    if (extraFilters.fulfillment === "pickup") parts.push("só retirada");
    if (extraFilters.neighborhood) parts.push(`bairro ${extraFilters.neighborhood}`);
    if (extraFilters.product) parts.push(`produto ${extraFilters.product}`);
    if (extraFilters.minValue) parts.push(`valor mín R$ ${extraFilters.minValue}`);
    if (extraFilters.maxValue) parts.push(`valor máx R$ ${extraFilters.maxValue}`);
    if (settlementSearch?.trim()) parts.push(`busca "${settlementSearch.trim()}"`);
    return parts.length ? parts.join(" · ") : "sem filtros adicionais";
  }, [sourceFilter, extraFilters, settlementSearch]);

  const handleGenerateReport = () => {
    const ok = openOrdersReport({
      storeName: store?.name || "Loja",
      periodLabel: periodLabelText,
      filtersLabel: filtersLabelText,
      orders: reportSet,
      getters: { getClientName, getClientWhatsApp },
    });
    if (!ok) toast.error("Permita pop-ups no navegador para gerar o relatório");
  };

  const attentionCount = pendingCount + pixPending.length;

  return (
    <>
      <div className="flex items-center justify-between px-4 lg:px-6 pt-4 max-w-6xl mx-auto w-full">
        {store?.plan_type !== "pdv_only" ? (
          <button
            onClick={() => setManualOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Pedido manual
          </button>
        ) : (
          <span />
        )}
        <TutorialHelpButton tutorialId="orders" />
      </div>
      <OrdersToolbar
        period={period}
        setPeriod={setPeriod}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        search={settlementSearch}
        setSearch={setSettlementSearch}
        periodSummary={periodSummary}
        showSearch={(orders?.length || 0) > 1}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        extraFilters={extraFilters}
        onExtraFiltersChange={setExtraFilters}
        paymentOptions={paymentOptions}
        neighborhoodOptions={neighborhoodOptions}
        productOptions={productOptions}
        exportCsv={exportCsv}
        onGenerateReport={handleGenerateReport}
      />

      {attentionCount > 0 && (
        <section className="mx-auto mt-4 flex max-w-6xl flex-col gap-3 border border-primary/30 border-l-4 border-l-primary bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-black text-foreground">{attentionCount} pedido{attentionCount > 1 ? "s precisam" : " precisa"} da sua atenção</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Revise novos pedidos e confirmações de PIX antes de iniciar o preparo.</p>
            </div>
          </div>
          <button onClick={goToPending} className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground hover:bg-primary/90 sm:self-auto">Ver pendentes <ArrowRight className="h-4 w-4" /></button>
        </section>
      )}

      <PixDirectAlert
        pixPending={pixPending}
        pixBusyId={pixBusyId}
        onOpenProof={openProof}
        onConfirm={confirmPix}
        onConfirmExternal={confirmPixExternal}
        onRefuse={refusePix}
        pixProofPreview={pixProofPreview}
        setPixProofPreview={setPixProofPreview}
      />

      {groupEligible.length >= 2 && (
        <div className="mx-auto w-full max-w-6xl px-4 lg:px-6">
          <div className="rounded-2xl border-2 border-dashed border-primary bg-primary/5 p-4">
            <p className="text-base font-black text-foreground">🛵 Dá pra juntar esses pedidos!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tem <b className="text-foreground">{groupEligible.length} pedidos</b> pra sair agora. Juntando, o motoboy{" "}
              <b className="text-foreground">leva todos numa viagem só</b> — entrega um, depois o outro — em vez de ir e
              voltar várias vezes. Não precisa ser do mesmo bairro.
            </p>
            {groupSelected.length === 0 ? (
              <button
                onClick={() => setGroupSelected(groupEligible.map((o: any) => o.id))}
                className="mt-3 w-full rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition-colors hover:bg-primary/90"
              >
                JUNTAR OS {groupEligible.length} PEDIDOS
              </button>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-xs font-bold text-muted-foreground">
                  👇 Toque nos pedidos pra tirar ou pôr de volta — {groupSelected.length} de {groupEligible.length}{" "}
                  vão juntos.
                </p>
                {(linkedStoreDrivers?.length || 0) > 1 && (
                  <div>
                    <label className="text-xs font-bold text-foreground">Quem leva?</label>
                    <select
                      value={groupDriverId}
                      onChange={(e) => setGroupDriverId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Qualquer motoboy (quem aceitar primeiro)</option>
                      {linkedStoreDrivers!.map((d: any) => (
                        <option key={d.user_id} value={d.user_id}>
                          {d.full_name || "Motoboy"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setGroupConfirmOpen(true)}
                    disabled={groupSelected.length < 2}
                    className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                  >
                    MARCAR PRONTOS E ENVIAR PRO MOTOBOY ({groupSelected.length})
                  </button>
                  <button
                    onClick={() => setGroupSelected([])}
                    className="rounded-xl bg-muted px-3 py-3 text-sm font-bold text-muted-foreground"
                    title="Cancelar a seleção"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <OrdersStatusPillsTeste
        orderTabs={orderTabs}
        orders={orders}
        activeTab={activeTab}
        isOwnDelivery={isOwnDelivery}
        onSelect={setActiveTab}
      />

      <div className="mx-auto grid max-w-6xl gap-4 space-y-0 p-4 md:grid-cols-2 xl:grid-cols-3 lg:px-6">
        {isLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => <OrderCardSkeleton key={i} />)}
          </>
        ) : ordersError ? (
          <OrdersEmptyStateTeste activeTab={activeTab} loadError onRetry={onRetryOrders} />
        ) : finalOrders.length > 0 ? (
          finalOrders.map((order: any, index: number) => (
            <AdminOrderCardTeste
              key={order.id}
              order={order}
              index={index}
              isAddressExpanded={expandedAddresses.has(order.id)}
              isOwnDelivery={isOwnDelivery}
              hasLinkedDrivers={hasLinkedDrivers}
              driversLoading={driversLoading}
              cancelConfirm={cancelConfirm}
              cancelReason={cancelReason}
              setCancelReason={setCancelReason}
              cancellingOrder={cancellingOrder}
              storeName={store?.name}
              storeId={store?.id}
              evolutionConnected={evolutionConnected}
              onlineDriversCount={onlineDrivers?.length || 0}
              linkedStoreDrivers={linkedStoreDrivers}
              highlights={getRequiredAddonHighlights(order)}
              clientName={getClientName(order.client_id)}
              clientWhatsApp={getClientWhatsApp(order.client_id)}
              driverName={getDriverName}
              mainAction={getMainAction(order.status, order)}
              acceptHref={buildAcceptWhatsAppHref(order)}
              readyHref={buildReadyWhatsAppHref(order)}
              toggleAddress={toggleAddress}
              setActiveTab={setActiveTab}
              setCancelConfirm={setCancelConfirm}
              updateOrderStatus={updateOrderStatus}
              handleAcceptOrder={handleAcceptOrder}
              handleCancelOrder={handleCancelOrder}
              handlePrint={handlePrint}
              invalidateOrders={invalidateOrders}
              groupSelectable={groupEligible.some((g: any) => g.id === order.id)}
              groupChecked={groupSelected.includes(order.id)}
              onToggleGroup={toggleGroupOrder}
            />
          ))
        ) : (
          <OrdersEmptyStateTeste activeTab={activeTab} />
        )}
      </div>

      <Dialog open={groupConfirmOpen} onOpenChange={(open) => { if (!groupBusy) setGroupConfirmOpen(open); }}>
        <DialogContent className="max-w-sm rounded-2xl p-4 gap-3">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-base">
              Deseja despachar esses {selectedGroupOrders.length} pedidos agora?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Eles marcam como pronto juntos e saem numa viagem só.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            {selectedGroupOrders.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <span className="font-bold">#{o.id.slice(0, 8).toUpperCase()}</span>
                <span className="text-muted-foreground">{o.neighborhood}</span>
                <span className="font-black">{formatBRL(Number(o.total_price))}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Motoboy:{" "}
            <b className="text-foreground">
              {groupDriverName || "qualquer um — quem aceitar primeiro"}
            </b>{" "}
            leva {selectedGroupOrders.length === 2 ? "os dois" : "todos"} numa viagem só.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setGroupConfirmOpen(false)}
              disabled={groupBusy}
              className="flex-1 rounded-xl bg-muted px-4 py-3 text-sm font-bold text-foreground disabled:opacity-40"
            >
              Voltar
            </button>
            <button
              onClick={confirmGroupDispatch}
              disabled={groupBusy}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              {groupBusy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Despachando…
                </span>
              ) : (
                "Sim, despachar agora"
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {store?.id && (
        <ManualOrderFlow
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          storeId={store.id}
          storeName={store?.name}
          storeSettings={(store as any)?.settings || null}
          onCreated={invalidateOrders}
        />
      )}

      {pendingCount > 0 && activeTab !== "pendente" && (
        <button
          onClick={goToPending}
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
          className="fixed right-6 z-30 flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-xl ring-4 ring-primary/30 lg:!bottom-6"
        >
          <Bell className="h-4 w-4" /> {pendingCount} novo{pendingCount > 1 ? "s" : ""}!
        </button>
      )}
    </>
  );
}