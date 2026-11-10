/**
 * TELA REORG — Visão Geral reorganizada (montada só no /admin-teste).
 *
 * Cópia de `DashboardOverviewSectionReorg` com a MESMA lógica, os MESMOS
 * dados e os MESMOS fluxos — muda a organização em 3 blocos fixos
 * (proposta de reorganização do painel, aprovada pelo Renner em
 * 2026-11-08):
 *
 *  1. "Precisa de atenção agora": UM card com uma linha por pendência
 *     (avisos, cobrança PIX gerada, trial acabando, pedidos em atraso),
 *     no lugar dos banners separados. Sem âmbar (regra do Renner):
 *     urgência = vermelho; atenção comum = cor da marca/neutro.
 *  2. "Números do dia": os 4 KPIs principais em grade fixa + métricas
 *     secundárias e exportação CSV, sem mistura com outros cards.
 *  3. "Fazer agora": pedido manual, fila de novos pedidos, em andamento,
 *     ações rápidas e o checklist de configuração (só quando há pendência).
 *  Fora do fluxo principal: explicação da taxa (dobrada), PDV, progresso
 *  Essencial e entregas por motoboy. O banner de Tutoriais sai daqui —
 *  a ajuda virou um botão único no cabeçalho do painel (casca Reorg).
 *  Correção herdada: o banner do trial apontava para a aba inexistente
 *  "plan"; aqui aponta para "subscription" (Meu Plano).
 */

import { useQuery } from "@tanstack/react-query";
import type { ElementType, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  Download,
  GraduationCap,
  MapPin,
  Monitor,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  Store,
  Timer,
  TrendingUp,
  User,
  Users,
  UtensilsCrossed,
  XCircle,
  Bell,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { REPASSE_RULES } from "@/lib/repasseRules";
import WhatsAppButton from "@/components/WhatsAppButton";
import PlatformFeeExplainerCardReorg from "@/components/PlatformFeeExplainerCardReorg";
import EssencialProgressCardReorg from "@/components/EssencialProgressCardReorg";
import TabHeader from "@/components/TabHeader";
import DriverDeliveriesCard from "../components/DriverDeliveriesCard";
import SetupChecklistReorg from "../components/SetupChecklistReorg";
import type { SetupStep } from "../components/SetupChecklist";
import {
  AdminBadgeReorg,
  type AdminBadgeVariantReorg,
  AdminButtonReorg,
  AdminCardReorg,
  AdminMoneyReorg,
} from "../components/teste/AdminBaseReorg";

type OrderStatus = any;
type DashboardTab = any;

interface Props {
  store: any;
  storePlan: any;
  isApproved: boolean;
  isStoreReallyOpen: boolean;
  allHoursClosed: boolean;
  isOwnDelivery: boolean;
  driversLoading: boolean;
  hasLinkedDrivers: boolean;
  pendingCount: number;
  preparingCount: number;
  readyCount: number;
  todayCount: number;
  todayTotal: number;
  avgDeliveryTime: number | null;
  clientAnalytics: any[];
  delayedOrders: any[];
  showDelayedPanel: boolean;
  setShowDelayedPanel: (v: boolean) => void;
  orders: any[] | undefined;
  statusColors: any;
  paymentIcons: any;
  paymentLabels: any;
  setDashboardTab: (t: any) => void;
  setActiveTab: (t: any) => void;
  navigate: (p: string) => void;
  avisosCount: number;
  getClientName: (id: string) => string;
  getClientWhatsApp: (id: string) => string;
  getOrderItemDisplayName: (item: any) => string;
  buildAcceptWhatsAppHref: (o: any) => string;
  buildReadyMessage: (o: any) => string;
  openWhatsApp: (phone: string, msg: string) => void;
  evolutionConnected?: boolean;
  cancelConfirm: string | null;
  cancelReason: string;
  setCancelConfirm: (v: string | null) => void;
  setCancelReason: (v: string) => void;
  cancellingOrder?: boolean;
  updateOrderStatus: (id: string, status: any) => void;
  handleAcceptOrder: (o: any) => void;
  handleCancelOrder: (o: any) => void;
  /** Abre o fluxo de pedido manual (hospedado no shell do dashboard). */
  onOpenManualOrder?: () => void;
  /** Passos do checklist, calculados no shell (mesma conta do selo da nav). */
  setupSteps: SetupStep[];
  /** Total de repasse em aberto, já calculado no shell (useRepassePending). */
  repassePending: number;
}

/** Status do pedido → variante do vocabulário fechado de badges (Tela 1). */
function statusToBadgeVariant(status: string): AdminBadgeVariantReorg {
  switch (status) {
    case "pendente":
      return "novo";
    case "preparando":
      return "preparando";
    case "pronto_para_entrega":
      return "pronto";
    case "saiu_entrega":
    case "em_transito":
      return "entregando";
    case "entregue":
    case "finalizado":
      return "finalizado";
    case "cancelado":
    case "recusado":
      return "cancelado";
    default:
      return "neutro";
  }
}

/** Próxima segunda-feira (dia da cobrança semanal, REPASSE_RULES), incluindo hoje. */
function nextWeeklyChargeDate(): Date {
  const d = new Date();
  while (d.getDay() !== REPASSE_RULES.WEEKLY_CHARGE_WEEKDAY) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function formatElapsedMin(m: number): string {
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}min` : `${h}h`;
  }
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return h ? `${d}d ${h}h` : `${d}d`;
}

function MetricCardReorg({
  icon: Icon,
  label,
  value,
  subValue,
  onClick,
  isNovo,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  onClick?: () => void;
  isNovo?: boolean;
}) {
  return (
    <AdminCardReorg
      onClick={onClick}
      className={
        isNovo
          ? "border-red-500/30 bg-red-500/5 cursor-pointer hover:shadow-md transition-all"
          : onClick
            ? "cursor-pointer hover:shadow-md transition-all"
            : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isNovo ? "bg-red-500/10" : "bg-primary/10"
            }`}
          >
            <Icon className={`h-6 w-6 ${isNovo ? "text-red-600" : "text-primary"}`} />
          </div>
          {isNovo && (
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <AdminBadgeReorg variant="novo">Novo</AdminBadgeReorg>
            </span>
          )}
        </div>
        <div>
          {typeof value === "number" ? (
            <p className="text-xl font-bold tabular-nums text-foreground leading-none">{value}</p>
          ) : (
            <AdminMoneyReorg value={value} className="text-xl" />
          )}
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">{label}</p>
          {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
        </div>
      </div>
    </AdminCardReorg>
  );
}

/** Linha do bloco "Precisa de atenção agora": uma pendência por linha,
 *  dentro de um único card — substitui os banners de alerta separados. */
function AttentionRow({
  icon: Icon,
  tone = "primary",
  title,
  sub,
  badge,
  pulse,
  onClick,
  children,
}: {
  icon: ElementType;
  tone?: "primary" | "danger";
  title: string;
  sub?: ReactNode;
  badge?: number;
  pulse?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 flex items-start gap-3 active:scale-[0.99] transition-transform"
    >
      <div
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0 ${
          tone === "danger"
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="h-5 w-5" />
        {pulse && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-destructive border-2 border-background animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-black text-foreground flex items-center gap-2">
          {title}
          {badge !== undefined && badge > 0 && (
            <span className="min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-black inline-flex items-center justify-center">
              {badge}
            </span>
          )}
        </h4>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        {children}
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
    </button>
  );
}

export default function DashboardOverviewSectionReorg(props: Props) {
  const {
    store, storePlan, hasLinkedDrivers,
    pendingCount, preparingCount, readyCount, todayCount, todayTotal,
    avgDeliveryTime, clientAnalytics, delayedOrders, showDelayedPanel, setShowDelayedPanel,
    orders, statusColors, paymentIcons, paymentLabels, setDashboardTab, setActiveTab, navigate,
    avisosCount,
    getClientName, getClientWhatsApp, getOrderItemDisplayName, buildAcceptWhatsAppHref,
    buildReadyMessage, openWhatsApp, evolutionConnected, cancelConfirm, cancelReason,
    setCancelConfirm, setCancelReason, cancellingOrder, updateOrderStatus, handleAcceptOrder, handleCancelOrder,
    onOpenManualOrder, setupSteps, repassePending,
  } = props;

  // Status do PDV (idêntico ao original: mesma query, mesmo intervalo)
  const { data: pdvSession } = useQuery({
    queryKey: ["pdv-session-status", store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_sessions" as any)
        .select("id, opening_amount, opened_at")
        .eq("store_id", store.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: !!store?.id && storePlan.pdvEnabled !== false,
    refetchInterval: 20_000,
  });
  const isPdvOpen = !!pdvSession?.id;

  // Cobrança PIX pendente (idêntica ao original: leva para aba Repasse)
  const { data: pendingCharge } = useQuery({
    queryKey: ["dashboard-pending-charge", store?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("financial_transactions")
        .select("id, amount, created_at")
        .eq("store_id", store.id)
        .eq("transaction_kind", "commission_charge")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: !!store?.id,
    refetchInterval: 30_000,
  });

  // Métricas extras (idênticas ao original — mesmos cálculos, mesma ordem)
  const todayKey = new Date().toDateString();
  const todayOrders = (orders || []).filter((o: any) => new Date(o.created_at).toDateString() === todayKey);
  const ticketMedio = todayCount > 0 ? todayTotal / todayCount : 0;
  const cancelados = todayOrders.filter((o: any) => o.status === "cancelado" || o.status === "recusado").length;
  const taxaCancel = todayOrders.length > 0 ? (cancelados / todayOrders.length) * 100 : 0;
  const saidasComTempo = todayOrders
    .filter((o: any) => ["saiu_entrega", "em_transito", "entregue", "finalizado"].includes(o.status))
    .map((o: any) => {
      const dispatched = o.dispatched_at || o.updated_at;
      if (!dispatched) return null;
      return (new Date(dispatched).getTime() - new Date(o.created_at).getTime()) / 60000;
    })
    .filter((m: any) => typeof m === "number" && m > 0 && m < 600);
  const tempoAteSaida = saidasComTempo.length > 0
    ? Math.round(saidasComTempo.reduce((a: number, b: number) => a + b, 0) / saidasComTempo.length)
    : null;

  const exportCsv = () => {
    const rows = [
      ["id", "criado_em", "status", "cliente", "bairro", "pagamento", "total"],
      ...todayOrders.map((o: any) => [
        o.id.slice(0, 8),
        new Date(o.created_at).toLocaleString("pt-BR"),
        o.status,
        getClientName(o.client_id).split(",").join(" "),
        (o.neighborhood || "").split(",").join(" "),
        o.payment_method || "",
        Number(o.total_price).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Próximo repasse: valor = total em aberto do shell; data = próxima segunda.
  const nextCharge = nextWeeklyChargeDate();
  const nextChargeIsToday = nextCharge.toDateString() === new Date().toDateString();
  const nextChargeLabel = nextCharge.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const repasseSub = pendingCharge
    ? "Cobrança gerada — toque para pagar"
    : store?.status === "bloqueado"
      ? "Loja pausada — quite pra reativar"
      : repassePending >= REPASSE_RULES.BLOCK_THRESHOLD_BRL
        ? `Acima do teto — quite até segunda, ${nextChargeLabel}`
        : repassePending > 0
          ? nextChargeIsToday
            ? "Cobrança hoje, segunda-feira"
            : `Próxima segunda, ${nextChargeLabel}`
          : "Nenhum valor em aberto";

  const setupDoneCount = setupSteps.filter((s) => s.done).length;

  return (
<div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5 lg:space-y-6">

  <TabHeader title="Visão Geral" subtitle="Como sua loja está hoje: pedidos, vendas e o que precisa da sua atenção" />

  {/* ── BLOCO 1 — PRECISA DE ATENÇÃO AGORA ──
      Um único card, uma linha por pendência (avisos, cobrança gerada,
      trial, pedidos em atraso) — substitui os banners separados.
      Sem âmbar: urgência = vermelho; atenção comum = cor da marca. */}
  {(avisosCount > 0 || pendingCharge || (storePlan.isInTrial && storePlan.trialEndsAt) || delayedOrders.length > 0) && (
    <section className="space-y-3">
      <h3 className="font-black text-foreground text-base tracking-tight">Precisa de atenção agora</h3>
      <AdminCardReorg className="p-0 overflow-hidden">
        <div className="divide-y divide-border">
          {avisosCount > 0 && (
            <AttentionRow
              icon={Bell}
              title={`Você tem ${avisosCount} aviso${avisosCount > 1 ? "s" : ""} pendente${avisosCount > 1 ? "s" : ""}`}
              sub="Toque para ver e resolver"
              badge={avisosCount}
              onClick={() => setDashboardTab("avisos")}
            />
          )}
          {pendingCharge && (
            <AttentionRow
              icon={CreditCard}
              title={`Cobrança gerada — ${formatBRL(Number(pendingCharge.amount || 0))}`}
              sub="Toque para pagar via PIX"
              pulse
              onClick={() => setDashboardTab("repasse")}
            />
          )}
          {storePlan.isInTrial && storePlan.trialEndsAt && (() => {
            const daysLeft = Math.max(0, storePlan.trialDaysLeft);
            const started = storePlan.startedAt ? new Date(storePlan.startedAt).getTime() : null;
            const endsAt = new Date(storePlan.trialEndsAt).getTime();
            const totalDays = started
              ? Math.max(1, Math.ceil((endsAt - started) / 86400000))
              : Math.max(daysLeft, 7);
            const daysUsed = Math.max(0, totalDays - daysLeft);
            const pct = Math.min(100, Math.round((daysUsed / totalDays) * 100));
            const urgent = daysLeft <= 3;
            const endsLabel = new Date(storePlan.trialEndsAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
            const fee = Number(storePlan.monthlyFee || 0);
            return (
              <AttentionRow
                icon={CalendarClock}
                tone={urgent ? "danger" : "primary"}
                title={daysLeft === 0
                  ? "Seu período de teste termina hoje"
                  : `Período de teste — restam ${daysLeft} dia${daysLeft > 1 ? "s" : ""}`}
                sub={<>Termina em <span className="font-semibold text-foreground">{endsLabel}</span>{fee > 0 && (<> — cobrança automática de <span className="font-semibold text-foreground">{formatBRL(fee)}</span> ao final</>)}</>}
                onClick={() => setDashboardTab("subscription")}
              >
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden mt-2.5">
                  <div
                    className={`h-full transition-all ${urgent ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-muted-foreground font-semibold">
                    {daysUsed} de {totalDays} dias usados
                  </span>
                  <span className={`text-xs font-bold ${urgent ? "text-destructive" : "text-primary"}`}>
                    {urgent ? "Ative seu plano para não interromper" : "Ver detalhes do plano"}
                  </span>
                </div>
              </AttentionRow>
            );
          })()}
          {delayedOrders.length > 0 && (
            <button
              onClick={() => setShowDelayedPanel(!showDelayedPanel)}
              className="w-full text-left p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive flex-shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-destructive">{delayedOrders.length} pedido{delayedOrders.length > 1 ? "s" : ""} em atraso</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Mais de 20 min sem atualização</p>
              </div>
              {showDelayedPanel ? <ChevronUp className="h-5 w-5 text-destructive flex-shrink-0" /> : <ChevronDown className="h-5 w-5 text-destructive flex-shrink-0" />}
            </button>
          )}
        </div>
      </AdminCardReorg>
      {delayedOrders.length > 0 && showDelayedPanel && (
        <div className="space-y-2">
          {delayedOrders.map((order: any) => {
            const elapsedMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
            return (
              <AdminCardReorg key={order.id} className="border-destructive/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                    <AdminBadgeReorg variant={statusToBadgeVariant(order.status)}>
                      {(statusColors[order.status] || statusColors.pendente).label}
                    </AdminBadgeReorg>
                  </div>
                  <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">⏱️ {formatElapsedMin(elapsedMin)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{getClientName(order.client_id)}</span><span>•</span>
                  <span>{paymentIcons[order.payment_method]} {paymentLabels[order.payment_method] || order.payment_method}</span><span>•</span>
                  <AdminMoneyReorg value={formatBRL(Number(order.total_price))} />
                </div>
                <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 space-y-0.5">
                  {order.order_items?.slice(0, 4).map((item: any) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="text-foreground"><span className="text-primary font-bold">{item.quantity}x</span> {getOrderItemDisplayName(item)}</span>
                      <span className="text-muted-foreground">{formatBRL(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                  {(order.order_items?.length || 0) > 4 && <p className="text-xs text-muted-foreground">+{order.order_items.length - 4} itens...</p>}
                </div>
                <div className="flex gap-2">
                  {order.status === "pendente" && (
                    <AdminButtonReorg
                      onClick={() => {
                        setDashboardTab("orders");
                        setActiveTab("preparando");
                        updateOrderStatus(order.id, "preparando");
                      }}
                      className="flex-1 text-xs"
                    >
                      {order.payment_method === "pix" ? "🍳 PRODUZIR" : "✓ ACEITAR"}
                    </AdminButtonReorg>
                  )}
                  {order.status === "preparando" && (
                    <AdminButtonReorg
                      onClick={() => {
                        const phone = getClientWhatsApp(order.client_id);
                        if (!evolutionConnected && !phone) {
                          alert(`Atenção: Cliente #${order.id.slice(0, 8)} sem telefone.`);
                        } else if (!evolutionConnected) {
                          const msg = buildReadyMessage(order);
                          openWhatsApp(phone, msg);
                        }
                        setDashboardTab("orders");
                        setActiveTab("pronto_para_entrega");
                        updateOrderStatus(order.id, "pronto_para_entrega" as OrderStatus);
                      }}
                      className="flex-1 text-xs"
                    >
                      🔔 MARCAR PRONTO
                    </AdminButtonReorg>
                  )}
                  {getClientWhatsApp(order.client_id) && (
                    <WhatsAppButton number={getClientWhatsApp(order.client_id)} message={`Olá! Sobre seu pedido #${order.id.slice(0, 8).toUpperCase()}, estamos cuidando dele!`} />
                  )}
                </div>
              </AdminCardReorg>
            );
          })}
        </div>
      )}
    </section>
  )}

  {/* ── BLOCO 2 — NÚMEROS DO DIA ── */}
  <section className="space-y-3">
    <h3 className="font-black text-foreground text-base tracking-tight">Números do dia</h3>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
    <MetricCardReorg
      icon={ShoppingBag} label="Pedidos Pendentes" value={pendingCount}
      subValue={preparingCount > 0 ? `+ ${preparingCount} em preparo` : "Sem pedidos novos"}
      isNovo={pendingCount > 0}
      onClick={() => { setDashboardTab("orders"); setActiveTab("pendente"); }}
    />
    <MetricCardReorg
      icon={DollarSign} label="Faturamento Hoje" value={formatBRL(todayTotal)}
      subValue={`${todayCount} pedido${todayCount !== 1 ? "s" : ""} hoje`}
      onClick={() => setDashboardTab("finance")}
    />
    <MetricCardReorg
      icon={Timer} label="Tempo Médio" value={avgDeliveryTime ? `${avgDeliveryTime} min` : "—"}
      subValue="Pedido até entrega"
    />
    <MetricCardReorg
      icon={CreditCard} label="Próximo Repasse" value={formatBRL(repassePending)}
      subValue={repasseSub}
      onClick={() => setDashboardTab("repasse")}
    />
  </div>

  {/* Métricas secundárias (mesmos valores do original; trio só com pedidos hoje) */}
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
    <MetricCardReorg
      icon={Users} label="Total Clientes" value={clientAnalytics.length}
      subValue="Clientes registrados"
      onClick={() => setDashboardTab("clients")}
    />
    {todayOrders.length > 0 && (
      <>
        <MetricCardReorg
          icon={TrendingUp} label="Ticket Médio" value={formatBRL(ticketMedio)}
          subValue="Por pedido hoje"
        />
        <MetricCardReorg
          icon={XCircle} label="Taxa de Cancelamento" value={`${taxaCancel.toFixed(1)}%`}
          subValue={`${cancelados} de ${todayOrders.length} hoje`}
        />
        <MetricCardReorg
          icon={Timer} label="Pedido → Saída" value={tempoAteSaida ? `${tempoAteSaida} min` : "—"}
          subValue="Tempo médio na cozinha"
        />
      </>
    )}
  </div>

  {todayOrders.length > 0 && (
    <div className="flex justify-end">
      <button
        onClick={exportCsv}
        className="inline-flex items-center gap-2 text-xs font-bold text-foreground bg-card border border-border hover:border-primary/40 px-4 py-2 rounded-xl transition-colors"
      >
        <Download className="h-3.5 w-3.5" /> Exportar pedidos de hoje (CSV)
      </button>
    </div>
  )}
</section>

  {/* ── BLOCO 3 — FAZER AGORA ── */}
  <section className="space-y-5">
    <h3 className="font-black text-foreground text-base tracking-tight">Fazer agora</h3>
  {/* ── NOVO: Pedido manual direto da home ── */}
  {store?.plan_type !== "pdv_only" && onOpenManualOrder && (
    <button
      onClick={onOpenManualOrder}
      className="w-full text-left bg-primary text-primary-foreground rounded-2xl p-4 flex items-center gap-3 shadow-lg shadow-primary/25 active:scale-[0.99] transition-transform"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 flex-shrink-0">
        <Plus className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-black flex items-center gap-2">
          Pedido manual
          <span className="text-xs font-black bg-white/25 px-2 py-0.5 rounded-full">NOVO</span>
        </h3>
        <p className="text-xs opacity-90 mt-0.5">Para pedidos que chegam pelo WhatsApp ou telefone</p>
      </div>
      <ChevronRight className="h-5 w-5 flex-shrink-0 opacity-90" />
    </button>
  )}

  {/* ── Fila de pedidos novos (mesma lógica e fluxo do original) ── */}
  {pendingCount > 0 && (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute" />
            <div className="w-3 h-3 bg-red-500 rounded-full relative" />
          </div>
          <h3 className="font-black text-foreground text-base tracking-tight">Novos Pedidos</h3>
          <span className="bg-red-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm shadow-red-500/30">
            {pendingCount}
          </span>
        </div>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">aguardando aceite</span>
      </div>
      <div className="space-y-3">
        {orders?.filter(o => o.status === "pendente").slice(0, 5).map((order: any) => (
          <AdminCardReorg key={order.id} className="border-red-500/30 hover:shadow-lg hover:shadow-red-500/5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <AdminMoneyReorg value={formatBRL(Number(order.total_price))} className="text-xl" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 flex-wrap">
              <div className="flex items-center gap-1"><User className="h-3 w-3" /><span className="font-medium">{getClientName(order.client_id)}</span></div>
              <span>•</span>
              <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /><span>{order.neighborhood}</span></div>
              <span>•</span>
              <span className="font-medium">{paymentIcons[order.payment_method]} {paymentLabels[order.payment_method] || order.payment_method}</span>
            </div>
            <div className="bg-muted/40 rounded-xl px-3 py-2.5 mb-3 space-y-1">
              {order.order_items?.map((item: any) => (
                <div key={item.id} className="text-sm text-foreground flex justify-between">
                  <span><span className="text-primary font-bold">{item.quantity}x</span> {getOrderItemDisplayName(item)}</span>
                  <span className="text-muted-foreground text-xs">{formatBRL(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            {order.payment_method === "pix" && (
              <div className="text-center mb-3">
                <span className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-lg font-bold inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> PIX Confirmado
                </span>
              </div>
            )}
            {/* CORREÇÃO mantida do original: Link <a> em vez de button+window.open para evitar popup blocker */}
            <a
              href={buildAcceptWhatsAppHref(order)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={async (e) => {
                // Grava o status ANTES de imprimir/abrir o WhatsApp — a navegação
                // do link podia cancelar a requisição e o pedido não ia p/ preparando.
                e.preventDefault();
                const href = buildAcceptWhatsAppHref(order);
                if (href !== "#") window.open(href, "_blank", "noopener,noreferrer");
                try {
                  await updateOrderStatus(order.id, "preparando");
                } finally {
                  handleAcceptOrder(order);
                }
              }}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-xl text-sm active:scale-[0.98] transition-all h-12 flex items-center justify-center no-underline"
            >
              {order.payment_method === "pix" ? "🍳 COMEÇAR PRODUÇÃO" : "✓ ACEITAR PEDIDO"}
            </a>

            {cancelConfirm === order.id ? (
              <div className="mt-2 space-y-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-xs font-bold text-destructive">Motivo do cancelamento</p>
                {[
                  { value: "out_of_stock", label: "📦 Acabou no estoque" },
                  { value: "client_request", label: "👤 Cliente solicitou" },
                  { value: "out_of_area", label: "📍 Fora da área de entrega" },
                  { value: "closed", label: "🔒 Loja fechada / sem entregador" },
                  { value: "other", label: "📝 Outro motivo" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCancelReason(opt.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      cancelReason === opt.value
                        ? "border-destructive/30 bg-destructive/10 font-bold text-destructive"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="flex gap-1.5 pt-1">
                  <AdminButtonReorg
                    variant="danger"
                    onClick={() => handleCancelOrder(order)}
                    disabled={!cancelReason || cancellingOrder}
                    className="flex-1 text-xs"
                  >
                    {cancellingOrder ? "Cancelando..." : "Confirmar Cancelamento"}
                  </AdminButtonReorg>
                  <AdminButtonReorg
                    variant="secondary"
                    onClick={() => { setCancelConfirm(null); setCancelReason(""); }}
                    className="text-xs px-3"
                  >
                    Voltar
                  </AdminButtonReorg>
                </div>
              </div>
            ) : (
              <button onClick={() => { setCancelConfirm(order.id); setCancelReason(""); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-destructive py-1.5 mt-1 transition-colors">
                Recusar pedido
              </button>
            )}
          </AdminCardReorg>
        ))}
      </div>
    </div>
  )}

  {/* ── Em andamento (mesma lógica; pílulas no vocabulário canônico) ── */}
  {(preparingCount > 0 || readyCount > 0) && (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-foreground text-base">Em Andamento</h3>
        <button onClick={() => setDashboardTab("orders")} className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
          Ver todos <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
        {orders?.filter(o => ["preparando", "pronto_para_entrega", "em_transito", "saiu_entrega"].includes(o.status)).slice(0, 6).map((order: any) => {
          const sc = statusColors[order.status] || statusColors.pendente;
          return (
            <button key={order.id}
              onClick={() => { setDashboardTab("orders"); setActiveTab(order.status as OrderStatus); }}
              className={`flex-shrink-0 bg-card border-2 ${sc.border} rounded-2xl p-3 flex flex-col gap-2 min-w-[160px] hover:shadow-md transition-all`}>
              <AdminBadgeReorg variant={statusToBadgeVariant(order.status)} className="self-start">{sc.label}</AdminBadgeReorg>
              <span className="text-sm font-black text-foreground">#{order.id.slice(0, 6).toUpperCase()}</span>
              <span className="text-xs text-muted-foreground truncate w-full text-left">{getClientName(order.client_id)}</span>
            </button>
          );
        })}
      </div>
    </div>
  )}

  {/* ── Ações rápidas (idênticas ao original) ── */}
  <div className="space-y-3">
    <h3 className="font-black text-foreground text-base tracking-tight">Ações Rápidas</h3>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {store?.plan_type !== "pdv_only" && onOpenManualOrder && (
        <button
          onClick={onOpenManualOrder}
          className="group relative overflow-hidden flex items-center gap-3 bg-primary/5 border-2 border-primary/50 rounded-2xl p-3.5 hover:shadow-md hover:shadow-primary/5 active:scale-[0.97] transition-all text-left"
        >
          <div className="relative w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div className="relative min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-bold text-foreground leading-tight">
              Pedido manual
              <span className="text-xs font-black bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">NOVO</span>
            </span>
            <span className="block text-xs text-muted-foreground/80 mt-0.5 truncate">Lançar pedido do WhatsApp</span>
          </div>
        </button>
      )}
      {[
        { label: "Cardápio", hint: "Itens e fotos", icon: UtensilsCrossed, tab: "menu" as DashboardTab },
        { label: "Finanças", hint: "Saques e taxas", icon: Coins, tab: "finance" as DashboardTab },
        { label: "Horários", hint: "Aberto/fechado", icon: Clock, tab: "hours" as DashboardTab },
        { label: "Configurações", hint: "Loja e entrega", icon: Settings, tab: "settings" as DashboardTab },
      ].map((action) => (
        <button
          key={action.label}
          onClick={() => setDashboardTab(action.tab)}
          className="group relative overflow-hidden flex items-center gap-3 bg-card border border-border rounded-2xl p-3.5 hover:shadow-md hover:shadow-primary/5 hover:border-primary/30 active:scale-[0.97] transition-all text-left"
        >
          <div className="pointer-events-none absolute -top-8 -right-8 w-20 h-20 bg-primary/0 group-hover:bg-primary/10 rounded-full blur-2xl transition-colors" />
          <div className="relative w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
            <action.icon className="h-5 w-5 text-primary" />
          </div>
          <div className="relative min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground leading-tight">{action.label}</span>
            <span className="block text-xs text-muted-foreground/80 mt-0.5 truncate">{action.hint}</span>
          </div>
        </button>
      ))}
    </div>
  </div>

  {/* Primeiros passos: só aparece enquanto houver pendência, já aberto */}
  {setupDoneCount < setupSteps.length && (
  <details open className="rounded-2xl border border-border bg-card overflow-hidden">
    <summary className="flex items-center gap-3 p-4 cursor-pointer list-none">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-foreground">Primeiros passos</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {setupDoneCount} de {setupSteps.length} concluídos
          {setupDoneCount < setupSteps.length ? " — toque para ver o que falta" : ""}
        </p>
      </div>
      {setupDoneCount < setupSteps.length && (
        <AdminBadgeReorg variant="aviso">{setupSteps.length - setupDoneCount} pendente{(setupSteps.length - setupDoneCount) > 1 ? "s" : ""}</AdminBadgeReorg>
      )}
      <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
    </summary>
    <div className="border-t border-border/60">
      <SetupChecklistReorg storeId={store.id} steps={setupSteps} onNavigate={setDashboardTab} />
    </div>
  </details>
  )}
  </section>

  {/* ── FORA DO FLUXO PRINCIPAL: explicações e atalhos ── */}
  <section className="space-y-5">
  {/* ── 4. TEXTO LONGO DA TAXA DOBRADO (fora do caminho do rush) ── */}
  {storePlan.platformDeliverySplit > 0 && (
    <details className="rounded-2xl border border-border bg-card overflow-hidden">
      <summary className="flex items-center gap-3 p-4 cursor-pointer list-none">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Sobre a taxa por entrega</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Toque para ler a explicação completa</p>
        </div>
        <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </summary>
      <div className="px-4 pb-4 border-t border-border/60 pt-4">
        <PlatformFeeExplainerCardReorg storeId={store.id} splitPerOrder={storePlan.platformDeliverySplit} />
      </div>
    </details>
  )}

  {/* ── Banner PDV (idêntico ao original, só text-xs no lugar de 10/11px) ── */}
  {storePlan.pdvEnabled !== false && (
    <button
      onClick={() => navigate("/admin-teste/pdv")}
      className={`w-full text-left rounded-2xl p-4 flex items-center gap-4 active:scale-[0.99] transition-transform group border ${
        isPdvOpen ? "bg-primary/5 border-primary/40" : "bg-card border-border hover:border-primary/40"
      }`}
    >
      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-colors ${
        isPdvOpen ? "bg-primary/20 border-primary/30" : "bg-primary/10 border-primary/20 group-hover:bg-primary/20"
      }`}>
        <Monitor className="h-6 w-6 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-black text-foreground">PDV — Caixa Presencial</h3>
          {isPdvOpen ? (
            <span className="text-xs font-bold bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Caixa aberto
            </span>
          ) : (
            <span className="text-xs font-bold bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">
              Disponível
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isPdvOpen
            ? `Troco inicial ${formatBRL(Number(pdvSession?.opening_amount) || 0)} — toque para registrar vendas.`
            : "Venda no balcão, mesa ou comanda. Sem taxa PIX — maquininha própria."}
        </p>
        <p className="text-xs text-primary font-semibold mt-1.5 flex items-center gap-1">
          {isPdvOpen ? "Ir para o PDV" : "Abrir caixa"} <ChevronRight className="h-3.5 w-3.5" />
        </p>
      </div>
    </button>
  )}

  {/* Progresso Essencial (cartão compacto, não texto longo — segue visível) */}
  <EssencialProgressCardReorg store={store} storePlan={storePlan} />

  {/* ── Entregas por motoboy (idêntico ao original) ── */}
  {store?.id && hasLinkedDrivers && (
    <DriverDeliveriesCard
      storeId={store.id}
      onClick={() => setDashboardTab("drivers")}
    />
  )}

  </section>

  {/* ── Estado vazio (mesma condição do original) ── */}
  {pendingCount === 0 && preparingCount === 0 && readyCount === 0 && todayCount === 0 && clientAnalytics.length === 0 && (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-24 h-24 bg-muted/50 rounded-2xl flex items-center justify-center mb-5">
        <Store className="h-12 w-12 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-black text-foreground mb-2">Tudo tranquilo por aqui! 😌</h3>
      <p className="text-sm text-muted-foreground max-w-xs">Nenhum pedido ainda hoje. Compartilhe o link da sua loja para começar a receber pedidos!</p>
      <AdminButtonReorg onClick={() => setDashboardTab("settings")} className="mt-4 px-6">
        Configurar Loja
      </AdminButtonReorg>
    </div>
  )}
</div>
  );
}
