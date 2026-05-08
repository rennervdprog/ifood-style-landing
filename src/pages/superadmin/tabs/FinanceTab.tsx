import { useState } from "react";
import { 
  DollarSign, Wallet, ShoppingBag, LayoutDashboard
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { KpiCard } from "@/components/FinanceCharts";

interface FinanceTabProps {
  isAdmin: boolean;
  testStoreIds: string[];
  stores: any[];
  parentStorePlans: any[];
}

export default function FinanceTab({ isAdmin, testStoreIds, stores, parentStorePlans }: FinanceTabProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-2xl font-bold">Financeiro</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Vendas Totais" value={formatBRL(0)} color="blue" />
        <KpiCard label="Comissões" value={formatBRL(0)} color="amber" />
        <KpiCard label="Repasses" value={formatBRL(0)} color="emerald" />
      </div>

      <div className="bg-card rounded-3xl border p-6">
        <p className="text-muted-foreground">Esta é a nova aba de financeiro modularizada (V2).</p>
      </div>
    </div>
  );
}
