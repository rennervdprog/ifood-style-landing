import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, CheckCircle2, AlertCircle, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface AsaasDocument {
  id: string;
  status: "NOT_SENT" | "PENDING" | "APPROVED" | "REJECTED" | string;
  type: string;
  title?: string;
  description?: string;
  responsible?: { name?: string } | null;
  documents?: Array<{ id: string; status: string; type: string }>;
}

interface ListResponse {
  data?: AsaasDocument[];
  rejectReasons?: string;
}

const TYPE_LABELS: Record<string, string> = {
  IDENTIFICATION: "Documento de Identidade (RG/CNH)",
  SOCIAL_CONTRACT: "Contrato Social",
  ENTREPRENEUR_REQUIREMENT: "Requerimento de Empresário",
  MINUTES_OF_ELECTION: "Ata de Eleição",
  CUSTOM: "Documento Adicional",
  PROOF_OF_ADDRESS: "Comprovante de Endereço",
  POSTAL_CODE: "Comprovante de CEP",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NOT_SENT: { label: "Não enviado", color: "text-amber-600" },
  PENDING: { label: "Em análise", color: "text-blue-600" },
  APPROVED: { label: "Aprovado", color: "text-green-600" },
  REJECTED: { label: "Rejeitado", color: "text-red-600" },
};

const FUNCTIONS_URL = "https://qkjhguziuchqsbxzruea.supabase.co/functions/v1/upload-asaas-documents";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFramhndXppdWNocXNieHpydWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDg4NTUsImV4cCI6MjA5MDYyNDg1NX0.2sTeKchqAEN2gCqnH1_Zn9cJmUSmZgryt05A66tgm2Y";

export default function AsaasDocumentsUpload({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["asaas-required-docs", storeId],
    queryFn: async (): Promise<ListResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(FUNCTIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({ store_id: storeId, action: "list" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erro ao buscar documentos");
      return json.documents || {};
    },
    staleTime: 30_000,
  });

  const handleUpload = async (doc: AsaasDocument, file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo deve ter no máximo 10MB.");
      return;
    }
    setUploadingId(doc.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append("store_id", storeId);
      fd.append("document_id", doc.id);
      fd.append("document_type", doc.type);
      fd.append("file", file);

      const res = await fetch(FUNCTIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: ANON_KEY,
        },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha no upload");
      toast.success("Documento enviado para análise! ✅");
      await refetch();
      qc.invalidateQueries({ queryKey: ["asaas-activation-status", storeId] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar documento");
    } finally {
      setUploadingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const docs = data?.data || [];

  if (!docs.length) {
    return (
      <Card>
        <CardContent className="py-6 text-center space-y-3">
          <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Nenhum documento adicional pendente no momento.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3 w-3 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Envio de Documentos
          </span>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4 space-y-3">
        {data?.rejectReasons && (
          <Alert className="border-red-500/40 bg-red-500/5">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-xs text-red-700">
              <strong>Motivo da rejeição:</strong> {data.rejectReasons}
            </AlertDescription>
          </Alert>
        )}
        <Alert className="border-red-500/40 bg-red-500/5">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-xs text-red-700">
            <strong>Envie apenas documentos reais e legíveis.</strong> Todos os arquivos passam por
            análise do Asaas. Documentos falsos, editados ou de terceiros resultam em bloqueio
            permanente da conta e perda dos pagamentos pendentes.
          </AlertDescription>
        </Alert>
        <p className="text-[11px] text-muted-foreground">
          Envie os documentos solicitados aqui mesmo no app. Aceitamos JPG, PNG ou PDF (máx. 10MB).
        </p>

        {docs.map((doc) => {
          const status = STATUS_LABELS[doc.status] || { label: doc.status, color: "text-muted-foreground" };
          const canUpload = doc.status !== "APPROVED" && doc.status !== "PENDING";
          const isUp = uploadingId === doc.id;
          return (
            <div key={doc.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {doc.title || TYPE_LABELS[doc.type] || doc.type}
                  </p>
                  {doc.responsible?.name && (
                    <p className="text-[10px] text-muted-foreground">Responsável: {doc.responsible.name}</p>
                  )}
                  {doc.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{doc.description}</p>
                  )}
                </div>
                <span className={`text-[10px] font-bold whitespace-nowrap ${status.color}`}>
                  {status.label}
                </span>
              </div>

              {canUpload && (
                <label
                  className={`flex items-center justify-center gap-2 text-xs h-9 rounded-md border-2 border-dashed cursor-pointer transition-colors ${
                    isUp ? "bg-muted border-muted-foreground/30" : "border-primary/40 hover:bg-primary/5 text-primary"
                  }`}
                >
                  {isUp ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3 w-3" />
                      {doc.status === "REJECTED" ? "Reenviar documento" : "Enviar documento"}
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                    className="hidden"
                    disabled={isUp}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(doc, f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}

              {doc.status === "PENDING" && (
                <p className="text-[10px] text-blue-600 text-center">
                  ✓ Documento enviado, aguardando análise do Asaas.
                </p>
              )}
              {doc.status === "APPROVED" && (
                <p className="text-[10px] text-green-600 text-center">
                  ✓ Documento aprovado.
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}