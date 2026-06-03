export type OrderStatus =
  | "pendente"
  | "preparando"
  | "pronto_para_entrega"
  | "saiu_entrega"
  | "em_transito"
  | "entregue"
  | "finalizado";

export type OrderTabKey = OrderStatus | "delivery";

export type DashboardTab =
  | "dashboard"
  | "orders"
  | "menu"
  | "addons"
  | "bordas"
  | "hours"
  | "settings"
  | "finance"
  | "clients"
  | "reports"
  | "subscription"
  | "loyalty"
  | "drivers"
  | "refunds"
  | "tutoriais"
  | "cash_register"
  | "suporte"
  | "coupons";

export type StoreAddonGroup = {
  id: string;
  name: string;
  min_select: number;
  product_id: string | null;
  addon_items?: Array<{ name: string | null }> | null;
};

export type StoreAddonLink = {
  addon_group_id: string;
  product_id: string;
};

export type RequiredAddonHighlight = {
  itemId: string;
  itemName: string;
  groupName: string;
  addonName: string;
};