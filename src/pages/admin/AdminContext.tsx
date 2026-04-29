import React, { createContext, useContext } from "react";

export interface AdminContextType {
  store: any;
  orders: any[] | undefined;
  todayTotal: number;
  todayCount: number;
  pendingCount: number;
  preparingCount: number;
  readyCount: number;
  avgDeliveryTime: number;
  clientAnalytics: any[];
  isApproved: boolean;
  profileLoading: boolean;
  storeLoading: boolean;
  isOwnDelivery: boolean;
  hasLinkedDrivers: boolean;
  driversLoading: boolean;
  onlineDrivers: any[];
  activeTab: string;
  setActiveTab: (tab: any) => void;
  dashboardTab: string;
  setDashboardTab: (tab: any) => void;
  updateOrderStatus: (id: string, status: any) => Promise<void>;
  toggleStoreOpen: () => Promise<void>;
  getClientName: (id: string) => string;
  getDriverName: (id: string) => string;
  getMainAction: (status: string, order: any) => any;
  paymentIcons: any;
  paymentLabels: any;
  storePlan: any;
  allHoursClosed: boolean;
  delayedOrders: any[];
  showDelayedPanel: boolean;
  setShowDelayedPanel: (show: boolean) => void;
  toggleBatchOrder: (id: string) => void;
  batchSelected: Set<string>;
  setBatchSelected: (s: Set<string>) => void;
}

export const AdminContext = createContext<AdminContextType | null>(null);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used within AdminProvider");
  return context;
};

export const AdminProvider = ({ children, value }: { children: React.ReactNode; value: AdminContextType }) => {
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};
