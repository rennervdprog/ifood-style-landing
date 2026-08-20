import { useState } from "react";
import { LayoutDashboard, Receipt, Truck, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="mx-auto max-w-6xl space-y-5 px-4 pb-6 pt-5 lg:px-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Gestão / Financeiro</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground">Financeiro</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe seus recebimentos, valores a pagar à plataforma e próximas cobranças.</p>
        </div>

      </header>

      <div className="flex items-center justify-between gap-3 border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> Os valores são atualizados conforme pedidos, taxas e repasses da sua loja.</div>
        <button onClick={() => setActiveTab("summary")} className="shrink-0 font-bold text-primary hover:underline">Entender cobrança</button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="summary" className="gap-2 rounded-none border-b-2 border-transparent px-1 pb-3 text-xs font-black text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"><LayoutDashboard className="h-4 w-4" />Resumo</TabsTrigger>
          <TabsTrigger value="history" className="gap-2 rounded-none border-b-2 border-transparent px-1 pb-3 text-xs font-black text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"><Receipt className="h-4 w-4" />Extrato</TabsTrigger>
          <TabsTrigger value="repasse" className="gap-2 rounded-none border-b-2 border-transparent px-1 pb-3 text-xs font-black text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"><Truck className="h-4 w-4" />Cobranças</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-5 space-y-5">
          <section>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-foreground">Resumo do mês</h3><span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Atualizado automaticamente</span></div>
            <div className="grid gap-0 divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <RecebidoNoMesCard storeId={storeId} />
              <ValorAPagarCard storeId={storeId} onPayClick={() => setActiveTab("repasse")} />
              <PlanSummaryCard storeId={storeId} />
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">{hasCommission ? <StoreFinancePanel storeId={storeId} storeName={storeName} hideHistory /> : <StoreFinanceBasic storeId={storeId} storeName={storeName} hideHistory />}</div>
            <aside className="space-y-5"><ComoFuncionaCobranca /><PlatformFeeCycleBlock storeId={storeId} /></aside>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-5"><FinancialStatement storeId={storeId} storeName={storeName} /></TabsContent>
        <TabsContent value="repasse" className="mt-5"><RepasseHistory storeId={storeId} /></TabsContent>
      </Tabs>
    </div>
  );
}
