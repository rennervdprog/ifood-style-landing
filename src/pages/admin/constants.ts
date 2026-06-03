import {
  Clock, ChefHat, Truck, CheckCircle2, Package,
  LayoutDashboard, ListOrdered, Users, UtensilsCrossed,
  Plus, CircleDot, Coins, BarChart3, CreditCard, Star,
  Bike, AlertTriangle, GraduationCap, Settings,
  MessageCircle, ShoppingCart, Headphones, Tag,
} from "lucide-react";
import type { DashboardTab, OrderStatus } from "./types";

export const ALERT_SOUND_URL = "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";
export const CASH_REGISTER_SOUND_URL = "https://actions.google.com/sounds/v1/office/cash_register.ogg";

export const statusColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
  pendente: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", label: "Novo Pedido" },
  preparando: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", label: "Em Preparo" },
  pronto_para_entrega: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", label: "Pronto" },
  saiu_entrega: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", label: "Saiu Entrega" },
  em_transito: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", label: "Em Trânsito" },
  entregue: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", label: "Entregue" },
  finalizado: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", label: "Finalizado" },
  cancelado: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30", label: "Cancelado" },
};

export const orderTabs: { status: OrderStatus | "delivery"; label: string; icon: React.ElementType; mergedStatuses?: OrderStatus[] }[] = [
  { status: "pendente", label: "Novos", icon: Clock },
  { status: "preparando", label: "Preparando", icon: ChefHat },
  { status: "pronto_para_entrega", label: "Pronto", icon: Package },
  { status: "delivery" as any, label: "Entregando", icon: Truck, mergedStatuses: ["saiu_entrega", "em_transito"] },
  { status: "entregue", label: "Entregue", icon: CheckCircle2 },
  { status: "finalizado", label: "Finalizados", icon: CheckCircle2 },
];

// Métodos de pagamento exibidos em TODOS os contextos (delivery + PDV)
export const paymentLabels: Record<string, string> = {
  pix: "PIX Online",
  cartao: "Cartão na Entrega",
  dinheiro: "Dinheiro",
  // PDV — nunca aparecem no checkout do cliente
  maquininha_credito: "Crédito",
  maquininha_debito: "Débito",
  maquininha_pix: "PIX Maquininha",
};
export const paymentIcons: Record<string, string> = {
  pix: "⚡",
  cartao: "💳",
  dinheiro: "💵",
  // PDV
  maquininha_credito: "💳",
  maquininha_debito: "💳",
  maquininha_pix: "📱",
};

// Métodos visíveis APENAS no PDV (nunca no checkout do cliente)
export const pdvPaymentMethods = [
  { id: "dinheiro",            label: "Dinheiro",        icon: "💵" },
  { id: "maquininha_credito",  label: "Crédito",         icon: "💳" },
  { id: "maquininha_debito",   label: "Débito",          icon: "💳" },
  { id: "maquininha_pix",      label: "PIX Maquininha",  icon: "📱" },
  // PIX Online (Asaas, R$1,99) NÃO aparece no PDV — sem taxa no presencial
] as const;

export const baseSidebarItems: { key: DashboardTab; label: string; icon: React.ElementType; pizzaOnly?: boolean }[] = [
  { key: "dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { key: "orders", label: "Pedidos", icon: ListOrdered },
  { key: "clients", label: "Clientes", icon: Users },
  { key: "menu", label: "Cardápio", icon: UtensilsCrossed },
  { key: "addons", label: "Adicionais", icon: Plus },
  { key: "bordas", label: "Pizzaria", icon: CircleDot, pizzaOnly: true },
  { key: "hours", label: "Horários", icon: Clock },
  { key: "finance", label: "Financeiro", icon: Coins },
  { key: "reports", label: "Relatórios", icon: BarChart3 },
  { key: "subscription", label: "Meu Plano", icon: CreditCard },
  { key: "loyalty", label: "Fidelidade", icon: Star },
  { key: "coupons", label: "Cupons", icon: Tag },
  { key: "drivers", label: "Motoboys", icon: Bike },
  { key: "refunds", label: "Reembolsos", icon: AlertTriangle },
  { key: "tutoriais", label: "Tutoriais", icon: GraduationCap },
  { key: "settings", label: "Configurações", icon: Settings },
];

export const bottomNavTabs: { key: DashboardTab; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "Início", icon: LayoutDashboard },
  { key: "orders", label: "Pedidos", icon: ListOrdered },
  { key: "menu", label: "Cardápio", icon: UtensilsCrossed },
  { key: "clients", label: "Clientes", icon: Users },
];

export const moreSheetItems: { key: DashboardTab; label: string; icon: React.ElementType; pizzaOnly?: boolean }[] = [
  { key: "cash_register", label: "PDV / Caixa", icon: ShoppingCart },
  { key: "addons", label: "Adicionais", icon: Plus },
  { key: "bordas", label: "Pizzaria", icon: CircleDot, pizzaOnly: true },
  { key: "hours", label: "Horários", icon: Clock },
  { key: "finance", label: "Financeiro", icon: Coins },
  { key: "reports", label: "Relatórios", icon: BarChart3 },
  { key: "subscription", label: "Meu Plano", icon: CreditCard },
  { key: "loyalty", label: "Fidelidade", icon: Star },
  { key: "coupons", label: "Cupons", icon: Tag },
  { key: "drivers", label: "Motoboys", icon: Bike },
  { key: "tutoriais", label: "Tutoriais", icon: GraduationCap },
  { key: "settings", label: "Configurações", icon: Settings },
  { key: "suporte", label: "Suporte", icon: Headphones },
];