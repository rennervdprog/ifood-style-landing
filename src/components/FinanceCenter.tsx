import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AsaasBadgeBar } from "@/components/AsaasBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Card, CardContent } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  LayoutDashboard, 
  Wallet, 
  Receipt, 
  AlertCircle, 
  Clock, 
  CheckCircle2,
  Loader2,
  Shield,
  Truck
} from "lucide-react";
import AsaasSubaccountSetup from "./AsaasSubaccountSetup";
import AsaasFinancialPanel from "./AsaasFinancialPanel";
import StoreFinancePanel from "./StoreFinancePanel";
 import StoreFinanceBasic from "./StoreFinanceBasic";
import FinancialStatement from "./FinancialStatement";
import AdminAsaasSubaccounts from "./AdminAsaasSubaccounts";
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

export default function FinanceCenter({ storeId, storeName, hasCommission, isPlatformAdmin }: FinanceCenterProps) {
  const [activeTab, setActiveTab] = useState("summary");

  const { data: store, isLoading: loadingStore } = useQuery({
    queryKey: ["store-finance-center", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, asaas_wallet_id")
        .eq("id", storeId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: activationStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ["asaas-activation-status-center", storeId],
    queryFn: async () => {
      if (!store?.asaas_wallet_id) return null;
      const { data, error } = await supabase.functions.invoke("get-asaas-subaccount-status", {
        body: { store_id: storeId },
      });
      if (error) return null;
      return (data as any)?.status ?? null;
    },
    enabled: !!store?.asaas_wallet_id,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  if (loadingStore) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAsaasPending = store?.asaas_wallet_id && activationStatus && (
    activationStatus?.commercialInfo !== "APPROVED" || 
    activationStatus?.bankAccount !== "APPROVED" || 
    activationStatus?.document !== "APPROVED"
  );

  // If it's a new subaccount just created but status is not yet available
   const isJustCreated = store?.asaas_wallet_id && !activationStatus && !loadingStatus;
 
   const hasSubaccount = !!store?.asaas_wallet_id;
 
   // Check if basic Asaas info is missing to show the setup button
   const needsAsaasConfig = !hasSubaccount;

  return (
    <div className="space-y-6">
      {(isAsaasPending || isJustCreated) && (
        <Alert className="border-destructive/40 bg-destructive/5 animate-in fade-in slide-in-from-top-4 duration-500">
          <Clock className="h-5 w-5 text-destructive animate-pulse" />
          <AlertTitle className="text-destructive font-bold">Sua conta ainda está em análise, aguarde</AlertTitle>
          <AlertDescription className="text-xs text-destructive/80">
            Sua subconta Asaas está sendo processada. Você já pode receber pagamentos via PIX, mas a funcionalidade de saque será liberada assim que a análise for concluída.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full bg-muted/50 p-1 rounded-xl h-auto sm:h-12 gap-1 ${needsAsaasConfig ? 'grid-cols-2' : isPlatformAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <TabsTrigger value="summary" aria-label="Resumo financeiro" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all flex-col sm:flex-row gap-0.5 sm:gap-0 py-2 sm:py-1.5 min-h-[44px]">
            <LayoutDashboard className="h-4 w-4 sm:mr-2" />
            <span className="text-[10px] sm:text-sm sm:inline">Resumo</span>
          </TabsTrigger>
          {!needsAsaasConfig && (
            <TabsTrigger value="balance" aria-label="Saldo Asaas" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all flex-col sm:flex-row gap-0.5 sm:gap-0 py-2 sm:py-1.5 min-h-[44px]">
              <Wallet className="h-4 w-4 sm:mr-2" />
              <span className="text-[10px] sm:text-sm sm:inline">
              <span className="hidden sm:inline">Recebimentos</span>
              <span className="sm:hidden">Receb.</span>
              </span>
            </TabsTrigger>
          )}
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
          {isPlatformAdmin && (
            <TabsTrigger value="admin-subaccounts" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all flex-col sm:flex-row gap-0.5 sm:gap-0 py-2 sm:py-1.5 min-h-[44px]">
              <Shield className="h-4 w-4 sm:mr-2" />
              <span className="text-[10px] sm:text-sm sm:inline">
                <span className="hidden sm:inline">Subcontas (Admin)</span>
                <span className="sm:hidden">Subcontas</span>
              </span>
            </TabsTrigger>
          )}
        </TabsList>
         {isPlatformAdmin && (
           <TabsContent value="admin-subaccounts" className="mt-6">
             <AdminAsaasSubaccounts />
           </TabsContent>
         )}

          <TabsContent value="summary" className="mt-6 space-y-6">
            {needsAsaasConfig && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="pt-6 pb-6 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Wallet className="h-6 w-6 text-destructive" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-destructive">Configuração Pendente</h3>
                    <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                      Identificamos que sua conta ainda não possui o PIX integrado via Asaas. Configure agora para receber direto na sua conta.
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                      As abas <strong>Saldo</strong>, <strong>Repasses</strong> e <strong>Subcontas</strong> serão desbloqueadas após a configuração.
                    </p>
                  </div>
                  <Button 
                    className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold h-11"
                    onClick={() => setActiveTab("balance")}
                  >
                    Configurar Conta Asaas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Visão clara: A pagar (prioridade), Plano e Recebido */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h3 className="text-sm font-bold text-foreground tracking-tight">Painel do mês</h3>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                  Resumo financeiro
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <ValorAPagarCard storeId={storeId} onPayClick={() => setActiveTab("balance")} />
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
 
         <TabsContent value="balance" className="mt-6">
           {!store?.asaas_wallet_id ? (
             <AsaasSubaccountSetup storeId={storeId} />
          ) : isAsaasPending ? (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="pt-6 pb-6 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-500 animate-pulse" />
                </div>
                <h3 className="font-bold text-foreground">Subconta em análise</h3>
                <p className="text-sm text-muted-foreground max-w-[300px] mx-auto">
                  Você já recebe pagamentos via PIX normalmente. O saque será liberado assim que a análise da subconta for concluída (em geral 1–2 dias úteis).
                </p>
              </CardContent>
            </Card>
          ) : (
            <AsaasFinancialPanel storeId={storeId} />
          )}
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
    <AsaasBadgeBar className="mx-4 mb-4 mt-2" />
    </div>
  );
}