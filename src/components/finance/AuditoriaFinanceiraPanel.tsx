import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, ShieldCheck } from "lucide-react";
import { exportCSV } from "./financeExport";

const FINANCIAL_ACTIONS = [
  "withdraw",
  "withdrawal",
  "payout",
  "billing",
  "commission",
  "refund",
  "transfer",
  "monthly_charge",
  "monthly_billing",
  "platform_fee",
  "asaas",
  "pix",
];

const AuditoriaFinanceiraPanel = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_logs")
        .select("id, created_at, admin_id, action, target_type, target_id, details")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).filter((l: any) =>
        FINANCIAL_ACTIONS.some((k) => String(l.action || "").toLowerCase().includes(k)),
      );
    },
    staleTime: 60_000,
  });

  const rows = data || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Auditoria Financeira
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => exportCSV("auditoria-financeira", rows)} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-48 w-full" />}
          {!isLoading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum log financeiro recente.
            </p>
          )}
          {!isLoading && rows.length > 0 && (
            <div className="space-y-2 text-xs">
              {rows.map((l: any) => (
                <div key={l.id} className="border rounded-lg p-2 bg-muted/30">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">{l.action}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {l.target_type ? `${l.target_type} · ` : ""}
                    <span className="font-mono">{String(l.target_id || "").slice(0, 12)}</span>
                  </div>
                  {l.details && (
                    <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all opacity-70">
                      {typeof l.details === "string" ? l.details : JSON.stringify(l.details)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditoriaFinanceiraPanel;