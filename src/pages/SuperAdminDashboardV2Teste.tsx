/**
 * CÓPIA DE TESTE (/super-admin-teste) de SuperAdminDashboardV2.
 * Fase 0: cópia idêntica ao original, só com o selo "TESTE" no topo.
 * Fase 1: links diretos (?aba=/&secao=), ⌘K com lojas e ações, Saques
 * direto no Financeiro (sem o atalho de aba legada) e tela nova
 * "Pedidos atrasados". Aprovações fica FORA do plano (decisão do Renner).
 * Publicação depende da palavra do Renner, fase por fase.
 * Regra: só arquivos *Teste — nunca editar o original por aqui.
 */
import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AdminApprovals from "@/components/AdminApprovals";
import CouponManager from "@/components/CouponManager";
import AdminStoreManager from "@/components/AdminStoreManager";
import DeliveryFeeConfigPanel from "@/components/DeliveryFeeConfig";
import TestStoreCreator from "@/components/TestStoreCreator";
import PlanosTab from "@/components/PlanosTab";
import AdminPlanManager from "@/components/AdminPlanManager";
import AdminPlanTemplatesEditor from "@/components/AdminPlanTemplatesEditor";
import ModeratorManager from "@/components/ModeratorManager";
import SupportAdminPanel from "@/components/SupportAdminPanel";
import AppStorePageAdmin from "@/components/AppStorePageAdmin";
import PartnerSplitPanel from "@/components/PartnerSplitPanel";
import TestStoreFinancePanel from "@/components/TestStoreFinancePanel";
import AppLinksManager from "@/components/AppLinksManager";
import AdminBroadcastPush from "@/components/AdminBroadcastPush";
import SalesCoachPanel from "@/components/SalesCoachPanel";
import PageViewsCardTeste from "@/components/PageViewsCardTeste";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { parseSuperAdminDeepLink, buildSuperAdminDeepLink } from "@/lib/superAdminDeepLink";
import { filterBillableOrders } from "@/lib/superAdminBillable";
import { computeStoreSettlement, summarizeSettlement, summarizeFailedPayouts } from "@/lib/superAdminConsolidado";
import { toast } from "sonner";
import { planLabel } from "@/lib/plansInfo";
import {
  ArrowLeft, DollarSign, TrendingUp, Clock,
  Store, Copy, AlertTriangle, Users, Bike, Wallet, CheckCircle2, Banknote, XCircle, Bell, Trash2, QrCode, Loader2, ArrowUpRight, ArrowDownRight, Settings,
  LayoutDashboard, Shield, Ticket, RefreshCw, Truck, Menu, X, MapPin, Eye, Scale, Search, FileText, Mail, Phone, User, Download, Calendar, CreditCard, Receipt, ChevronDown, ChevronUp, Percent, Crown, Handshake, FlaskConical, Link as LinkIcon, Megaphone, Monitor, Sparkles, PanelLeftClose, PanelLeftOpen,
  MessageCircle, Smartphone, ShieldCheck, Puzzle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
 import { Switch } from "@/components/ui/switch";
 import { Badge } from "@/components/ui/badge";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// Hook + KPI/cores leves (sem recharts) — eager
import {
  KpiCard, useFinanceChartData, CHART_COLORS,
} from "@/components/FinanceChartsCore";
// Gráficos pesados (recharts) — carregados sob demanda
// Visão Geral Teste usa as cópias Teste (teto do eixo Y + legenda sem estouro)
const DailySalesChart = lazy(() =>
  import("@/components/FinanceChartsTeste").then(m => ({ default: m.DailySalesChartTeste }))
);
const PaymentBreakdownChart = lazy(() =>
  import("@/components/FinanceChartsTeste").then(m => ({ default: m.PaymentBreakdownChartTeste }))
);
const HourlyChart = lazy(() =>
  import("@/components/FinanceCharts").then(m => ({ default: m.HourlyChart }))
);
const ChannelCompareChart = lazy(() =>
  import("@/components/FinanceCharts").then(m => ({ default: m.ChannelCompareChart }))
);
 import { addMoney, multiplyMoney, sumMoney, formatBRL } from "@/lib/utils";
 import { statusColors as globalStatusColors } from "@/lib/orderStatus";

// Lazy-loaded tabs (carregadas só ao abrir)
const SyncExternalTab = lazy(() => import("./super-admin/tabs/SyncExternalTab"));
const JuridicoTab = lazy(() => import("./super-admin/tabs/JuridicoTab"));
const CidadesTab = lazy(() => import("./super-admin/tabs/CidadesTab"));
const SaquesTab = lazy(() => import("./super-admin/tabs/SaquesTab"));
const PagamentosSplitTabTeste = lazy(() => import("./super-admin/tabs/PagamentosSplitTabTeste"));
const AuditoriaTab = lazy(() => import("./super-admin/tabs/AuditoriaTab"));
const AReceberTab = lazy(() => import("./super-admin/tabs/AReceberTabTeste"));
const HistoricoRepassesTab = lazy(() => import("./super-admin/tabs/HistoricoRepassesTab"));
const DebugLojaTab = lazy(() => import("./super-admin/tabs/DebugLojaTab"));
const PlatformWhatsAppTab = lazy(() => import("./super-admin/tabs/PlatformWhatsAppTab"));
const AddonsMrrTab = lazy(() => import("./super-admin/tabs/AddonsMrrTab"));
const RevendedoresTab = lazy(() => import("./super-admin/tabs/RevendedoresTab"));
const ConsolidadoTabTeste = lazy(() => import("./super-admin/tabs/ConsolidadoTabTeste"));
// Painéis financeiros profissionais (Fase 1)
const FluxoCaixaPanel = lazy(() => import("@/components/finance/FluxoCaixaPanel"));
const ConciliacaoAsaasPanel = lazy(() => import("@/components/finance/ConciliacaoAsaasPanel"));
const AuditoriaFinanceiraPanel = lazy(() => import("@/components/finance/AuditoriaFinanceiraPanel"));
const MensalidadesPanel = lazy(() => import("@/components/finance/MensalidadesPanel"));
const ComissoesPanel = lazy(() => import("@/components/finance/ComissoesPanel"));
const TabFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

// Fase 2 — grupos do Financeiro (só na versão Teste): rótulos padronizados
// ("Planos das lojas" em vez de "Planos (Lojas)", "Saques" em vez de
// "Saques (legado)") + descrição de cada seção, usada pelo cabeçalho
// padronizado da seção ativa. As duas seções resgatadas (repasses-falha e
// comissoes) entram no grupo Pagamentos.
// (sem import aqui: LucideIcon vem do bloco de imports do topo)
type FinanceGroupItem = { key: string; label: string; desc: string; icon: LucideIcon };
const FINANCE_GROUPS: { group: string; items: FinanceGroupItem[] }[] = [
  { group: "Consolidado", items: [
    { key: "consolidado", label: "Consolidado", desc: "Resumo do dinheiro: saldos, a receber e repasses.", icon: LayoutDashboard },
  ]},
  { group: "Receitas", items: [
    { key: "areceber", label: "A Receber", desc: "Valores a receber das lojas.", icon: Wallet },
    { key: "mensalidades", label: "Mensalidades", desc: "Cobranças mensais dos planos.", icon: Crown },
    { key: "addons", label: "Add-ons / MRR", desc: "Add-ons contratados e receita recorrente.", icon: Puzzle },
    { key: "planos-lojas", label: "Planos das lojas", desc: "Plano ativo em cada loja.", icon: Store },
    { key: "planos-templates", label: "Templates de planos", desc: "Modelos de plano para criar ou editar.", icon: FileText },
  ]},
  { group: "Pagamentos", items: [
    { key: "historico", label: "Histórico Pago", desc: "Repasses já pagos.", icon: CheckCircle2 },
    { key: "fluxo", label: "Fluxo de Caixa", desc: "Entradas e saídas de caixa.", icon: TrendingUp },
    { key: "conciliacao", label: "Conciliação", desc: "Conferência dos valores com o Asaas.", icon: ShieldCheck },
    { key: "saques", label: "Saques", desc: "Pedidos de saque pendentes e histórico.", icon: Wallet },
    { key: "repasses-falha", label: "Repasses com falha", desc: "Repasses que falharam e ficaram presos.", icon: XCircle },
    { key: "comissoes", label: "Cobrança de comissão", desc: "Comissão pendente por loja, pronta para cobrar.", icon: Receipt },
  ]},
  { group: "Parceiros", items: [
    { key: "revendedores", label: "Revendedores", desc: "Revendedores e suas comissões.", icon: Handshake },
    { key: "socios", label: "Sócios", desc: "Divisão com os sócios.", icon: Handshake },
  ]},
  { group: "Sistema", items: [
    { key: "auditoria", label: "Auditoria Financeira", desc: "Trilha de auditoria financeira.", icon: FileText },
    { key: "test", label: "Lojas Teste", desc: "Lojas de teste e seus valores.", icon: FlaskConical },
  ]},
];

// Barra de sub-abas reutilizável (usada pelas seções consolidadas: Financeiro, Lojas, App, Auditoria)
const SubTabsBar = ({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { key: string; label: string; icon?: React.ElementType; badge?: number }[];
}) => (
  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
    {items.map((it) => {
      const Icon = it.icon;
      const isActive = value === it.key;
      return (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
            isActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
          }`}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          <span>{it.label}</span>
          {!!it.badge && it.badge > 0 && (
            <span className={`ml-1 text-[10px] font-black rounded-full px-1.5 py-0.5 ${isActive ? "bg-primary-foreground/20" : "bg-destructive text-destructive-foreground"}`}>
              {it.badge}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

type DateFilter = "today" | "yesterday" | "week";
type AdminTab = "dashboard" | "approvals" | "stores" | "financeiro" | "pagamentos" | "saques" | "sync" | "coupons" | "entrega" | "cidades" | "juridico" | "planos" | "moderadores" | "socios" | "suporte" | "app-page" | "test_finance" | "links" | "broadcast" | "logs" | "coach" | "auditoria" | "whatsapp_plataforma" | "atrasados";

const sidebarItems: { key: AdminTab; label: string; icon: React.ElementType; group: string }[] = [
  // Início
  { key: "dashboard", label: "Visão Geral", icon: LayoutDashboard, group: "Início" },
  // Fase 1 — lista dos pedidos há mais de 60 min (o número já existia no card "Atraso")
  { key: "atrasados", label: "Pedidos atrasados", icon: AlertTriangle, group: "Início" },
  // Lojas (Cidades + Entrega vivem como sub-abas dentro de "Lojas")
  { key: "stores", label: "Lojas", icon: Store, group: "Lojas" },
  { key: "coupons", label: "Cupons", icon: Ticket, group: "Lojas" },
  // Financeiro unificado (Pagamentos / Saques / Planos / Sócios / Teste viraram sub-abas)
  { key: "financeiro", label: "Financeiro", icon: DollarSign, group: "Financeiro" },
  // Crescimento (Pessoas + Marketing fundidos — mesma intenção: atrair, engajar e apoiar lojistas)
  { key: "app-page", label: "Página do App", icon: Smartphone, group: "Crescimento" },
  { key: "broadcast", label: "Notificações", icon: Megaphone, group: "Crescimento" },
  { key: "coach", label: "Coach Vendas IA", icon: Sparkles, group: "Crescimento" },
  { key: "moderadores", label: "Moderadores", icon: Users, group: "Crescimento" },
  { key: "suporte", label: "Suporte", icon: MessageCircle, group: "Crescimento" },
  // Sistema (Logs virou sub-aba de "Auditoria")
  { key: "sync", label: "Sincronizar", icon: RefreshCw, group: "Sistema" },
  { key: "auditoria", label: "Auditoria", icon: ShieldCheck, group: "Sistema" },
  { key: "whatsapp_plataforma", label: "WhatsApp Plataforma", icon: MessageCircle, group: "Sistema" },
  { key: "juridico", label: "Jurídico", icon: Scale, group: "Sistema" },
];

// Subtítulo padronizado por aba — evita if/else espalhado no header.
const TAB_SUBTITLE: Record<string, (ctx: {
  totalOrders: number;
  pendingWithdrawals: number;
  pendingApprovals: number;
  storesCount: number;
}) => string> = {
  dashboard: (c) => `${c.totalOrders} pedidos no período`,
  atrasados: () => "Pedidos há mais de 60 min sem sair do lugar",
  financeiro: () => "Gestão financeira e repasses",
  saques: (c) => `${c.pendingWithdrawals} solicitação${c.pendingWithdrawals === 1 ? "" : "ões"} pendente${c.pendingWithdrawals === 1 ? "" : "s"}`,
  entrega: () => "Configurações de taxa de entrega",
  approvals: (c) => `${c.pendingApprovals} cadastro${c.pendingApprovals === 1 ? "" : "s"} pendente${c.pendingApprovals === 1 ? "" : "s"}`,
  stores: (c) => `${c.storesCount} lojas cadastradas`,
  cidades: () => "Lojas por cidade",
  pagamentos: () => "Histórico de pagamentos por loja",
  coupons: () => "Gerenciar cupons de desconto",
  juridico: () => "Consulta jurídica e dados arquivados",
  moderadores: () => "Moderadores e sistema de afiliados",
  socios: () => "Divisão de lucros entre sócios",
  sync: () => "Sincronização com banco externo",
  test_finance: () => "Lojas de teste — finanças fictícias isoladas",
  links: () => "Gerenciar botões da página pública /links",
  broadcast: () => "Enviar push notifications em massa",
  coach: () => "Assistente de IA para captar e fechar lojistas",
  planos: () => "Gerenciar planos e assinaturas das lojas",
  "app-page": () => "Página pública do app e links",
  suporte: () => "Painel de suporte ao lojista",
  auditoria: () => "Auditoria, logs e debug",
  whatsapp_plataforma: () => "WhatsApp oficial da plataforma (avisos automáticos)",
};

 import SuperAdminMetricCardTeste from "./super-admin/components/SuperAdminMetricCardTeste";

 const SuperAdminDashboardV2Teste = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Fase 1 — deep link: a tela inicial vem da URL (?aba= & ?secao=).
  const [initialDeepLink] = useState(() => parseSuperAdminDeepLink(`?${searchParams.toString()}`));
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [activeTab, setActiveTab] = useState<AdminTab>(initialDeepLink.tab as AdminTab);
  const [financeFilter, setFinanceFilter] = useState<"week" | "month">("week");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("adminSidebarCollapsed") === "1"; } catch { return false; }
  });
  const [cmdOpen, setCmdOpen] = useState(false);
  const [moreQuery, setMoreQuery] = useState("");
  useEffect(() => {
    try { localStorage.setItem("adminSidebarCollapsed", desktopCollapsed ? "1" : "0"); } catch {}
  }, [desktopCollapsed]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Sub-seções dos grupos unificados
  type FinanceSection =
    | "consolidado"
    | "fluxo"
    | "saques"
    | "areceber"
    | "historico"
    | "conciliacao"
    | "socios"
    | "test"
    | "mensalidades"
    | "planos-lojas"
    | "planos-templates"
    | "addons"
    | "revendedores"
    | "auditoria"
    | "repasses-falha"
    | "comissoes";
  const [financeSection, setFinanceSection] = useState<FinanceSection>(initialDeepLink.financeSection ?? "consolidado");
  type StoresSection = "lojas" | "cidades" | "entrega";
  const [storesSection, setStoresSection] = useState<StoresSection>(initialDeepLink.storesSection ?? "lojas");
  type AppPageSection = "page" | "links";
  const [appPageSection, setAppPageSection] = useState<AppPageSection>(initialDeepLink.appPageSection ?? "page");
  type AuditoriaSection = "auditoria" | "logs" | "debug-loja";
  const [auditoriaSection, setAuditoriaSection] = useState<AuditoriaSection>(initialDeepLink.auditoriaSection ?? "auditoria");

  // Redireciona deep-links de abas antigas para a aba consolidada correspondente
  useEffect(() => {
    const legacyFinance: AdminTab[] = ["pagamentos", "saques", "planos", "socios", "test_finance"];
    const legacyMap: Partial<Record<AdminTab, { tab: AdminTab; apply: () => void }>> = {
      pagamentos:   { tab: "financeiro", apply: () => setFinanceSection("areceber") },
      saques:       { tab: "financeiro", apply: () => setFinanceSection("saques") },
      planos:       { tab: "financeiro", apply: () => setFinanceSection("planos-lojas") },
      socios:       { tab: "financeiro", apply: () => setFinanceSection("socios") },
      test_finance: { tab: "financeiro", apply: () => setFinanceSection("test") },
      cidades:      { tab: "stores",     apply: () => setStoresSection("cidades") },
      entrega:      { tab: "stores",     apply: () => setStoresSection("entrega") },
      links:        { tab: "app-page",   apply: () => setAppPageSection("links") },
      logs:         { tab: "auditoria",  apply: () => setAuditoriaSection("logs") },
    };
    const hit = legacyMap[activeTab];
    if (hit) {
      hit.apply();
      setActiveTab(hit.tab);
    }
    void legacyFinance;
  }, [activeTab]);

  // Fase 1 — deep link: a URL sempre reflete a tela atual (?aba= & ?secao=).
  // Atualizar a página volta no mesmo lugar; dá para compartilhar o link.
  useEffect(() => {
    const next = buildSuperAdminDeepLink({
      tab: activeTab,
      financeSection: activeTab === "financeiro" ? financeSection : undefined,
      storesSection: activeTab === "stores" ? storesSection : undefined,
      appPageSection: activeTab === "app-page" ? appPageSection : undefined,
      auditoriaSection: activeTab === "auditoria" ? auditoriaSection : undefined,
    });
    if (next !== `?${searchParams.toString()}`) {
      setSearchParams(new URLSearchParams(next.slice(1)), { replace: true });
    }
  }, [activeTab, financeSection, storesSection, appPageSection, auditoriaSection, searchParams, setSearchParams]);

  // Memoizado para evitar recriação a cada render (causava re-fetch de queries)
  const getDateRange = useMemo(() => (filter: DateFilter) => {
    const now = new Date();
    let start: Date;
    switch (filter) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "yesterday":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const endOfYesterday = new Date(
          now.getFullYear(), now.getMonth(), now.getDate()
        );
        return {
          start: start.toISOString(),
          end: endOfYesterday.toISOString()
        };
      case "week":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
    }
    return { start: start!.toISOString(), end: new Date().toISOString() };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  // Fase 4 — aceita o período como parâmetro: o Consolidado mostra o
  // período ativo no herói e o outro período na linha de contexto.
  const getFinanceDateRange = (filter: "week" | "month" = financeFilter) => {
    const now = new Date();
    const days = filter === "week" ? 7 : 30;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
    return { start: start.toISOString(), end: now.toISOString() };
  };

  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  // First: get IDs of test stores so we can filter them out everywhere
  const { data: testStoreIds = [] } = useQuery({
    queryKey: ["admin-test-store-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id").eq("is_test", true);
      if (error) throw error;
      return (data || []).map((s: any) => s.id as string);
    },
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-all-orders", dateFilter, testStoreIds.join(",")],
    queryFn: async () => {
      const { start, end } = getDateRange(dateFilter);
      let query = supabase
        .from("orders")
        .select("*, stores(name, id)")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });
      if (testStoreIds.length > 0) query = query.not("store_id", "in", `(${testStoreIds.join(",")})`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: financeOrders, isLoading: financeLoading } = useQuery({
    queryKey: ["finance-orders", financeFilter, testStoreIds.join(",")],
    queryFn: async () => {
      const { start, end } = getFinanceDateRange();
      let query = supabase
        .from("orders")
        .select("*, stores(name, id), order_items(quantity, unit_price), order_source")
        .gte("created_at", start)
        .lte("created_at", end)
        .in("status", ["finalizado", "entregue"])
        .order("created_at", { ascending: false });
      if (testStoreIds.length > 0) query = query.not("store_id", "in", `(${testStoreIds.join(",")})`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && activeTab === "financeiro",
  });

  // Fase 4 — pedidos do OUTRO período (para a linha de contexto do herói
  // do Consolidado: herói em 7 dias mostra o contexto de 30 dias e vice-versa).
  const otherFinanceFilter = financeFilter === "week" ? "month" : "week";
  const { data: financeOrdersOther } = useQuery({
    queryKey: ["finance-orders", otherFinanceFilter, testStoreIds.join(",")],
    queryFn: async () => {
      const { start, end } = getFinanceDateRange(otherFinanceFilter);
      let query = supabase
        .from("orders")
        .select("*, stores(name, id), order_items(quantity, unit_price), order_source")
        .gte("created_at", start)
        .lte("created_at", end)
        .in("status", ["finalizado", "entregue"])
        .order("created_at", { ascending: false });
      if (testStoreIds.length > 0) query = query.not("store_id", "in", `(${testStoreIds.join(",")})`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && activeTab === "financeiro",
  });

  // Fase 4 — repasses com falha (financial_transactions: store_payout com
  // status failed). É a fonte dos 2 repasses do Pastelão (R$ 39,00 cada,
  // 01/07/2026) que o Consolidado mostra em "Precisa de atenção".
  // Não confundir com o dead-letter de pedidos (orders.store_payout_error),
  // que hoje está vazio.
  const { data: failedPayoutRows } = useQuery({
    queryKey: ["finance-failed-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id, store_id, amount, created_at")
        .eq("transaction_kind", "store_payout")
        .eq("status", "failed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && activeTab === "financeiro",
  });

  const { data: adminLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const logs = (data as any[]) || [];
      // Fetch admin names separately — admin_logs.admin_user_id FK aponta pra
      // auth.users, então PostgREST não consegue embutir profiles.full_name.
      const ids = Array.from(new Set(logs.map((l) => l.admin_user_id).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        const map = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
        for (const l of logs) l.profiles = { full_name: map.get(l.admin_user_id) || null };
      }
      return logs;
    },
    enabled: isAdmin && activeTab === "logs",
  });

  const { data: stores } = useQuery({
    queryKey: ["admin-all-stores"],
    queryFn: async () => {
      // 🔒 SELECT específico — evita trazer asaas_wallet_id, asaas_account_id etc.
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, status, commission_rate, delivery_mode, address_city, address_cep, owner_id, is_test, settings, delivery_fee_type, own_delivery_fee");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  const { data: drivers } = useQuery({
    queryKey: ["admin-all-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("user_id, name, is_active");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
    staleTime: 2 * 60 * 1000,
  });

  const { data: storeBalances } = useQuery({
    queryKey: ["store-balances", testStoreIds.join(",")],
    queryFn: async () => {
      let query = supabase.from("store_balances").select("*");
      if (testStoreIds.length > 0) query = query.not("store_id", "in", `(${testStoreIds.join(",")})`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && activeTab === "financeiro",
  });

  const { data: parentStorePlans } = useQuery({
    // 🔒 queryKey unificada — storePlans (linha ~1200) foi removida e usa esta mesma cache
    queryKey: ["admin-store-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_plans").select("*").eq("is_active", true);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isAdmin,
    staleTime: 2 * 60 * 1000, // 2 minutos — planos mudam pouco
  });

  // Compliance alerts
  const { data: complianceAlerts } = useQuery({
    queryKey: ["compliance-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_alerts" as any)
        .select("*, stores:store_id(name)")
        .eq("is_resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isAdmin,
  });

  const { data: withdrawalRequests } = useQuery({
    queryKey: ["withdrawal-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isAdmin,
  });

  const pendingWithdrawals = withdrawalRequests?.filter((w: any) => w.status === "solicitado") || [];

  // Pending approvals (lojistas / motoboys awaiting admin approval)
  const { data: pendingApprovals } = useQuery({
    queryKey: ["admin-pending-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, role, is_approved, created_at")
        .in("role", ["lojista", "motoboy"])
        .eq("is_approved", false);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isAdmin,
    refetchInterval: 60000,
  });
  const pendingApprovalsCount = pendingApprovals?.length ?? 0;

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-withdrawals-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawal_requests" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
          if (payload.eventType === "INSERT") {
            toast.info("🔔 Nova solicitação de saque recebida!", { duration: 8000 });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]); // Remover queryClient das deps - é estável mas força re-subscribe

  // Realtime: notify admin when a new lojista/motoboy registers (pending approval)
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-approvals-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        (payload: any) => {
          const role = payload?.new?.role;
          const approved = payload?.new?.is_approved;
          if ((role === "lojista" || role === "motoboy") && approved === false) {
            queryClient.invalidateQueries({ queryKey: ["admin-pending-approvals"] });
            const name = payload?.new?.full_name || "Novo cadastro";
            const label = role === "lojista" ? "lojista" : "entregador";
            toast.info(`🔔 Novo ${label} aguardando aprovação: ${name}`, {
              duration: 10000,
              action: { label: "Ver", onClick: () => setActiveTab("approvals") },
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-pending-approvals"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]); // queryClient é estável, remover das deps evita re-subscribe

  const getStoreRate = (storeId: string) => {
    const plan = parentStorePlans?.find((p: any) => p.store_id === storeId);
    if (plan) {
      if (plan.plan_type === "fixed") return 0;
      // Garante que a taxa nunca ultrapasse 10% por segurança
      const rate = Number(plan.commission_rate ?? 5);
      const saferate = Math.min(rate, 10);
      return saferate / 100;
    }
    const store = stores?.find((s: any) => s.id === storeId);
    return (Math.min(Number((store as any)?.commission_rate ?? 5), 10)) / 100;
  };

  const metrics = useMemo(() => {
    if (!orders) return { totalSales: 0, commission: 0, commissionDelivery: 0, commissionPdv: 0, activeOrders: 0, totalOrders: 0 };
    const billableOrders = filterBillableOrders(orders);
    const totalSales = sumMoney(billableOrders.map((order) => order.total_price));

    // Separar pedidos por canal
    const deliveryOrders = billableOrders.filter(o => (o as any).order_source !== "pdv");
    const pdvOrders = billableOrders.filter(o => (o as any).order_source === "pdv");

    // Comissão DELIVERY: usa taxa histórica salva no pedido (commission_rate)
    // fallback para getStoreRate para pedidos antigos sem o campo
    const commissionDelivery = sumMoney(deliveryOrders.map((order) => {
      const saved = Number((order as any).commission_rate ?? 0);
      if (saved > 0) return multiplyMoney(order.subtotal, saved / 100);
      return multiplyMoney(order.subtotal, getStoreRate(order.store_id));
    }));

    // Comissão PDV: usa commission_rate do pedido (que é pdv_commission_rate, menor)
    const commissionPdv = sumMoney(pdvOrders.map((order) => {
      const saved = Number((order as any).commission_rate ?? 0);
      return multiplyMoney(order.subtotal, saved / 100);
    }));

    const commission = addMoney(commissionDelivery, commissionPdv);
    const activeStatuses = ["pendente", "preparando", "pronto_para_entrega", "em_transito", "saiu_entrega"];
    const activeOrders = orders.filter(o => activeStatuses.includes(o.status)).length;
    return { totalSales, commission, commissionDelivery, commissionPdv, activeOrders, totalOrders: billableOrders.length };
  }, [orders, stores, parentStorePlans]);

  // Gráficos só com pedidos faturáveis — mesma base do herói. O hook soma
  // tudo que recebe, então passar todos os pedidos (como o original faz)
  // deixava o total dos gráficos maior que o do herói (cancelados dentro).
  const billableOrdersForCharts = useMemo(() => filterBillableOrders(orders || []), [orders]);
  const adminChartData = useFinanceChartData(billableOrdersForCharts);

  // Contexto do herói: os mesmos 7 dias do filtro (mesma janela de
  // getDateRange("week")). Antes era rolante 7x24h e divergia do filtro.
  const { data: weekOrders } = useQuery({
    queryKey: ["admin-week-totals", testStoreIds.join(",")],
    queryFn: async () => {
      const { start, end } = getDateRange("week");
      let query = supabase
        .from("orders")
        .select("total_price, status")
        .gte("created_at", start)
        .lte("created_at", end);
      if (testStoreIds.length > 0) query = query.not("store_id", "in", `(${testStoreIds.join(",")})`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  const weekTotals = useMemo(() => {
    const billable = filterBillableOrders(weekOrders || []);
    const total = sumMoney(billable.map((o: any) => o.total_price));
    const count = billable.length;
    return { total, count, ticket: count > 0 ? total / count : 0 };
  }, [weekOrders]);

  // Fase 4 — liquidação por loja (mesmo cálculo de antes, movido para
  // `@/lib/superAdminConsolidado` para rodar para os dois períodos do
  // herói do Consolidado: o ativo e o outro, da linha de contexto).
  const storeSettlement = useMemo(
    () => computeStoreSettlement(financeOrders, stores, selectedStore, parentStorePlans, getStoreRate),
    [financeOrders, stores, selectedStore, parentStorePlans]
  );
  const storeSettlementOther = useMemo(
    () => computeStoreSettlement(financeOrdersOther, stores, selectedStore, parentStorePlans, getStoreRate),
    [financeOrdersOther, stores, selectedStore, parentStorePlans]
  );

  const driverSettlement = useMemo(() => {
    if (!financeOrders || !drivers) return [];
    const testIds = new Set((stores || []).filter((s: any) => s.is_test).map((s: any) => s.id));
    const map = new Map<string, {
      name: string; driverId: string; totalFees: number; cashFees: number; appFees: number; deliveryCount: number;
    }>();
    drivers.forEach(d => map.set(d.user_id, {
      name: d.name || "Entregador", driverId: d.user_id, totalFees: 0, cashFees: 0, appFees: 0, deliveryCount: 0,
    }));
    financeOrders.forEach(o => {
      if (!o.driver_id) return;
      if (testIds.has(o.store_id)) return;
      const entry = map.get(o.driver_id);
      if (!entry) return;
      const fee = o.delivery_fee;
      entry.totalFees = addMoney(entry.totalFees, fee);
      entry.deliveryCount += 1;
      if (o.payment_method === "dinheiro") entry.cashFees = addMoney(entry.cashFees, fee);
      else entry.appFees = addMoney(entry.appFees, fee);
    });
    return Array.from(map.values()).filter(e => e.deliveryCount > 0).sort((a, b) => b.totalFees - a.totalFees);
  }, [financeOrders, drivers, stores]);

  const financeTotals = useMemo(() => {
    const totals = summarizeSettlement(storeSettlement);
    const totalDriverFees = sumMoney(driverSettlement.map((entry) => entry.appFees));
    return { ...totals, totalDriverFees };
  }, [storeSettlement, driverSettlement, stores, parentStorePlans]);

  // Fase 4 — totais do OUTRO período (linha de contexto do herói).
  const financeTotalsOther = useMemo(
    () => summarizeSettlement(storeSettlementOther),
    [storeSettlementOther]
  );

  // Fase 4 — resumo dos repasses com falha para o "Precisa de atenção".
  const failedPayoutsSummary = useMemo(
    () => summarizeFailedPayouts((failedPayoutRows || []) as any, stores || []),
    [failedPayoutRows, stores]
  );

  const storeConciliation = useMemo(() => {
    if (!orders || !stores) return [];
    // Exclude cancelled and waiting-payment orders
    const billableOrders = orders.filter(o => !["cancelado", "aguardando_pagamento"].includes(o.status));
    const map = new Map<string, { name: string; totalSold: number; commission: number; orders: number }>();
    stores.forEach(s => map.set(s.id, { name: s.name, totalSold: 0, commission: 0, orders: 0 }));
    billableOrders.forEach(o => {
      const entry = map.get(o.store_id);
      if (entry) {
        entry.totalSold = addMoney(entry.totalSold, o.total_price);
        entry.commission = addMoney(entry.commission, multiplyMoney(o.subtotal, getStoreRate(o.store_id)));
        entry.orders += 1;
      }
    });
    return Array.from(map.values()).filter(e => e.orders > 0).sort((a, b) => b.totalSold - a.totalSold);
  }, [orders, stores, parentStorePlans]);

  const hourlyData = useMemo(() => {
    if (!orders) return [];
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, count: 0, revenue: 0 }));
    orders.forEach(o => {
      const h = new Date(o.created_at).getHours();
      hours[h].count += 1;
      hours[h].revenue = addMoney(hours[h].revenue, o.total_price);
    });
    return hours.filter(h => h.count > 0 || (h.hour >= "8h" && h.hour <= "23h"));
  }, [orders]);

  const delayedOrders = useMemo(() => {
    if (!orders) return [];
    const now = Date.now();
    const activeStatuses = ["pendente", "preparando", "pronto_para_entrega"];
    return orders.filter(o => {
      if (!activeStatuses.includes(o.status)) return false;
      return (now - new Date(o.created_at).getTime()) > 60 * 60 * 1000;
    });
  }, [orders]);

  const generateReport = () => {
    const dateLabel = dateFilter === "today" ? "Hoje" : dateFilter === "yesterday" ? "Ontem" : "Últimos 7 dias";
    let report = `📊 *Relatório ${dateLabel} - ItaSuper*\n\n`;
    report += `💰 Faturamento: ${formatBRL(metrics.totalSales)}\n`;
    report += `📦 Pedidos: ${metrics.totalOrders}\n`;
    report += `🏷️ Comissão Plataforma: ${formatBRL(metrics.commission)}\n\n`;
    report += `🏪 *Por Loja:*\n`;
    storeConciliation.forEach(s => {
      report += `• ${s.name}: ${formatBRL(s.totalSold)} (${s.orders} pedidos) — Comissão: ${formatBRL(s.commission)}\n`;
    });
    navigator.clipboard.writeText(report);
    toast.success("Relatório copiado! Cole no WhatsApp.");
  };

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  if (authLoading || isAdminLoading) return null;

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <AlertTriangle className="h-16 w-16 text-amber-500 dark:text-amber-400 mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Acesso Negado</h1>
        <p className="text-sm text-muted-foreground mb-6">Apenas o administrador pode acessar este painel.</p>
        <button onClick={() => navigate("/")} className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl">
          Voltar à Home
        </button>
      </div>
    );
  }

  const filterLabels: Record<DateFilter, string> = { today: "Hoje", yesterday: "Ontem", week: "7 dias" };
  const currentTab = sidebarItems.find(i => i.key === activeTab);

  // Bottom nav tabs (mobile)
  const bottomTabs: { key: AdminTab; label: string; icon: React.ElementType; action?: () => void; isActive?: boolean }[] = [
    { key: "dashboard", label: "Visão Geral", icon: LayoutDashboard },
    { key: "financeiro", label: "Financeiro", icon: DollarSign },
    // Fase 1 — "Saques" abre o Financeiro direto na seção Saques, sem passar
    // pelo redirecionamento de aba legada (o botão antigo dependia dele).
    {
      key: "saques",
      label: "Saques",
      icon: Wallet,
      action: () => { setActiveTab("financeiro"); setFinanceSection("saques"); setShowMoreSheet(false); },
      isActive: activeTab === "financeiro" && financeSection === "saques",
    },
    { key: "stores", label: "Lojas", icon: Store },
  ];

  const moreTabs = sidebarItems.filter(i => !bottomTabs.some(b => b.key === i.key));
  const normalizedMoreQuery = moreQuery.trim().toLowerCase();
  const filteredMoreTabs = normalizedMoreQuery
    ? moreTabs.filter((i) =>
        i.label.toLowerCase().includes(normalizedMoreQuery) ||
        i.group.toLowerCase().includes(normalizedMoreQuery),
      )
    : moreTabs;

  return (
    <div className="min-h-screen bg-background flex">
      {/* ═══ Mobile Bottom Navigation ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-around h-16">
          {bottomTabs.map((tab) => {
            const isActive = tab.isActive ?? activeTab === tab.key;
            const Icon = tab.icon;
            const hasBadge = tab.key === "saques" && pendingWithdrawals.length > 0;
            return (
              <button
                key={tab.key}
                onClick={() => { if (tab.action) tab.action(); else { handleTabChange(tab.key); setShowMoreSheet(false); } }}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative ${
                  isActive ? "bg-primary/10" : ""
                }`}
              >
                <div className="relative">
                  <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  {hasBadge && (
                    <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[8px] font-black min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full animate-pulse">
                      {pendingWithdrawals.length}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-bold ${isActive ? "text-primary" : "text-muted-foreground"}`}>{tab.label}</span>
              </button>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setShowMoreSheet(!showMoreSheet)}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
              showMoreSheet || moreTabs.some(t => t.key === activeTab) ? "bg-primary/10" : ""
            }`}
          >
            <Menu className={`h-5 w-5 ${showMoreSheet || moreTabs.some(t => t.key === activeTab) ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`text-[10px] font-bold ${showMoreSheet || moreTabs.some(t => t.key === activeTab) ? "text-primary" : "text-muted-foreground"}`}>Mais</span>
          </button>
        </div>
      </div>

      {/* ═══ More Sheet (mobile) ═══ */}
      {showMoreSheet && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] lg:hidden" onClick={() => setShowMoreSheet(false)} />
          <div className="fixed bottom-16 left-0 right-0 z-[70] bg-card border-t border-border rounded-t-3xl shadow-2xl lg:hidden animate-in slide-in-from-bottom-4 max-h-[60vh] overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="w-12 h-1 bg-muted-foreground/20 rounded-full mx-auto mt-3 mb-2" />
            <div className="px-4 pt-1 pb-2 sticky top-0 bg-card/95 backdrop-blur-xl z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={moreQuery}
                  onChange={(e) => setMoreQuery(e.target.value)}
                  placeholder="Buscar aba..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="px-4 pb-4 space-y-3">
              {["Início", "Lojas", "Financeiro", "Crescimento", "Sistema"].map((group) => {
                const groupItems = filteredMoreTabs.filter((i) => i.group === group);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group}>
                    <p className="text-[10px] font-extrabold text-muted-foreground/60 uppercase tracking-[0.15em] px-2 mb-1.5">{group}</p>
                    <div className="space-y-1">
                      {groupItems.map((item) => {
                        const isActive = activeTab === item.key;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            onClick={() => { handleTabChange(item.key); setShowMoreSheet(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? "bg-primary-foreground/15" : "bg-muted/50"}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <span>{item.label}</span>
                            {item.key === "approvals" && pendingApprovalsCount > 0 && (
                              <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-black min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full animate-pulse">
                                {pendingApprovalsCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => { navigate("/"); setShowMoreSheet(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground border-t border-border/50 pt-4"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted/50">
                  <ArrowLeft className="h-4 w-4" />
                </div>
                <span>Voltar à Home</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══ Desktop Sidebar ═══ */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-card/95 backdrop-blur-xl border-r border-border/50 flex-col transition-[width] duration-300 ease-out shadow-2xl lg:shadow-none hidden lg:flex ${desktopCollapsed ? "lg:w-[76px]" : "lg:w-[280px]"}`}>
        {/* Brand Header */}
        <div className={`border-b border-border/50 ${desktopCollapsed ? "p-3 flex justify-center" : "p-5"}`}>
          <div className={`flex items-center gap-3 min-w-0 ${desktopCollapsed ? "justify-center" : ""}`}>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
              <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
            </div>
            {!desktopCollapsed && (
              <div className="min-w-0">
                <h1 className="font-black text-sm text-foreground tracking-tight">ItaSuper</h1>
                <p className="text-[10px] text-muted-foreground font-medium">Painel Admin</p>
              </div>
            )}
          </div>
        </div>

        {/* Live Stats Banner */}
        {!desktopCollapsed && (
        <div className="mx-4 mt-4 mb-2">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Resumo {filterLabels[dateFilter]}</span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xl font-black text-foreground leading-none tabular-nums">{metrics.activeOrders}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Pedidos ativos</p>
              </div>
              <div>
                <p className="text-xl font-black text-foreground leading-none tabular-nums">{metrics.totalOrders}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Total pedidos</p>
              </div>
            </div>
            <div className="pt-2 border-t border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10px] text-muted-foreground">Vendas</span>
              </div>
              <span className="text-sm font-black text-foreground tabular-nums">{formatBRL(metrics.totalSales)}</span>
            </div>
          </div>
        </div>
        )}

        {/* Navigation */}
        <TooltipProvider delayDuration={100}>
        <nav className={`flex-1 py-2 overflow-y-auto scrollbar-thin ${desktopCollapsed ? "px-2" : "px-3"}`}>
          {["Início", "Lojas", "Financeiro", "Crescimento", "Sistema"].map((group, groupIdx) => {
            const items = sidebarItems.filter(i => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className={`mb-3 pb-2 ${groupIdx > 0 ? "pt-3 border-t border-border/40" : ""}`}>
                {!desktopCollapsed && (
                  <p className="text-[10px] font-extrabold text-muted-foreground/70 uppercase tracking-[0.15em] px-3 mb-1.5">{group}</p>
                )}
                <div className="space-y-0.5">
                  {items.map(item => {
                    const isActive = activeTab === item.key;
                    const Icon = item.icon;
                    const badgeCount =
                      item.key === "saques" ? pendingWithdrawals.length :
                      item.key === "approvals" ? pendingApprovalsCount :
                      item.key === "dashboard" ? delayedOrders.length :
                      item.key === "atrasados" ? delayedOrders.length : 0;
                    const btn = (
                      <button
                        key={item.key}
                        onClick={() => handleTabChange(item.key)}
                        className={`relative w-full flex items-center rounded-lg text-[13px] font-semibold transition-all duration-150 ${desktopCollapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2.5"} ${
                          isActive
                            ? "bg-primary/10 text-primary before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-primary"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors relative ${
                          isActive ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground"
                        }`}>
                          <Icon className="h-4 w-4" />
                          {desktopCollapsed && badgeCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-black min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full tabular-nums">
                              {badgeCount}
                            </span>
                          )}
                        </div>
                        {!desktopCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                        {!desktopCollapsed && item.key === "saques" && pendingWithdrawals.length > 0 && (
                          <span className="tabular-nums bg-destructive text-destructive-foreground text-[10px] font-black min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full">
                            {pendingWithdrawals.length}
                          </span>
                        )}
                        {!desktopCollapsed && item.key === "approvals" && pendingApprovalsCount > 0 && (
                          <span className="tabular-nums bg-destructive text-destructive-foreground text-[10px] font-black min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full">
                            {pendingApprovalsCount}
                          </span>
                        )}
                        {!desktopCollapsed && item.key === "dashboard" && delayedOrders.length > 0 && (
                          <span className="tabular-nums bg-destructive text-destructive-foreground text-[10px] font-black min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full">
                            {delayedOrders.length}
                          </span>
                        )}
                        {!desktopCollapsed && item.key === "atrasados" && delayedOrders.length > 0 && (
                          <span className="tabular-nums bg-destructive text-destructive-foreground text-[10px] font-black min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full">
                            {delayedOrders.length}
                          </span>
                        )}
                        {!desktopCollapsed && item.key === "dashboard" && complianceAlerts && complianceAlerts.length > 0 && delayedOrders.length === 0 && (
                          <span className="text-amber-600 dark:text-amber-400 text-sm leading-none">⚠</span>
                        )}
                      </button>
                    );
                    if (desktopCollapsed) {
                      return (
                        <Tooltip key={item.key}>
                          <TooltipTrigger asChild>{btn}</TooltipTrigger>
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                      );
                    }
                    return btn;
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        </TooltipProvider>

        {/* Bottom Stats & Actions */}
        <div className={`border-t border-border/50 space-y-3 ${desktopCollapsed ? "p-2" : "p-4"}`}>
          {!desktopCollapsed && (
          <div className="bg-muted/30 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground flex-1">Lojas</span>
              <span className="text-xs font-black text-foreground bg-accent px-2 py-0.5 rounded-md tabular-nums">{stores?.length || 0}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bike className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground flex-1">Entregadores</span>
              <span className="text-xs font-black text-foreground bg-accent px-2 py-0.5 rounded-md tabular-nums">{drivers?.length || 0}</span>
            </div>
          </div>
          )}
          <button
            onClick={() => setDesktopCollapsed(v => !v)}
            className="w-full py-2 rounded-xl text-xs font-bold border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all flex items-center justify-center gap-2"
            aria-label={desktopCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {desktopCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <><PanelLeftClose className="h-3.5 w-3.5" /> Recolher</>}
          </button>
          <button
            onClick={() => navigate("/")}
            className={`w-full py-2.5 rounded-xl text-xs font-bold border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all flex items-center justify-center gap-2 ${desktopCollapsed ? "px-0" : ""}`}
            aria-label="Voltar à Home"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {!desktopCollapsed && "Voltar à Home"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col pb-20 lg:pb-0">
        {/* Top bar — Mobile header */}
        <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile: show brand + current tab */}
            <div className="lg:hidden flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
                <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-foreground text-sm truncate">{currentTab?.label || "Dashboard"} <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 align-middle">Teste</span></h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{formatBRL(metrics.totalSales)}</span>
                  {metrics.activeOrders > 0 && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">{metrics.activeOrders} ativos</span>
                  )}
                </div>
              </div>
            </div>
            {/* Desktop: tab title */}
            <div className="hidden lg:block">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-foreground text-lg">{currentTab?.label || "Dashboard"}</h2>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Teste</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {TAB_SUBTITLE[activeTab]?.({
                  totalOrders: metrics.totalOrders,
                  pendingWithdrawals: pendingWithdrawals.length,
                  pendingApprovals: pendingApprovalsCount,
                  storesCount: stores?.length || 0,
                }) || " "}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* ⌘K global search — desktop */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden lg:inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/60 text-xs text-muted-foreground transition-colors"
              aria-label="Buscar (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Buscar…</span>
              <kbd className="ml-2 px-1.5 py-0.5 rounded bg-background border border-border/60 text-[10px] font-mono tabular-nums">⌘K</kbd>
            </button>
            {activeTab === "dashboard" && (
              <button
                onClick={generateReport}
                className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copiar Relatório</span>
              </button>
            )}
            {pendingWithdrawals.length > 0 && activeTab !== "saques" && (
              <button
                onClick={() => handleTabChange("saques")}
                className="relative p-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 transition-colors lg:hidden"
              >
                <Bell className="h-4 w-4 text-destructive" />
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full tabular-nums">
                  {pendingWithdrawals.length}
                </span>
              </button>
            )}
            {pendingApprovalsCount > 0 && activeTab !== "approvals" && (
              <button
                onClick={() => handleTabChange("approvals")}
                className="relative p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 transition-colors lg:hidden"
                aria-label="Cadastros pendentes"
              >
                <Shield className="h-4 w-4 text-amber-600" />
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full tabular-nums">
                  {pendingApprovalsCount}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-6xl mx-auto">
            {/* Banner unificado de pendências */}
            {(pendingWithdrawals.length > 0 || pendingApprovalsCount > 0) &&
              activeTab !== "approvals" && activeTab !== "saques" && activeTab !== "financeiro" && (
                <div className="mb-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex flex-wrap items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 mr-1">Pendências:</span>
                  {pendingApprovalsCount > 0 && (
                    <button
                      onClick={() => handleTabChange("approvals")}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25 transition-colors inline-flex items-center gap-1.5"
                    >
                      <Shield className="h-3 w-3" />
                      {pendingApprovalsCount} cadastro{pendingApprovalsCount === 1 ? "" : "s"}
                    </button>
                  )}
                  {pendingWithdrawals.length > 0 && (
                    <button
                      onClick={() => handleTabChange("financeiro")}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors inline-flex items-center gap-1.5"
                    >
                      <Wallet className="h-3 w-3" />
                      {pendingWithdrawals.length} saque{pendingWithdrawals.length === 1 ? "" : "s"}
                    </button>
                  )}
                </div>
              )}
            {/* Fase 1 — Pedidos atrasados: o número do card "Atraso" vira lista.
                Usa os mesmos pedidos já carregados do dashboard (período do filtro). */}
            {activeTab === "atrasados" && (
              <div>
                <div className="bg-card rounded-2xl border border-border p-4 mb-4">
                  <p className="text-sm font-bold text-foreground">
                    {delayedOrders.length} pedido{delayedOrders.length === 1 ? "" : "s"} atrasado{delayedOrders.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Em andamento há mais de 60 min — período: {filterLabels[dateFilter]}. O mais parado aparece primeiro.
                  </p>
                </div>
                {delayedOrders.length === 0 ? (
                  <div className="bg-card rounded-2xl border border-border p-8 text-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-foreground">Nenhum pedido atrasado</p>
                    <p className="text-xs text-muted-foreground">Nada parado há mais de 60 min neste período.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...delayedOrders]
                      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((o: any) => {
                        const waitMin = Math.max(0, Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000));
                        const waitLabel = waitMin >= 60 ? `${Math.floor(waitMin / 60)}h ${String(waitMin % 60).padStart(2, "0")}min` : `${waitMin} min`;
                        const statusLabel = o.status === "pendente" ? "Pendente" : o.status === "preparando" ? "Em preparo" : o.status === "pronto_para_entrega" ? "Pronto p/ entrega" : o.status;
                        return (
                          <div key={o.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-foreground truncate">{o.stores?.name || "Loja"}</p>
                              <p className="text-xs text-muted-foreground">
                                #{String(o.id).slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 whitespace-nowrap">{statusLabel}</span>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-bold text-foreground">{formatBRL(o.total_price || 0)}</p>
                              <p className="text-xs font-bold text-destructive">há {waitLabel}</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
            {activeTab === "approvals" && <AdminApprovals />}
            {activeTab === "entrega" && <DeliveryFeeConfigPanel />}
            {activeTab === "sync" && <Suspense fallback={<TabFallback />}><SyncExternalTab /></Suspense>}
            {activeTab === "coupons" && <CouponManager isAdmin />}
            {activeTab === "stores" && (
              <div className="space-y-4">
                <SubTabsBar
                  value={storesSection}
                  onChange={(v) => setStoresSection(v as StoresSection)}
                  items={[
                    { key: "lojas", label: "Gestão", icon: Store },
                    { key: "cidades", label: "Cidades", icon: MapPin },
                    { key: "entrega", label: "Entrega", icon: Truck },
                  ]}
                />
                {storesSection === "lojas" && (
                  <div className="space-y-6">
                    <TestStoreCreator />
                    <AdminStoreManager />
                  </div>
                )}
                {storesSection === "cidades" && (
                  <Suspense fallback={<TabFallback />}><CidadesTab stores={stores} /></Suspense>
                )}
                {storesSection === "entrega" && <DeliveryFeeConfigPanel />}
              </div>
            )}
            {activeTab === "planos" && <AdminPlanManager />}
            {activeTab === "pagamentos" && <Suspense fallback={<TabFallback />}><PagamentosSplitTabTeste stores={stores || []} /></Suspense>}
            {activeTab === "juridico" && <Suspense fallback={<TabFallback />}><JuridicoTab /></Suspense>}
            {activeTab === "moderadores" && <ModeratorManager />}
            {activeTab === "suporte" && <SupportAdminPanel />}
            {activeTab === "app-page" && (
              <div className="space-y-4">
                <SubTabsBar
                  value={appPageSection}
                  onChange={(v) => setAppPageSection(v as AppPageSection)}
                  items={[
                    { key: "page", label: "Página do App", icon: Smartphone },
                    { key: "links", label: "Página /links", icon: LinkIcon },
                  ]}
                />
                {appPageSection === "page" && <AppStorePageAdmin />}
                {appPageSection === "links" && <AppLinksManager />}
              </div>
            )}
            {activeTab === "socios" && <PartnerSplitPanel />}
            {activeTab === "test_finance" && <TestStoreFinancePanel />}
            {activeTab === "links" && <AppLinksManager />}
            {activeTab === "broadcast" && <AdminBroadcastPush />}
            {activeTab === "coach" && <SalesCoachPanel />}
            {activeTab === "whatsapp_plataforma" && <Suspense fallback={<TabFallback />}><PlatformWhatsAppTab /></Suspense>}
            {activeTab === "auditoria" && (
              <div className="space-y-4">
                <SubTabsBar
                  value={auditoriaSection}
                  onChange={(v) => setAuditoriaSection(v as AuditoriaSection)}
                  items={[
                    { key: "auditoria", label: "Auditoria", icon: ShieldCheck },
                    { key: "logs", label: "Logs", icon: FileText },
                    { key: "debug-loja", label: "Debug Loja", icon: AlertTriangle },
                  ]}
                />
                {auditoriaSection === "auditoria" && (
                  <Suspense fallback={<TabFallback />}><AuditoriaTab /></Suspense>
                )}
                {auditoriaSection === "debug-loja" && (
                  <Suspense fallback={<TabFallback />}><DebugLojaTab /></Suspense>
                )}
                {auditoriaSection === "logs" && (
                  <div className="space-y-4">
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted/30">
                    <h3 className="font-bold flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Histórico de Ações Administrativas
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm tabular-nums">
                      <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Admin</th>
                          <th className="px-4 py-3">Ação</th>
                          <th className="px-4 py-3">Alvo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {logsLoading ? (
                          Array.from({ length: 6 }).map((_, i) => (
                            <tr key={`sk-${i}`} className={i % 2 ? "bg-muted/20" : ""}>
                              <td className="px-4 py-3"><div className="h-3 w-32 rounded bg-muted animate-pulse" /></td>
                              <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-muted animate-pulse" /></td>
                              <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-muted animate-pulse" /></td>
                              <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted animate-pulse" /></td>
                            </tr>
                          ))
                        ) : adminLogs?.map((log, i) => (
                          <tr key={log.id} className={`hover:bg-muted/40 transition-colors ${i % 2 ? "bg-muted/20" : ""}`}>
                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                              {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {log.profiles?.full_name || "Admin"}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                {log.action}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold capitalize">{log.target_type}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{log.target_id?.substring(0, 8)}…</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!logsLoading && (!adminLogs || adminLogs.length === 0) && (
                          <tr>
                            <td colSpan={4} className="px-4 py-12">
                              <div className="flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
                                <FileText className="h-8 w-8 opacity-40" />
                                <p className="text-sm font-bold text-foreground">Nenhum log ainda</p>
                                <p className="text-xs">Ações administrativas aparecerão aqui.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                  </div>
                )}
              </div>
            )}
             {activeTab === "financeiro" && (
               <div className="space-y-4">
                 {/* Fase 4 — navegação redesenhada: os 5 grupos com as 14
                     sub-seções em chips que quebram linha, tudo visível de
                     uma vez (sem as 5 fileiras de rolagem horizontal).
                     O gateway saiu do topo: agora vive no cartão próprio
                     dentro do Consolidado. */}
                 <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                   {FINANCE_GROUPS.map((g) => (
                     <div key={g.group}>
                       <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 px-1">
                         {g.group}
                       </p>
                       <div className="flex flex-wrap gap-2">
                         {g.items.map((it) => {
                           const isActive = financeSection === it.key;
                           return (
                             <button
                               key={it.key}
                               onClick={() => setFinanceSection(it.key as FinanceSection)}
                               className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-colors ${
                                 isActive
                                   ? "bg-primary text-primary-foreground shadow-sm"
                                   : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                               }`}
                             >
                               <span>{it.label}</span>
                               {it.key === "saques" && pendingWithdrawals.length > 0 && (
                                 <span className={`ml-1 text-[10px] font-black rounded-full px-1.5 py-0.5 ${isActive ? "bg-primary-foreground/20" : "bg-destructive text-destructive-foreground"}`}>
                                   {pendingWithdrawals.length}
                                 </span>
                               )}
                             </button>
                           );
                         })}
                       </div>
                     </div>
                   ))}
                 </div>
                 {/* Fase 2 — cabeçalho padronizado da seção ativa (rótulo + o que ela mostra). */}
                 {(() => {
                   const item = FINANCE_GROUPS.flatMap((g) => g.items).find((it) => it.key === financeSection);
                   if (!item) return null;
                   const SectionIcon = item.icon;
                   return (
                     <div className="flex items-start gap-2.5 px-1 pt-1">
                       <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                         <SectionIcon className="h-4 w-4 text-primary" />
                       </span>
                       <div>
                         <h2 className="text-sm font-black text-foreground">{item.label}</h2>
                         <p className="text-xs text-muted-foreground">{item.desc}</p>
                       </div>
                     </div>
                   );
                 })()}
                 {financeSection === "consolidado" && (
                   <Suspense fallback={<TabFallback />}>
                     <ConsolidadoTabTeste
                       storeBalances={storeBalances || []}
                       parentStorePlans={parentStorePlans || []}
                       stores={stores || []}
                       testStoreIds={testStoreIds}
                       financeTotals={financeTotals}
                       financeTotalsOther={financeTotalsOther}
                       financeFilter={financeFilter}
                       onFinanceFilterChange={setFinanceFilter}
                       failedPayouts={failedPayoutsSummary}
                       pendingWithdrawalsCount={pendingWithdrawals.length}
                       onGoToSection={(s: string) => setFinanceSection(s as FinanceSection)}
                       loading={financeLoading}
                     />
                   </Suspense>
                 )}
                 {financeSection === "saques" && (
                   <Suspense fallback={<TabFallback />}>
                     <SaquesTab
                       withdrawalRequests={withdrawalRequests}
                       pendingWithdrawals={pendingWithdrawals}
                       drivers={drivers}
                       queryClient={queryClient}
                     />
                   </Suspense>
                 )}
                 {/* Fase 2 — telas resgatadas: antes só existiam numa aba antiga sem link. */}
                 {financeSection === "repasses-falha" && (
                   <Suspense fallback={<TabFallback />}><PagamentosSplitTabTeste stores={stores || []} /></Suspense>
                 )}
                 {financeSection === "comissoes" && (
                   <Suspense fallback={<TabFallback />}><ComissoesPanel /></Suspense>
                 )}
                 {financeSection === "areceber" && (
                   <Suspense fallback={<TabFallback />}><AReceberTab /></Suspense>
                 )}
                 {financeSection === "historico" && (
                   <Suspense fallback={<TabFallback />}><HistoricoRepassesTab /></Suspense>
                 )}
                 {financeSection === "socios" && <PartnerSplitPanel />}
                 {financeSection === "test" && <TestStoreFinancePanel />}
                 {financeSection === "fluxo" && (
                   <Suspense fallback={<TabFallback />}><FluxoCaixaPanel /></Suspense>
                 )}
                 {financeSection === "conciliacao" && (
                   <Suspense fallback={<TabFallback />}><ConciliacaoAsaasPanel /></Suspense>
                 )}
                 {financeSection === "auditoria" && (
                   <Suspense fallback={<TabFallback />}><AuditoriaFinanceiraPanel /></Suspense>
                 )}
                  {financeSection === "mensalidades" && (
                    <Suspense fallback={<TabFallback />}><MensalidadesPanel /></Suspense>
                  )}
                  {financeSection === "planos-lojas" && <AdminPlanManager />}
                  {financeSection === "planos-templates" && <AdminPlanTemplatesEditor />}
                   {financeSection === "addons" && (
                     <Suspense fallback={<TabFallback />}><AddonsMrrTab /></Suspense>
                   )}
                   {financeSection === "revendedores" && (
                     <Suspense fallback={<TabFallback />}><RevendedoresTab /></Suspense>
                   )}
               </div>
             )}
                          {activeTab === "dashboard" && (
               <div className="space-y-6">
                 {/* Período — filtro rotulado */}
                 <div className="flex items-center gap-2">
                   <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Período</span>
                   <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-xl">
                     {(["today", "yesterday", "week"] as DateFilter[]).map(f => (
                       <button
                         key={f}
                         onClick={() => setDateFilter(f)}
                         className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                           dateFilter === f
                             ? "bg-background text-foreground shadow-sm"
                             : "text-muted-foreground hover:text-foreground"
                         }`}
                       >
                         {filterLabels[f]}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* Herói — vendas do período */}
                 <div className="bg-card rounded-2xl border border-border p-5">
                   <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Vendas {filterLabels[dateFilter].toLowerCase()}</p>
                   <p className="text-4xl font-black text-primary tabular-nums leading-tight mt-1">{formatBRL(metrics.totalSales)}</p>
                   <p className="text-sm text-muted-foreground mt-1">
                     {metrics.totalOrders} pedidos · Ticket médio {formatBRL(metrics.totalOrders > 0 ? metrics.totalSales / metrics.totalOrders : 0)}
                   </p>
                   {dateFilter !== "week" && (
                     <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/60">
                       Nos últimos 7 dias: <b className="text-foreground">{formatBRL(weekTotals.total)}</b> em <b className="text-foreground">{weekTotals.count} pedidos</b> · Ticket médio <b className="text-foreground">{formatBRL(weekTotals.ticket)}</b>
                     </p>
                   )}
                 </div>

                 {/* Apoio — comissão, ativos e atraso */}
                 <div className="grid grid-cols-3 gap-3">
                   <SuperAdminMetricCardTeste icon={TrendingUp} label="Comissão" value={formatBRL(metrics.commission)} sublabel={`Delivery ${formatBRL(metrics.commissionDelivery)}`} sublabel2={`PDV ${formatBRL(metrics.commissionPdv)}`} highlight />
                   <SuperAdminMetricCardTeste icon={Clock} label="Ativos" value={String(metrics.activeOrders)} sublabel="em andamento" />
                   <SuperAdminMetricCardTeste icon={AlertTriangle} label="Atraso" value={String(delayedOrders.length)} sublabel="mais de 60 min" alert={delayedOrders.length > 0} onClick={() => handleTabChange("atrasados")} />
                 </div>

                 {/* Precisa de atenção */}
                 <section>
                   <h2 className="text-sm font-bold text-foreground mb-3">Precisa de atenção</h2>
                   {delayedOrders.length === 0 && pendingWithdrawals.length === 0 ? (
                     <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
                       <CheckCircle2 className="h-4 w-4 shrink-0" /> Tudo em dia — nenhum pedido atrasado e nenhum saque pendente.
                     </p>
                   ) : (
                     <div className="space-y-3">
                       {delayedOrders.length > 0 && (
                         <div className="flex items-center gap-3 bg-destructive/5 border border-destructive/30 rounded-2xl px-4 py-3">
                           <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                           <div className="min-w-0 flex-1">
                             <p className="text-sm font-bold text-foreground">{delayedOrders.length} {delayedOrders.length === 1 ? "pedido atrasado" : "pedidos atrasados"}</p>
                             <p className="text-xs text-muted-foreground">Parados há mais de 60 min.</p>
                           </div>
                           <button onClick={() => handleTabChange("atrasados")} className="shrink-0 text-xs font-bold text-destructive bg-destructive/10 px-3 py-2 rounded-xl">Ver atrasados</button>
                         </div>
                       )}
                       {pendingWithdrawals.length > 0 && (
                         <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
                           <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                           <div className="min-w-0 flex-1">
                             <p className="text-sm font-bold text-foreground">{pendingWithdrawals.length} {pendingWithdrawals.length === 1 ? "saque pendente" : "saques pendentes"}</p>
                             <p className="text-xs text-muted-foreground">Aguardando aprovação.</p>
                           </div>
                           <button onClick={() => { handleTabChange("financeiro"); setFinanceSection("saques"); }} className="shrink-0 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-3 py-2 rounded-xl">Ver saques</button>
                         </div>
                       )}
                     </div>
                   )}
                 </section>

                 {/* Evolução — sempre visível, com estado vazio */}
                 <section>
                   <div className="flex items-center justify-between mb-3">
                     <h2 className="text-sm font-bold text-foreground">Evolução — Delivery vs PDV</h2>
                     <div className="text-[10px] text-muted-foreground flex gap-3">
                       <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Delivery</span>
                       <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />PDV</span>
                     </div>
                   </div>
                   <div className="bg-card rounded-2xl border border-border p-4">
                     {adminChartData.dailyData.length > 0 ? (
                       <>
                         <div className="h-44">
                           <Suspense fallback={null}>
                             <DailySalesChart data={adminChartData.dailyData} showPdv={adminChartData.totalPdv > 0} />
                           </Suspense>
                         </div>
                         <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/30 text-center">
                           <div><p className="text-[10px] text-muted-foreground">Delivery</p><p className="text-sm font-black text-primary">{formatBRL(adminChartData.totalDelivery)}</p></div>
                           <div className="border-x border-border/30"><p className="text-[10px] text-muted-foreground">PDV</p><p className="text-sm font-black text-sky-600 dark:text-sky-400 tabular-nums">{formatBRL(adminChartData.totalPdv)}</p></div>
                           <div><p className="text-[10px] text-muted-foreground">Ticket Médio</p><p className="text-sm font-black text-foreground">{formatBRL(adminChartData.ticketMedio)}</p></div>
                         </div>
                       </>
                     ) : (
                       <p className="text-sm text-muted-foreground py-6 text-center">Sem vendas neste período.</p>
                     )}
                   </div>
                 </section>

                 {/* Pagamento e horário */}
                 <div className="grid lg:grid-cols-2 gap-4">
                   <section>
                     <h2 className="text-sm font-bold text-foreground mb-3">Formas de pagamento</h2>
                     <div className="bg-card rounded-2xl border border-border p-4">
                       {adminChartData.paymentData.length > 0 ? (
                         <Suspense fallback={null}>
                           <PaymentBreakdownChart data={adminChartData.paymentData} />
                         </Suspense>
                       ) : (
                         <p className="text-sm text-muted-foreground py-6 text-center">Sem vendas neste período.</p>
                       )}
                     </div>
                   </section>
                   <section>
                     <h2 className="text-sm font-bold text-foreground mb-3">Horário de pico</h2>
                     <div className="bg-card rounded-2xl border border-border p-4">
                       <Suspense fallback={null}>
                         <HourlyChart data={adminChartData.hourlyData} />
                       </Suspense>
                     </div>
                   </section>
                 </div>

                 {/* Visitas + onde olham */}
                 <PageViewsCardTeste />
               </div>
             )}
          </div>
        </div>
      </main>

      {/* ⌘K Command Palette — Fase 1: abas + lojas + ações */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Buscar abas, lojas e ações…" />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          {["Início", "Lojas", "Financeiro", "Crescimento", "Sistema"].map(group => {
            const items = sidebarItems.filter(i => i.group === group);
            if (items.length === 0) return null;
            return (
              <CommandGroup key={group} heading={group}>
                {items.map(item => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.key}
                      value={`${item.label} ${group}`}
                      onSelect={() => { handleTabChange(item.key); setCmdOpen(false); }}
                    >
                      <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{item.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
          <CommandGroup heading="Lojas">
            {(stores || []).map((store: any) => (
              <CommandItem
                key={store.id}
                value={`loja ${store.name}`}
                onSelect={() => { handleTabChange("stores"); setCmdOpen(false); }}
              >
                <Store className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{store.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Ações">
            <CommandItem value="Novo cupom" onSelect={() => { handleTabChange("coupons"); setCmdOpen(false); }}>
              <Ticket className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>Novo cupom</span>
            </CommandItem>
            <CommandItem value="Pedidos atrasados" onSelect={() => { handleTabChange("atrasados"); setCmdOpen(false); }}>
              <AlertTriangle className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>Pedidos atrasados</span>
            </CommandItem>
            <CommandItem value="Enviar notificação" onSelect={() => { handleTabChange("broadcast"); setCmdOpen(false); }}>
              <Megaphone className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>Enviar notificação</span>
            </CommandItem>
            <CommandItem value="Gerar cobrança de plano" onSelect={() => { handleTabChange("financeiro"); setFinanceSection("planos-lojas"); setCmdOpen(false); }}>
              <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>Gerar cobrança de plano</span>
            </CommandItem>
            <CommandItem value="Copiar relatório" onSelect={() => { generateReport(); setCmdOpen(false); }}>
              <Copy className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>Copiar relatório</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
};

// ─── Metric Card ───





export default SuperAdminDashboardV2Teste;
