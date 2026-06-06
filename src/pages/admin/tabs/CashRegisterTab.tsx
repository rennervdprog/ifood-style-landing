import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Monitor, Lock, Unlock, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  storeId: string;
}

/**
 * Painel de status do PDV (mantém sincronia com a página /admin/pdv).
 * Lê `pdv_sessions` — a mesma tabela usada pela tela completa do PDV.
 */
const CashRegisterTab = ({ storeId }: Props) => {
  const navigate = useNavigate();

  const { data: session, isLoading } = useQuery({
    queryKey: ["pdv-session-status", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_sessions" as any)
        .select("id, opening_amount, opened_at, opened_by")
        .eq("store_id", storeId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando status do caixa…
      </div>
    );
  }

  const isOpen = !!session?.id;

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
      <div className={`rounded-2xl border-2 p-5 ${isOpen ? "bg-primary/5 border-primary/30" : "bg-muted/50 border-border"}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isOpen ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
            {isOpen ? <Unlock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-foreground text-base">
              {isOpen ? "Caixa aberto" : "Caixa fechado"}
            </h3>
            {isOpen ? (
              <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                <p>Troco inicial: <strong className="text-foreground">{formatBRL(Number(session.opening_amount) || 0)}</strong></p>
                {session.opened_at && (
                  <p>Aberto em {format(new Date(session.opened_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Para registrar vendas presenciais, abra o caixa na tela completa do PDV.
              </p>
            )}
          </div>
        </div>

        <Button
          onClick={() => navigate("/admin/pdv")}
          className="w-full mt-4 gap-2"
          size="lg"
        >
          <Monitor className="h-4 w-4" />
          {isOpen ? "Abrir PDV completo" : "Abrir caixa no PDV"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground text-center px-4">
        O status acima reflete o mesmo caixa da tela completa do PDV — abrir, fechar e movimentações são feitos por lá.
      </p>
    </div>
  );
};

export default CashRegisterTab;
