import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarClock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

/**
 * Card de configuração de Pré-pedido (agendamento de abertura).
 * Permite ao lojista aceitar pedidos X minutos antes do horário de abertura.
 * Os pedidos ficam com status `scheduled` e são liberados automaticamente
 * para `pendente` pela função `release_scheduled_orders()` (pg_cron 1 min).
 */
export const PreorderSettingsCard = ({ storeId }: { storeId: string }) => {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["store-preorder", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("preorder_enabled, preorder_minutes_before")
        .eq("id", storeId)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
  });

  useEffect(() => {
    if (data) {
      setEnabled(!!(data as any).preorder_enabled);
      setMinutes(Number((data as any).preorder_minutes_before ?? 60));
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    const m = Math.max(0, Math.min(240, Math.round(minutes || 0)));
    const { error } = await supabase
      .from("stores")
      .update({ preorder_enabled: enabled, preorder_minutes_before: m } as any)
      .eq("id", storeId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar pré-pedido");
      return;
    }
    toast.success("Pré-pedido salvo!");
    queryClient.invalidateQueries({ queryKey: ["store-preorder", storeId] });
  };

  return (
    <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Pré-pedido</span>
          {enabled && (
            <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary border-0">
              Ativo
            </Badge>
          )}
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Aceita pedidos <strong>antes</strong> do horário de abertura. Eles ficam aguardando e
        são disparados automaticamente (som + WhatsApp + impressão) no horário oficial.
      </p>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] text-muted-foreground font-semibold">
            Aceitar até (minutos antes da abertura)
          </label>
          <input
            type="number"
            min={0}
            max={240}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            disabled={!enabled}
            className="w-full bg-card text-foreground px-3 py-2 rounded-xl text-xs border border-border/50 focus:border-primary focus:outline-none min-h-[40px] disabled:opacity-50"
          />
        </div>
        <Button
          onClick={save}
          disabled={saving}
          size="sm"
          className="rounded-xl min-h-[40px] bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Save className="h-3.5 w-3.5 mr-1" /> Salvar
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground/60 italic">
        💡 Ex: 60 min = se você abre às 18h, começa a receber pedidos às 17h.
      </p>
    </div>
  );
};

export default PreorderSettingsCard;