import { useEffect, useState, useRef, useCallback, useMemo, memo, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import {
  Clock, CheckCircle2, ListOrdered, Bike, LayoutDashboard,
  Settings, Banknote, CreditCard, UtensilsCrossed, Plus, CircleDot,
   BarChart3, Star, AlertTriangle, GraduationCap, Menu, VolumeX, Volume2, Bell,
   MoreHorizontal
} from "lucide-react";

import SignOutConfirm from "@/components/SignOutConfirm";
import SimulationBanner from "@/components/SimulationBanner";
import TrialExpiredGuard from "@/components/TrialExpiredGuard";
 import { useStorePlan } from "@/hooks/useStorePlan";
 import { AdminProvider, AdminContextType } from "./admin/AdminContext";
 import {
   Sheet,
   SheetContent,
   SheetHeader,
   SheetTitle,
 } from "@/components/ui/sheet";
import { formatBRL } from "@/lib/utils";
import { notifyOrderStatusChange } from "@/lib/orderNotifications";
import { printThermalReceipt } from "@/lib/thermalPrint";
import { requestNotificationPermission, notifyNewOrder } from "@/lib/notifications";

// Lazy-loaded tabs
const DashboardTab = lazy(() => import("./admin/tabs/DashboardTab"));
const OrdersTab = lazy(() => import("./admin/tabs/OrdersTab"));
const ReportsTab = lazy(() => import("./admin/tabs/ReportsTab"));
const FinanceTab = lazy(() => import("./admin/tabs/FinanceTab"));
const ClientsTab = lazy(() => import("./admin/tabs/ClientsTab"));
const LoyaltyTab = lazy(() => import("./admin/tabs/LoyaltyTab"));
const SettingsTab = lazy(() => import("./admin/tabs/SettingsTab"));
const MenuTab = lazy(() => import("./admin/tabs/MenuTab"));
const AddonsTab = lazy(() => import("./admin/tabs/AddonsTab"));
const BordasTab = lazy(() => import("./admin/tabs/BordasTab"));
const HoursTab = lazy(() => import("./admin/tabs/HoursTab"));
const DriversTab = lazy(() => import("./admin/tabs/DriversTab"));
 const TutoriaisTab = lazy(() => import("./admin/tabs/TutoriaisTab"));
 const AdminRefundPanel = lazy(() => import("@/components/AdminRefundPanel"));

export type OrderStatus = "pendente" | "preparando" | "pronto_para_entrega" | "saiu_entrega" | "em_transito" | "entregue" | "finalizado";
export type OrderTabKey = OrderStatus | "delivery";
 export type DashboardTabType = "dashboard" | "orders" | "menu" | "addons" | "bordas" | "hours" | "settings" | "finance" | "clients" | "reports" | "subscription" | "loyalty" | "drivers" | "refunds" | "tutoriais";
 
 const NAV_ITEMS = [
   { id: "dashboard", label: "Visão Geral", icon: LayoutDashboard, showInSidebar: true, showInBottomNav: true, showInMore: false },
   { id: "orders", label: "Pedidos", icon: ListOrdered, showInSidebar: true, showInBottomNav: true, showInMore: false },
   { id: "menu", label: "Cardápio", icon: UtensilsCrossed, showInSidebar: true, showInBottomNav: true, showInMore: false },
   { id: "clients", label: "Clientes", icon: Star, showInSidebar: true, showInBottomNav: false, showInMore: true },
   { id: "finance", label: "Financeiro", icon: Banknote, showInSidebar: true, showInBottomNav: false, showInMore: true },
   { id: "refunds", label: "Reembolsos", icon: AlertTriangle, showInSidebar: true, showInBottomNav: false, showInMore: true },
   { id: "reports", label: "Relatórios", icon: BarChart3, showInSidebar: true, showInBottomNav: false, showInMore: true },
   { id: "loyalty", label: "Fidelidade", icon: CreditCard, showInSidebar: true, showInBottomNav: false, showInMore: true },
   { id: "drivers", label: "Entregadores", icon: Bike, showInSidebar: true, showInBottomNav: false, showInMore: true },
   { id: "tutoriais", label: "Tutoriais", icon: GraduationCap, showInSidebar: true, showInBottomNav: false, showInMore: true },
   { id: "addons", label: "Complementos", icon: Plus, showInSidebar: false, showInBottomNav: false, showInMore: true },
   { id: "bordas", label: "Bordas", icon: CircleDot, showInSidebar: false, showInBottomNav: false, showInMore: true },
   { id: "hours", label: "Horários", icon: Clock, showInSidebar: false, showInBottomNav: false, showInMore: true },
   { id: "settings", label: "Configurações", icon: Settings, showInSidebar: true, showInBottomNav: true, showInMore: false },
 ];

const ALERT_SOUND_URL = "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const simulateStoreId = searchParams.get("storeId");
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [activeTab, setActiveTab] = useState<OrderTabKey>("pendente");
  const [dashboardTab, setDashboardTab] = useState<DashboardTabType>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showDelayedPanel, setShowDelayedPanel] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [showSoundPrompt, setShowSoundPrompt] = useState(true);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const isApproved = profile?.is_approved ?? false;

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["admin-store", user?.id, simulateStoreId],
    queryFn: async () => {
      if (simulateStoreId) {
        const { data } = await supabase.from("stores").select("*").eq("id", simulateStoreId).maybeSingle();
        return data;
      }
      const { data } = await supabase.from("stores").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const storePlan = useStorePlan(store?.id);

  const { data: orders } = useQuery({
    queryKey: ["admin-orders", store?.id],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*, order_items(*, products(*))").eq("store_id", store!.id).order("created_at", { ascending: false }).limit(100);
      return data;
    },
    enabled: !!store?.id,
    refetchInterval: 10000,
  });

  const updateOrderStatus = async (id: string, status: OrderStatus) => {
    try {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
      toast.success("Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      notifyOrderStatusChange(id, status);
    } catch (err) {
      toast.error("Erro ao atualizar status");
    }
  };

  const toggleStoreOpen = async () => {
    if (!store) return;
    try {
      const { error } = await supabase.from("stores").update({ is_open: !store.is_open }).eq("id", store.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-store"] });
      toast.success(store.is_open ? "Loja pausada" : "Loja aberta!");
    } catch (err) {
      toast.error("Erro ao alterar status da loja");
    }
  };

  const pendingCount = orders?.filter(o => o.status === "pendente").length || 0;
  const preparingCount = orders?.filter(o => o.status === "preparando").length || 0;
  const readyCount = orders?.filter(o => o.status === "pronto_para_entrega").length || 0;
  
  const todayTotal = useMemo(() => {
    const today = new Date().toDateString();
    return orders?.filter(o => new Date(o.created_at).toDateString() === today && o.status !== "cancelado")
      .reduce((acc, o) => acc + Number(o.total_price), 0) || 0;
  }, [orders]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return orders?.filter(o => new Date(o.created_at).toDateString() === today && o.status !== "cancelado").length || 0;
  }, [orders]);

  const activateSound = () => {
    setSoundEnabled(true);
    setShowSoundPrompt(false);
    if (!audioRef.current) {
      audioRef.current = new Audio(ALERT_SOUND_URL);
    }
    audioRef.current.play().catch(() => {});
  };

  const contextValue: AdminContextType = {
    store, orders, todayTotal, todayCount, pendingCount, preparingCount, readyCount,
    avgDeliveryTime: 0, clientAnalytics: [], isApproved, profileLoading, storeLoading,
    isOwnDelivery: store?.delivery_mode === "own", hasLinkedDrivers: false,
    driversLoading: false, onlineDrivers: [], activeTab, setActiveTab,
    dashboardTab, setDashboardTab, updateOrderStatus, toggleStoreOpen,
    getClientName: (id) => id.slice(0, 8), getDriverName: (id) => "Motoboy",
    getMainAction: (status: string) => null,
    paymentIcons: { pix: "⚡", cartao: "💳", dinheiro: "💵" },
    paymentLabels: { pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro" },
    storePlan, allHoursClosed: false, delayedOrders: [], showDelayedPanel,
    setShowDelayedPanel, toggleBatchOrder: () => {}, batchSelected, setBatchSelected
  };

  const handleTabChange = (tab: DashboardTabType) => {
    setDashboardTab(tab);
    setSidebarOpen(false);
    setShowMoreSheet(false);
  };

  const renderTab = () => {
    switch (dashboardTab) {
      case "dashboard": return <DashboardTab />;
      case "orders": return <OrdersTab />;
      case "reports": return <ReportsTab />;
      case "finance": return <FinanceTab />;
      case "clients": return <ClientsTab />;
      case "loyalty": return <LoyaltyTab />;
      case "settings": return <SettingsTab />;
      case "menu": return <MenuTab />;
      case "addons": return <AddonsTab />;
      case "bordas": return <BordasTab />;
      case "hours": return <HoursTab />;
      case "drivers": return <DriversTab />;
      case "tutoriais": return <TutoriaisTab />;
      default: return <DashboardTab />;
    }
  };

  return (
    <AdminProvider value={contextValue}>
      <TrialExpiredGuard storePlan={storePlan} storeId={store?.id || ""}>
        <div className="min-h-screen bg-background flex">
          <SimulationBanner />
          
          {/* Sidebar Overlay */}
          {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

          {/* Sidebar */}
          <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="flex flex-col h-full">
              <div className="p-6">
                <h1 className="text-xl font-black text-primary italic">ItaSuper Painel</h1>
              </div>
              <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
                {[
                  { key: "dashboard", label: "Visão Geral", icon: LayoutDashboard },
                  { key: "orders", label: "Pedidos", icon: ListOrdered },
                  { key: "menu", label: "Cardápio", icon: UtensilsCrossed },
                  { key: "clients", label: "Clientes", icon: Star },
                  { key: "finance", label: "Financeiro", icon: Banknote },
                  { key: "settings", label: "Configurações", icon: Settings },
                ].map(item => (
                  <button key={item.key} onClick={() => handleTabChange(item.key as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${dashboardTab === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 flex flex-col min-w-0">
            <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl hover:bg-accent">
                  <Menu className="h-5 w-5" />
                </button>
                <h2 className="font-bold truncate">{store?.name || "Carregando..."}</h2>
              </div>
              <div className="flex items-center gap-2">
                {showSoundPrompt && !soundEnabled && !Capacitor.isNativePlatform() && (
                  <button onClick={activateSound} className="bg-amber-400 text-amber-900 px-3 py-1.5 rounded-xl text-[10px] font-black animate-pulse">ATIVAR ALERTAS</button>
                )}
                <SignOutConfirm redirectTo="/portal-parceiro" />
              </div>
            </header>

            <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
              <Suspense fallback={<div className="p-10 text-center text-muted-foreground font-bold">Carregando aba...</div>}>
                {renderTab()}
              </Suspense>
            </div>

            {/* Bottom Nav (Mobile) */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border lg:hidden pb-safe">
              <div className="flex items-center justify-around h-16">
                {[
                  { key: "dashboard", label: "Início", icon: LayoutDashboard },
                  { key: "orders", label: "Pedidos", icon: ListOrdered },
                  { key: "menu", label: "Menu", icon: UtensilsCrossed },
                  { key: "settings", label: "Ajustes", icon: Settings },
                ].map(tab => (
                  <button key={tab.key} onClick={() => handleTabChange(tab.key as any)}
                    className={`flex flex-col items-center gap-1 px-4 ${dashboardTab === tab.key ? "text-primary" : "text-muted-foreground"}`}>
                    <tab.icon className="h-5 w-5" />
                    <span className="text-[10px] font-bold">{tab.label}</span>
                  </button>
                ))}
              </div>
            </nav>
          </main>
        </div>
      </TrialExpiredGuard>
    </AdminProvider>
  );
};

export default AdminDashboard;
