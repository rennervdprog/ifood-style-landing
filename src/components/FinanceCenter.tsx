import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  LayoutDashboard, 
  Wallet, 
  Receipt, 
  AlertCircle, 
  Clock, 
  CheckCircle2,
  Loader2
} from "lucide-react";
import AsaasSubaccountSetup from "./AsaasSubaccountSetup";
import AsaasFinancialPanel from "./AsaasFinancialPanel";
import StoreFinancePanel from "./StoreFinancePanel";
import StoreFinanceBasic from "./StoreFinanceBasic";

interface FinanceCenterProps {
  storeId: string;
  storeName: string;
  hasCommission: boolean;
}

export default function FinanceCenter({ storeId, storeName, hasCommission }: FinanceCenterProps) {
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

  const isAsaasPending = store?.asaas_wallet_id && (
    activationStatus?.commercialInfo !== "APPROVED" || 
    activationStatus?.bankAccount !== "APPROVED" || 
    activationStatus?.document !== "APPROVED"
  );

  return (
    <div className="space-y-6">
      {isAsaasPending && (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <Clock className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-700 font-bold">Conta em Análise</AlertTitle>
          <AlertDescription className="text-xs text-amber-600">
            Sua conta Asaas ainda está em análise. Você já pode receber pagamentos, mas os saques serão liberados após a aprovação total. Aguarde a confirmação por e-mail.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="summary" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Resumo</span>
            <span className="sm:hidden text-[10px]">Resumo</span>
          </TabsTrigger>
          <TabsTrigger value="balance" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Wallet className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Saldo Asaas</span>
            <span className="sm:hidden text-[10px]">Saldo</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Receipt className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Extrato</span>
            <span className="sm:hidden text-[10px]">Extrato</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6 space-y-6">
          {hasCommission ? (
            <StoreFinancePanel storeId={storeId} storeName={storeName} />
          ) : (
            <StoreFinanceBasic storeId={storeId} storeName={storeName} />
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
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-0">
              {hasCommission ? (
                <StoreFinancePanel storeId={storeId} storeName={storeName} />
              ) : (
                <StoreFinanceBasic storeId={storeId} storeName={storeName} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}