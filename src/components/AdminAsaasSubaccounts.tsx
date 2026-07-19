import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  Clock, 
  Wallet, 
  FileText, 
  CheckCircle2, 
  XCircle,
  Loader2,
  ExternalLink
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";

const AdminAsaasSubaccounts = () => {
  const { data: stores, isLoading, refetch } = useQuery({
    queryKey: ["admin-asaas-subaccounts"],
    queryFn: async () => {
      // Lojas que possuem subconta configurada
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, asaas_account_id, asaas_documents_sent, status")
        .not("asaas_account_id", "is", null);
      
      if (error) throw error;

      // Para cada loja, vamos buscar o status de ativação (se disponível no banco)
      return (data || []).map((s: any) => ({ ...s, asaas_activation_status: null }));
    },
  });

  const getStatusColor = (statusJson: any) => {
    const status = statusJson as any;
    if (!status) return "bg-slate-500/20 text-slate-600";
    if (status?.commercialInfo === "APPROVED" && status?.bankAccount === "APPROVED") return "bg-green-500/20 text-green-600";
    return "bg-amber-500/20 text-amber-600";
  };

  const getStatusLabel = (statusJson: any) => {
    const status = statusJson as any;
    if (!status) return "Não Verificado";
    if (status?.commercialInfo === "APPROVED" && status?.bankAccount === "APPROVED" && status?.document === "APPROVED") return "Totalmente Aprovada";
    return "Pendente / Em Análise";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-bold mb-1">Sobre o saldo retido em subcontas:</p>
          <p>
            Quando uma subconta recebe valores via split mas ainda está com documentos pendentes, o saldo fica 
            <strong> retido na subconta do lojista</strong>. Você (admin) não pode movimentar esse valor de volta 
            para a conta principal. O lojista deve enviar os documentos para liberar o saque.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores?.map((store) => (
          <Card key={store.id} className="overflow-hidden border-border/50">
            <CardHeader className="pb-2 bg-muted/30">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="truncate max-w-[150px]">{store.name}</span>
                <Badge variant="outline" className={getStatusColor(store.asaas_activation_status)}>
                  {getStatusLabel(store.asaas_activation_status)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> Documentos enviados:
                  </span>
                  <span className="font-bold">
                    {store.asaas_documents_sent ? (
                      <span className="text-green-600 flex items-center gap-1">Sim <CheckCircle2 className="h-3 w-3" /></span>
                    ) : (
                      <span className="text-red-600 flex items-center gap-1">Não <XCircle className="h-3 w-3" /></span>
                    )}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Info. Comercial:
                  </span>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-none bg-muted">
                    {(store.asaas_activation_status as any)?.commercialInfo || "PENDENTE"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="h-3 w-3" /> Conta Bancária:
                  </span>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-none bg-muted">
                    {(store.asaas_activation_status as any)?.bankAccount || "PENDENTE"}
                  </Badge>
                </div>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-[11px] h-8"
                onClick={() => {
                  window.open(`https://www.asaas.com/customer/show/${store.asaas_account_id}`, '_blank');
                }}
              >
                <ExternalLink className="h-3 w-3 mr-1.5" /> Ver no Asaas
              </Button>
            </CardContent>
          </Card>
        ))}

        {stores?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
            Nenhuma subconta configurada ainda.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAsaasSubaccounts;