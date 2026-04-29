 import { useState, useEffect } from "react";
 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Skeleton } from "@/components/ui/skeleton";
 import { TrendingUp, Wallet, QrCode, Settings, ShoppingBag, Banknote } from "lucide-react";
 import { formatBRL } from "@/lib/utils";
 import AsaasFinancialPanel from "./AsaasFinancialPanel";
 import StoreFinancePanel from "./StoreFinancePanel";
 import AsaasSubaccountSetup from "./AsaasSubaccountSetup";
 import { useAuth } from "@/contexts/AuthContext";
 
 interface FinanceCenterProps {
   storeId: string;
   storePlan: any;
 }
 
 export default function FinanceCenter({ storeId, storePlan }: FinanceCenterProps) {
   const { user } = useAuth();
   const [activeTab, setActiveTab] = useState("summary");
 
   const { data: store, isLoading: storeLoading } = useQuery({
     queryKey: ["store-finance-center", storeId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("stores")
         .select("*")
         .eq("id", storeId)
         .maybeSingle();
       if (error) throw error;
       return data;
     },
   });
 
   const { data: myProfile } = useQuery({
     queryKey: ["profile-finance-center", user?.id],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("profiles")
         .select("*")
         .eq("id", user?.id)
         .maybeSingle();
       if (error) throw error;
       return data;
     },
     enabled: !!user,
   });
 
   const { data: dailyStats, isLoading: statsLoading } = useQuery({
     queryKey: ["finance-daily-stats", storeId],
     queryFn: async () => {
       const today = new Date();
       today.setHours(0, 0, 0, 0);
       const { data, error } = await supabase
         .from("orders")
         .select("total_price, payment_method, status")
         .eq("store_id", storeId)
         .gte("created_at", today.toISOString())
         .in("status", ["entregue", "finalizado"]);
       if (error) throw error;
       
       const total = data?.reduce((acc, o) => acc + Number(o.total_price), 0) || 0;
       const pixCount = data?.filter(o => o.payment_method === "pix").length || 0;
       return { total, count: data?.length || 0, pixCount };
     },
   });
 
   if (storeLoading) {
     return (
       <div className="space-y-4">
         <Skeleton className="h-10 w-full rounded-xl" />
         <Skeleton className="h-48 w-full rounded-2xl" />
         <div className="grid grid-cols-3 gap-4">
           <Skeleton className="h-24 rounded-2xl" />
           <Skeleton className="h-24 rounded-2xl" />
           <Skeleton className="h-24 rounded-2xl" />
         </div>
       </div>
     );
   }
 
   return (
     <div className="space-y-4">
       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
         <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 h-auto">
           <TabsTrigger value="summary" className="py-2 px-1 text-[10px] sm:text-xs gap-1.5">
             <TrendingUp className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Resumo</span>
           </TabsTrigger>
           <TabsTrigger value="asaas" className="py-2 px-1 text-[10px] sm:text-xs gap-1.5" disabled={!store?.asaas_wallet_id}>
             <Wallet className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Saldo Asaas</span>
           </TabsTrigger>
           <TabsTrigger value="billing" className="py-2 px-1 text-[10px] sm:text-xs gap-1.5">
             <QrCode className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Cobranças PIX</span>
           </TabsTrigger>
           <TabsTrigger value="setup" className="py-2 px-1 text-[10px] sm:text-xs gap-1.5">
             <Settings className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Configuração</span>
           </TabsTrigger>
         </TabsList>
 
         <TabsContent value="summary" className="mt-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
             <Card className="bg-emerald-500/10 border-emerald-500/20">
               <CardContent className="p-4 flex flex-col items-center justify-center">
                 <Banknote className="h-5 w-5 text-emerald-500 mb-1" />
                 <p className="text-[10px] text-muted-foreground uppercase font-bold">Vendas Hoje</p>
                 <p className="text-lg font-black text-foreground">{formatBRL(dailyStats?.total || 0)}</p>
               </CardContent>
             </Card>
             <Card className="bg-blue-500/10 border-blue-500/20">
               <CardContent className="p-4 flex flex-col items-center justify-center">
                 <ShoppingBag className="h-5 w-5 text-blue-500 mb-1" />
                 <p className="text-[10px] text-muted-foreground uppercase font-bold">Pedidos</p>
                 <p className="text-lg font-black text-foreground">{dailyStats?.count || 0}</p>
               </CardContent>
             </Card>
             <Card className="bg-purple-500/10 border-purple-500/20">
               <CardContent className="p-4 flex flex-col items-center justify-center">
                 <QrCode className="h-5 w-5 text-purple-500 mb-1" />
                 <p className="text-[10px] text-muted-foreground uppercase font-bold">PIX Recebidos</p>
                 <p className="text-lg font-black text-foreground">{dailyStats?.pixCount || 0}</p>
               </CardContent>
             </Card>
           </div>
           <p className="text-[10px] text-muted-foreground text-center italic">
             * Resumo de pedidos entregues/finalizados hoje.
           </p>
         </TabsContent>
 
         <TabsContent value="asaas" className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
           {store?.asaas_wallet_id ? (
             <AsaasFinancialPanel storeId={storeId} />
           ) : (
             <Card className="border-dashed py-8">
               <CardContent className="flex flex-col items-center justify-center text-center">
                 <Wallet className="h-8 w-8 text-muted-foreground/30 mb-2" />
                 <p className="text-sm font-bold text-foreground">Saldo Asaas indisponível</p>
                 <p className="text-xs text-muted-foreground max-w-xs">Você precisa configurar sua subconta na aba "Configuração" para ver o saldo em tempo real.</p>
               </CardContent>
             </Card>
           )}
         </TabsContent>
 
         <TabsContent value="billing" className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <StoreFinancePanel 
             storeId={storeId} 
             storeName={store?.name || "Loja"} 
             variant={storePlan.hasCommission ? "commission" : "basic"} 
           />
         </TabsContent>
 
         <TabsContent value="setup" className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <AsaasSubaccountSetup 
             storeId={storeId} 
             initialData={{
               name: myProfile?.full_name,
               email: user?.email,
               cpfCnpj: myProfile?.document,
               phone: myProfile?.whatsapp_number || myProfile?.phone,
               address: store?.address_street,
               addressNumber: store?.address_number,
               complement: store?.address_complement,
               province: store?.address_neighborhood,
               postalCode: store?.address_cep
             }}
           />
         </TabsContent>
       </Tabs>
     </div>
   );
 }