import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Mail, 
  MessageCircle, 
  Search, 
  Store,
  ExternalLink,
  ShieldAlert
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const AdminSubaccountsTab = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: subaccounts, isLoading } = useQuery({
    queryKey: ["admin-asaas-subaccounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select(`
          id, 
          name, 
          asaas_account_id, 
          asaas_activation_status, 
          asaas_documents_sent,
          owner_id,
          profiles:owner_id (
            full_name,
            phone
          )
        `)
        .not("asaas_account_id", "is", null);
      
      if (error) throw error;
      return data || [];
    },
  });

  const filteredSubaccounts = subaccounts?.filter((s: any) => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.profiles?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusInfo = (store: any) => {
    const status = (store.asaas_activation_status as any)?.status || (store.asaas_documents_sent ? "WAITING_APPROVAL" : "PENDING_DOCUMENTS");
    
    switch (status) {
      case "APPROVED":
        return {
          label: "Aprovada",
          color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
          icon: CheckCircle2,
          description: "Subconta pronta para receber repasses."
        };
      case "PENDING_DOCUMENTS":
        return {
          label: "Documentos Pendentes",
          color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
          icon: FileText,
          description: "O lojista ainda não enviou os documentos obrigatórios."
        };
      case "WAITING_APPROVAL":
      case "AWAITING_APPROVAL":
        return {
          label: "Em Análise",
          color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
          icon: Clock,
          description: "Documentos enviados. Aguardando aprovação do Asaas."
        };
      case "DENIED":
      case "REJECTED":
        return {
          label: "Reprovada",
          color: "bg-destructive/10 text-destructive border-destructive/20",
          icon: ShieldAlert,
          description: "A subconta foi recusada. Verifique os motivos no painel do Asaas."
        };
      default:
        return {
          label: "Status Desconhecido",
          color: "bg-muted text-muted-foreground border-border",
          icon: AlertTriangle,
          description: "Status não identificado."
        };
    }
  };

  const handleWhatsApp = (store: any) => {
    const phone = store.profiles?.phone;
    if (!phone) return;
    const message = `Olá ${store.profiles.full_name}, sou da administração do aplicativo. Notamos que sua subconta de pagamentos ainda não está ativa. Poderia verificar os documentos pendentes no seu painel para que possamos normalizar seus repasses?`;
    window.open(`https://wa.me/55${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar loja ou proprietário..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-card border-border rounded-xl"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-card rounded-2xl animate-pulse border border-border" />
          ))}
        </div>
      ) : filteredSubaccounts?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-2xl border border-dashed border-border">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <Store className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma subconta encontrada</p>
          <p className="text-xs text-muted-foreground mt-1">Lojas sem configuração de Asaas não aparecem aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredSubaccounts?.map((store: any) => {
            const { label, color, icon: StatusIcon, description } = getStatusInfo(store);
            
            return (
              <div key={store.id} className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/30 transition-all group">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground line-clamp-1">{store.name}</h3>
                        <p className="text-xs text-muted-foreground">{store.profiles?.full_name || "Sem proprietário"}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shadow-none ${color}`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {label}
                    </Badge>
                  </div>

                  <div className="bg-muted/30 rounded-xl p-3 mb-4">
                    <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                      {description}
                    </p>
                    {store.asaas_account_id && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-2 opacity-50 truncate">
                        ID: {store.asaas_account_id}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleWhatsApp(store)}
                      disabled={!store.profiles?.phone}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:grayscale"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Cobrar Documentos
                    </button>
                    <a
                      href={`https://www.asaas.com/customer/show/${store.asaas_account_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted-foreground/10 transition-colors"
                      title="Ver no Asaas"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};