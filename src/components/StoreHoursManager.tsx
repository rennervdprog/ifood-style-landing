import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Save, AlertTriangle, Power } from "lucide-react";

const dayLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

interface HourRow {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed_all_day: boolean;
}

const defaultHours: HourRow[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  open_time: "08:00",
  close_time: "22:00",
  is_closed_all_day: i === 0, // Sunday closed by default
}));

const StoreHoursManager = ({ storeId, forceClosed }: { storeId: string; forceClosed: boolean }) => {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState<HourRow[]>(defaultHours);
  const [saving, setSaving] = useState(false);
  const [localForceClosed, setLocalForceClosed] = useState(forceClosed);

  const { data: savedHours } = useQuery({
    queryKey: ["opening-hours", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opening_hours")
        .select("*")
        .eq("store_id", storeId)
        .order("day_of_week");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (savedHours && savedHours.length > 0) {
      const merged = defaultHours.map(dh => {
        const saved = savedHours.find((s: any) => s.day_of_week === dh.day_of_week);
        return saved
          ? {
              day_of_week: saved.day_of_week,
              open_time: (saved as any).open_time?.slice(0, 5) || "08:00",
              close_time: (saved as any).close_time?.slice(0, 5) || "22:00",
              is_closed_all_day: (saved as any).is_closed_all_day,
            }
          : dh;
      });
      setHours(merged);
    }
  }, [savedHours]);

  useEffect(() => {
    setLocalForceClosed(forceClosed);
  }, [forceClosed]);

  const updateHour = (day: number, field: keyof HourRow, value: any) => {
    setHours(prev => prev.map(h => h.day_of_week === day ? { ...h, [field]: value } : h));
  };

  const saveSchedule = async () => {
    setSaving(true);
    // Delete all existing then insert fresh
    await supabase.from("opening_hours").delete().eq("store_id", storeId);
    
    const rows = hours.map(h => ({
      store_id: storeId,
      day_of_week: h.day_of_week,
      open_time: h.open_time + ":00",
      close_time: h.close_time + ":00",
      is_closed_all_day: h.is_closed_all_day,
    }));

    const { error } = await supabase.from("opening_hours").insert(rows as any);
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar horários.");
      return;
    }

    // Find next open day/time for feedback
    const now = new Date();
    const currentDay = now.getDay();
    let feedbackMsg = "Configurações salvas!";
    for (let offset = 0; offset < 7; offset++) {
      const day = (currentDay + offset) % 7;
      const h = hours.find(hr => hr.day_of_week === day);
      if (h && !h.is_closed_all_day) {
        if (offset === 0) {
          feedbackMsg += ` Aberto hoje até ${h.close_time}.`;
        } else {
          feedbackMsg += ` Próxima abertura: ${dayLabels[day]} às ${h.open_time}.`;
        }
        break;
      }
    }

    toast.success(feedbackMsg);
    queryClient.invalidateQueries({ queryKey: ["opening-hours", storeId] });
  };

  const toggleForceClosed = async () => {
    const next = !localForceClosed;
    const { error } = await supabase
      .from("stores")
      .update({ force_closed: next } as any)
      .eq("id", storeId);

    if (error) {
      toast.error("Erro ao atualizar.");
      return;
    }

    setLocalForceClosed(next);
    toast.success(next ? "🚨 Loja fechada manualmente!" : "✅ Loja reaberta! Horário automático ativo.");
    queryClient.invalidateQueries({ queryKey: ["my-store"] });
  };

  return (
    <div className="space-y-4">
      {/* Emergency close button */}
      <div
        className={`rounded-2xl p-4 border-2 ${
          localForceClosed
            ? "bg-red-500/10 border-red-500"
            : "bg-muted/50 border-border"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`h-5 w-5 ${localForceClosed ? "text-red-400" : "text-muted-foreground"}`} />
            <div>
              <p className="text-sm font-bold text-foreground">Fechamento Manual</p>
              <p className="text-xs text-muted-foreground">
                {localForceClosed
                  ? "Loja fechada manualmente. Horário automático ignorado."
                  : "Desative para fechar a loja imediatamente."}
              </p>
            </div>
          </div>
          <button
            onClick={toggleForceClosed}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] ${
              localForceClosed
                ? "bg-primary text-primary-foreground"
                : "bg-red-500 text-foreground"
            }`}
          >
            <Power className="h-4 w-4" />
            {localForceClosed ? "Reabrir" : "🚨 Fechar Agora"}
          </button>
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-card rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Horários de Funcionamento</h3>
        </div>

        <div className="space-y-2">
          {hours.map((h) => (
            <div
              key={h.day_of_week}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                h.is_closed_all_day ? "bg-muted/50 opacity-60" : "bg-secondary"
              }`}
            >
              {/* Day label */}
              <div className="w-20 flex-shrink-0">
                <span className="text-xs font-bold text-foreground/80">
                  {dayLabels[h.day_of_week].slice(0, 3)}
                </span>
              </div>

              {/* Toggle */}
              <button
                onClick={() => updateHour(h.day_of_week, "is_closed_all_day", !h.is_closed_all_day)}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                  h.is_closed_all_day ? "bg-muted" : "bg-primary"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    h.is_closed_all_day ? "left-0.5" : "left-6"
                  }`}
                />
              </button>

              {/* Time inputs */}
              {!h.is_closed_all_day ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={h.open_time}
                    onChange={(e) => updateHour(h.day_of_week, "open_time", e.target.value)}
                    className="bg-muted text-foreground px-2 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none w-[90px]"
                  />
                  <span className="text-muted-foreground/70 text-xs">às</span>
                  <input
                    type="time"
                    value={h.close_time}
                    onChange={(e) => updateHour(h.day_of_week, "close_time", e.target.value)}
                    className="bg-muted text-foreground px-2 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none w-[90px]"
                  />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground/70 italic">Fechado</span>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={saveSchedule}
          disabled={saving}
          className="w-full mt-4 bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50 min-h-[44px]"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Cronograma"}
        </button>
      </div>
    </div>
  );
};

export default StoreHoursManager;
