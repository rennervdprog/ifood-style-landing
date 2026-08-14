import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Receipt, Truck } from "lucide-react";
import StoreFinancePanel from "./StoreFinancePanel";
import StoreFinanceBasic from "./StoreFinanceBasic";
import FinancialStatement from "./FinancialStatement";
import RepasseHistory from "./RepasseHistory";
import PlatformFeeCycleBlock from "./PlatformFeeCycleBlock";
import PlanSummaryCard from "./finance/PlanSummaryCard";
import ValorAPagarCard from "./finance/ValorAPagarCard";
import RecebidoNoMesCard from "./finance/RecebidoNoMesCard";
import ComoFuncionaCobranca from "./finance/ComoFuncionaCobranca";

interface FinanceCenterProps {
  storeId: string;
  storeName: string;
  hasCommission: boolean;
  isPlatformAdmin?: boolean;
}

export default function FinanceCenter({ storeId, storeName, hasCommission }: FinanceCenterProps) {
  const [activeTab, setActiveTab] = useState("summary");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl h-auto sm:h-12 gap-1">
          <TabsTrigger value="summary" aria-label="Resumo financeiro" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all flex-col sm:flex-row gap-0.5 sm:gap-0 py-2 sm:py-1.5 min-h-[44px]">
            <LayoutDashboard className="h-4 w-4 sm:mr-2" />
            <span className="text-[10px] sm:text-sm sm:inline">Resumo</span>
          </TabsTrigger>
          <TabsTrigger value="history" aria-label="Extrato financeiro" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all flex-col sm:flex-row gap-0.5 sm:gap-0 py-2 sm:py-1.5 min-h-[44px]">
            <Receipt className="h-4 w-4 sm:mr-2" />
            <span className="text-[10px] sm:text-sm sm:inline">Extrato</span>
          </TabsTrigger>
          <TabsTrigger value="repasse" aria-label="Histórico de repasses" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all flex-col sm:flex-row gap-0.5 sm:gap-0 py-2 sm:py-1.5 min-h-[44px]">
            <Truck className="h-4 w-4 sm:mr-2" />
            <span className="text-[10px] sm:text-sm sm:inline">
              <span className="hidden sm:inline">Histórico Pago</span>
              <span className="sm:hidden">Histórico</span>
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <h3 className="text-sm font-bold text-foreground tracking-tight">Painel do mês</h3>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                Resumo financeiro
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ValorAPagarCard storeId={storeId} onPayClick={() => setActiveTab("repasse")} />
              <PlanSummaryCard storeId={storeId} />
              <RecebidoNoMesCard storeId={storeId} />
            </div>
          </div>

          <ComoFuncionaCobranca />

          {hasCommission ? (
            <StoreFinancePanel storeId={storeId} storeName={storeName} hideHistory={true} />
          ) : (
            <StoreFinanceBasic storeId={storeId} storeName={storeName} hideHistory={true} />
          )}
          <PlatformFeeCycleBlock storeId={storeId} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="space-y-6">
            <FinancialStatement storeId={storeId} storeName={storeName} />
          </div>
        </TabsContent>

        <TabsContent value="repasse" className="mt-6">
          <RepasseHistory storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
