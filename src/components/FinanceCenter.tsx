import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Shield
} from "lucide-react";
import AsaasSubaccountSetup from "./AsaasSubaccountSetup";
import AsaasFinancialPanel from "./AsaasFinancialPanel";
import StoreFinancePanel from "./StoreFinancePanel";
 import StoreFinanceBasic from "./StoreFinanceBasic";
import PaymentStatement from "./PaymentStatement";
import AdminAsaasSubaccounts from "./AdminAsaasSubaccounts";

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
        .select("id, asaas_wallet_id, asaas_activation_status")
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
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("https://qkjhguziuchqsbxzruea.supabase.co/functions/v1/get-asaas-subaccount-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFramhndXppdWNocXNieHpydWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDg4NTUsImV4cCI6MjA5MDYyNDg1NX0.2sTeKchqAEN2gCqnH1_Zn9cJmUSmZgryt05A66tgm2Y",
        },
        body: JSON.stringify({ store_id: storeId }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.status;
    },
    enabled: !!store?.asaas_wallet_id,
    refetchInterval: 60000,
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
         <TabsList className={`grid w-full bg-muted/50 p-1 rounded-xl h-12 ${needsAsaasConfig ? 'grid-cols-2' : isPlatformAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
           <TabsTrigger value="summary" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Resumo</span>
            <span className="sm:hidden text-[10px]">Resumo</span>
          </TabsTrigger>
           {!needsAsaasConfig && (
             <TabsTrigger value="balance" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
               <Wallet className="h-4 w-4 mr-2" />
               <span className="hidden sm:inline">Saldo Asaas</span>
               <span className="sm:hidden text-[10px]">Saldo</span>
             </TabsTrigger>
           )}
          <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
            <Receipt className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Extrato</span>
            <span className="sm:hidden text-[10px]">Extrato</span>
          </TabsTrigger>
          {isPlatformAdmin && (
            <TabsTrigger value="admin-subaccounts" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              <Shield className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Subcontas (Admin)</span>
              <span className="sm:hidden text-[10px]">Subcontas</span>
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
 
            {hasCommission ? (
              <StoreFinancePanel storeId={storeId} storeName={storeName} hideHistory={true} />
            ) : (
              <StoreFinanceBasic storeId={storeId} storeName={storeName} hideHistory={true} />
            )}
          </TabsContent>
 
         <TabsContent value="balance" className="mt-6">
           {!store?.asaas_wallet_id ? (
             <AsaasSubaccountSetup storeId={storeId} />
           ) : (
             <AsaasFinancialPanel storeId={storeId} />
           )}
         </TabsContent>

         <TabsContent value="history" className="mt-6">
           <div className="space-y-6">
             <PaymentStatement storeId={storeId} storeName={storeName} initialOpen={true} />
           </div>
         </TabsContent>
      </Tabs>
    </div>
  );
}