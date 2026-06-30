import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Clock, Save, Power, Plus, Trash2, Copy, CalendarOff,
  CalendarPlus, ChevronDown, ChevronUp, Zap, Pause, MoonStar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStoreOpenStatus } from "@/lib/storeStatus";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PreorderSettingsCard } from "@/components/PreorderSettingsCard";

const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const dayLabelsFull = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

interface Shift {
  open_time: string;
  close_time: string;
}

interface DaySchedule {
  day_of_week: number;
  is_closed: boolean;
  shifts: Shift[];
}

interface HolidayClosure {
  id?: string;
  date: string; // YYYY-MM-DD
  label: string;
}

interface ScheduledPause {
  id?: string;
  starts_at: string;
  ends_at: string;
  reason: string;
}

const defaultShift = (): Shift => ({ open_time: "08:00", close_time: "22:00" });

const createDefaultSchedule = (): DaySchedule[] =>
  Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    is_closed: i === 0,
    shifts: [defaultShift()],
  }));

// Time options for dropdowns (every 15 min)
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

const TimeSelect = ({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    aria-label={label}
    className="bg-card text-foreground px-2.5 py-2 rounded-xl text-xs font-semibold border border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none appearance-none cursor-pointer min-h-[40px] w-[80px]"
  >
    {TIME_OPTIONS.map((t) => (
      <option key={t} value={t}>
        {t}
      </option>
    ))}
  </select>
);

const StoreHoursManager = ({ storeId, forceClosed }: { storeId: string; forceClosed: boolean }) => {
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<DaySchedule[]>(createDefaultSchedule());
  const [saving, setSaving] = useState(false);
  const [localForceClosed, setLocalForceClosed] = useState(forceClosed);
  const [holidays, setHolidays] = useState<HolidayClosure[]>([]);
  const [showHolidays, setShowHolidays] = useState(false);
  const [holidayDate, setHolidayDate] = useState<Date | undefined>();
  const [holidayLabel, setHolidayLabel] = useState("");
  const [pauses, setPauses] = useState<ScheduledPause[]>([]);
  const [showPauses, setShowPauses] = useState(false);
  const [pauseForm, setPauseForm] = useState({ date: format(new Date(), "yyyy-MM-dd"), starts: "14:00", ends: "16:00", reason: "" });

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

  // Load persisted holidays
  const { data: savedHolidays } = useQuery({
    queryKey: ["store-holidays", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_holidays")
        .select("id, date, reason")
        .eq("store_id", storeId)
        .order("date");
      if (error) return [];
      return data || [];
    },
  });

  useEffect(() => {
    if (savedHolidays) {
      setHolidays(
        (savedHolidays as any[]).map((h) => ({ id: h.id, date: h.date, label: h.reason || "Feriado" })),
      );
    }
  }, [savedHolidays]);

  // Load scheduled pauses (future + ongoing)
  const { data: savedPauses } = useQuery({
    queryKey: ["store-pauses", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_pauses")
        .select("id, starts_at, ends_at, reason")
        .eq("store_id", storeId)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at");
      if (error) return [];
      return data || [];
    },
  });

  useEffect(() => {
    if (savedPauses) {
      setPauses(
        (savedPauses as any[]).map((p) => ({
          id: p.id,
          starts_at: p.starts_at,
          ends_at: p.ends_at,
          reason: p.reason || "",
        })),
      );
    }
  }, [savedPauses]);

  // Merge saved hours into schedule (support multiple shifts per day)
  useEffect(() => {
    if (savedHours && savedHours.length > 0) {
      const dayMap: Record<number, { closed: boolean; shifts: Shift[] }> = {};
      for (let i = 0; i < 7; i++) {
        dayMap[i] = { closed: false, shifts: [] };
      }
      savedHours.forEach((row: any) => {
        const d = row.day_of_week;
        if (row.is_closed_all_day) {
          dayMap[d].closed = true;
        } else {
          dayMap[d].shifts.push({
            open_time: (row.open_time || "08:00").slice(0, 5),
            close_time: (row.close_time || "22:00").slice(0, 5),
          });
        }
      });
      const merged: DaySchedule[] = Array.from({ length: 7 }, (_, i) => ({
        day_of_week: i,
        is_closed: dayMap[i].closed || dayMap[i].shifts.length === 0 && savedHours.some((r: any) => r.day_of_week === i),
        shifts: dayMap[i].shifts.length > 0 ? dayMap[i].shifts : [defaultShift()],
      }));
      // Fix: if DB has rows but all are closed, ensure is_closed
      merged.forEach((m) => {
        const hasDbRows = savedHours.some((r: any) => r.day_of_week === m.day_of_week);
        const allClosed = savedHours
          .filter((r: any) => r.day_of_week === m.day_of_week)
          .every((r: any) => r.is_closed_all_day);
        if (hasDbRows && allClosed) {
          m.is_closed = true;
        }
      });
      setSchedule(merged);
    }
  }, [savedHours]);

  useEffect(() => {
    setLocalForceClosed(forceClosed);
  }, [forceClosed]);

  // Compute real-time status
  const storeStatus = useMemo(() => {
    const openingHours = schedule.flatMap((day) =>
      day.is_closed
        ? [{ day_of_week: day.day_of_week, open_time: "00:00", close_time: "00:00", is_closed_all_day: true }]
        : day.shifts.map((s) => ({
            day_of_week: day.day_of_week,
            open_time: s.open_time,
            close_time: s.close_time,
            is_closed_all_day: false,
          }))
    );
    return getStoreOpenStatus(openingHours, localForceClosed, true);
  }, [schedule, localForceClosed]);

  const updateDay = (dayIndex: number, update: Partial<DaySchedule>) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day_of_week === dayIndex ? { ...d, ...update } : d))
    );
  };

  const updateShift = (dayIndex: number, shiftIndex: number, field: keyof Shift, value: string) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.day_of_week !== dayIndex) return d;
        const newShifts = [...d.shifts];
        newShifts[shiftIndex] = { ...newShifts[shiftIndex], [field]: value };
        return { ...d, shifts: newShifts };
      })
    );
  };

  const addShift = (dayIndex: number) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.day_of_week !== dayIndex) return d;
        return { ...d, shifts: [...d.shifts, { open_time: "18:00", close_time: "23:00" }] };
      })
    );
  };

  const removeShift = (dayIndex: number, shiftIndex: number) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.day_of_week !== dayIndex || d.shifts.length <= 1) return d;
        return { ...d, shifts: d.shifts.filter((_, i) => i !== shiftIndex) };
      })
    );
  };

  const applyToAll = (sourceDay: number) => {
    const source = schedule.find((d) => d.day_of_week === sourceDay);
    if (!source) return;
    setSchedule((prev) =>
      prev.map((d) =>
        d.day_of_week === sourceDay
          ? d
          : { ...d, is_closed: source.is_closed, shifts: source.shifts.map((s) => ({ ...s })) }
      )
    );
    toast.success(`Horário de ${dayLabelsFull[sourceDay]} aplicado a todos os dias!`);
  };

  const addHoliday = async () => {
    if (!holidayDate) return;
    const dateStr = format(holidayDate, "yyyy-MM-dd");
    if (holidays.some((h) => h.date === dateStr)) {
      toast.error("Data já adicionada.");
      return;
    }
    const reason = holidayLabel || "Feriado";
    const { data, error } = await (supabase as any)
      .from("store_holidays")
      .insert({ store_id: storeId, date: dateStr, reason })
      .select("id")
      .single();
    if (error) { toast.error("Erro ao salvar feriado."); return; }
    setHolidays((prev) => [...prev, { id: data?.id, date: dateStr, label: reason }]);
    setHolidayDate(undefined);
    setHolidayLabel("");
    toast.success("Feriado salvo!");
    queryClient.invalidateQueries({ queryKey: ["store-holidays", storeId] });
  };

  const removeHoliday = async (h: HolidayClosure) => {
    if (h.id) {
      const { error } = await (supabase as any).from("store_holidays").delete().eq("id", h.id);
      if (error) { toast.error("Erro ao remover."); return; }
    }
    setHolidays((prev) => prev.filter((x) => x.date !== h.date));
    toast.success("Feriado removido.");
    queryClient.invalidateQueries({ queryKey: ["store-holidays", storeId] });
  };

  const addPause = async () => {
    const starts = new Date(`${pauseForm.date}T${pauseForm.starts}:00`).toISOString();
    const ends = new Date(`${pauseForm.date}T${pauseForm.ends}:00`).toISOString();
    if (new Date(ends) <= new Date(starts)) { toast.error("Horário final deve ser depois do início."); return; }
    const { data, error } = await (supabase as any)
      .from("store_pauses")
      .insert({ store_id: storeId, starts_at: starts, ends_at: ends, reason: pauseForm.reason || null })
      .select("id, starts_at, ends_at, reason")
      .single();
    if (error) { toast.error("Erro ao agendar pausa."); return; }
    setPauses((prev) => [...prev, { id: data.id, starts_at: data.starts_at, ends_at: data.ends_at, reason: data.reason || "" }]);
    setPauseForm({ ...pauseForm, reason: "" });
    toast.success("Pausa programada!");
    queryClient.invalidateQueries({ queryKey: ["store-pauses", storeId] });
  };

  const removePause = async (id?: string) => {
    if (!id) return;
    const { error } = await (supabase as any).from("store_pauses").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover."); return; }
    setPauses((prev) => prev.filter((p) => p.id !== id));
    toast.success("Pausa removida.");
    queryClient.invalidateQueries({ queryKey: ["store-pauses", storeId] });
  };

  const saveSchedule = async () => {
    setSaving(true);
    await supabase.from("opening_hours").delete().eq("store_id", storeId);

    const rows: any[] = [];
    schedule.forEach((day) => {
      if (day.is_closed) {
        rows.push({
          store_id: storeId,
          day_of_week: day.day_of_week,
          open_time: "00:00:00",
          close_time: "00:00:00",
          is_closed_all_day: true,
        });
      } else {
        day.shifts.forEach((shift) => {
          rows.push({
            store_id: storeId,
            day_of_week: day.day_of_week,
            open_time: shift.open_time + ":00",
            close_time: shift.close_time + ":00",
            is_closed_all_day: false,
          });
        });
      }
    });

    const { error } = await supabase.from("opening_hours").insert(rows as any);
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar horários.");
      return;
    }

    toast.success("Horários salvos com sucesso! ✅");
    queryClient.invalidateQueries({ queryKey: ["opening-hours", storeId] });
    queryClient.invalidateQueries({ queryKey: ["store-hours", storeId] });
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
    toast.success(next ? "🚨 Loja fechada manualmente!" : "✅ Loja reaberta!");
    queryClient.invalidateQueries({ queryKey: ["my-store"] });
  };

  return (
    <div className="space-y-5">
      {/* Real-time status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full animate-pulse ${
              storeStatus.isOpen ? "bg-primary shadow-lg shadow-primary/40" : "bg-muted-foreground"
            }`}
          />
          <div>
            <span
              className={`text-lg font-black tracking-tight ${
                storeStatus.isOpen ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {storeStatus.isOpen ? "LOJA ABERTA" : "LOJA FECHADA"}
            </span>
            <p className="text-[10px] text-muted-foreground">{storeStatus.reason}</p>
          </div>
        </div>
        <Button
          onClick={toggleForceClosed}
          variant="outline"
          size="sm"
          className={cn(
            "rounded-xl font-bold text-xs gap-1.5 min-h-[40px]",
            localForceClosed
              ? "border-primary/30 text-primary hover:bg-primary/10"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          <Power className="h-3.5 w-3.5" />
          {localForceClosed ? "Reabrir" : "Fechar Agora"}
        </Button>
      </div>

      {/* Force closed warning */}
      {localForceClosed && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
            <Power className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Fechamento de Emergência Ativo</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A loja está fechada manualmente. Horários automáticos estão ignorados.
            </p>
          </div>
        </div>
      )}

      {/* Schedule Cards */}
      <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/30 overflow-hidden">
        <div className="p-4 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold text-foreground">Horários da Semana</h3>
          </div>
        </div>

        <div className="divide-y divide-border/20">
          {schedule.map((day) => (
            <div key={day.day_of_week} className="p-3">
              {/* Day header row */}
              <div className="flex items-center gap-3 mb-2">
                {/* Day label */}
                <div className="w-10">
                  <span
                    className={`text-xs font-black ${
                      day.is_closed ? "text-muted-foreground/50" : "text-foreground"
                    }`}
                  >
                    {dayLabels[day.day_of_week]}
                  </span>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => updateDay(day.day_of_week, { is_closed: !day.is_closed })}
                  className={`relative w-11 h-6 rounded-full transition-all duration-200 shrink-0 ${
                    day.is_closed
                      ? "bg-muted-foreground/20"
                      : "bg-primary shadow-sm shadow-primary/30"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                      day.is_closed ? "left-0.5" : "left-[22px]"
                    }`}
                  />
                </button>

                {day.is_closed ? (
                  <span className="text-[10px] text-muted-foreground/50 italic flex-1">Fechado</span>
                ) : (
                  <div className="flex-1" />
                )}

                {/* Apply to all button */}
                {!day.is_closed && (
                  <button
                    onClick={() => applyToAll(day.day_of_week)}
                    className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors font-semibold shrink-0"
                    title="Aplicar a todos os dias"
                  >
                    <Copy className="h-3 w-3" />
                    <span className="hidden sm:inline">Aplicar a todos</span>
                  </button>
                )}
              </div>

              {/* Shifts */}
              {!day.is_closed && (
                <div className="space-y-2 ml-[52px]">
                  {day.shifts.map((shift, si) => (
                    <div key={si} className="flex items-center gap-2">
                      <TimeSelect
                        value={shift.open_time}
                        onChange={(v) => updateShift(day.day_of_week, si, "open_time", v)}
                        label={`Abertura turno ${si + 1}`}
                      />
                      <span className="text-[10px] text-muted-foreground">às</span>
                      <TimeSelect
                        value={shift.close_time}
                        onChange={(v) => updateShift(day.day_of_week, si, "close_time", v)}
                        label={`Fechamento turno ${si + 1}`}
                      />
                      {day.shifts.length > 1 && (
                        <button
                          onClick={() => removeShift(day.day_of_week, si)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {shift.close_time <= shift.open_time && (
                        <span title="Atravessa a meia-noite" className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                          <MoonStar className="h-3 w-3" /> +1d
                        </span>
                      )}
                    </div>
                  ))}
                  {/* Add shift button */}
                  <button
                    onClick={() => addShift(day.day_of_week)}
                    className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors font-semibold"
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar turno
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <Button
        onClick={saveSchedule}
        disabled={saving}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 min-h-[48px]"
        size="lg"
      >
        <Save className="h-4 w-4" />
        {saving ? "Salvando..." : "Salvar Cronograma"}
      </Button>

      {/* Holiday / Special dates section */}
      <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/30 overflow-hidden">
        <button
          onClick={() => setShowHolidays(!showHolidays)}
          className="w-full p-4 flex items-center justify-between hover:bg-card/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground">Feriados & Exceções</span>
            {holidays.length > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground border-0">
                {holidays.length}
              </Badge>
            )}
          </div>
          {showHolidays ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showHolidays && (
          <div className="p-4 pt-0 space-y-3">
            <p className="text-[10px] text-muted-foreground">
              Programe fechamentos em datas específicas sem alterar a rotina semanal.
            </p>

            {/* Add holiday */}
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold">Data</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-left text-xs font-normal rounded-xl min-h-[40px]",
                        !holidayDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                      {holidayDate ? format(holidayDate, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={holidayDate}
                      onSelect={setHolidayDate}
                      disabled={(date) => date < new Date()}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold">Motivo (opcional)</label>
                <input
                  type="text"
                  value={holidayLabel}
                  onChange={(e) => setHolidayLabel(e.target.value)}
                  placeholder="Ex: Natal"
                  className="w-full bg-card text-foreground px-3 py-2 rounded-xl text-xs border border-border/50 focus:border-primary focus:outline-none min-h-[40px]"
                />
              </div>
              <Button
                onClick={addHoliday}
                disabled={!holidayDate}
                size="sm"
                className="rounded-xl min-h-[40px] bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Holiday list */}
            {holidays.length > 0 ? (
              <div className="space-y-1.5">
                {holidays
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((h) => (
                    <div
                      key={h.date}
                      className="flex items-center justify-between bg-muted rounded-xl p-2.5 border border-border"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarOff className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">
                          {format(new Date(h.date + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                        </span>
                        {h.label && (
                          <span className="text-[10px] text-muted-foreground">— {h.label}</span>
                        )}
                      </div>
                      <button
                        onClick={() => removeHoliday(h)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground/50 text-center py-2">
                Nenhum feriado configurado.
              </p>
            )}

            <p className="text-[10px] text-muted-foreground/50 italic">
              💡 Feriados ficam salvos no servidor e fecham a loja automaticamente na data.
            </p>
          </div>
        )}
      </div>

      {/* Pausa programada (hoje/data específica, sem mexer no recorrente) */}
      <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/30 overflow-hidden">
        <button
          onClick={() => setShowPauses(!showPauses)}
          className="w-full p-4 flex items-center justify-between hover:bg-card/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Pause className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground">Pausa Programada</span>
            {pauses.length > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground border-0">
                {pauses.length}
              </Badge>
            )}
          </div>
          {showPauses ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showPauses && (
          <div className="p-4 pt-0 space-y-3">
            <p className="text-[10px] text-muted-foreground">
              Fecha a loja apenas em uma janela específica (ex: 14h às 16h hoje) sem mexer no horário recorrente.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold">Data</label>
                <input
                  type="date"
                  value={pauseForm.date}
                  onChange={(e) => setPauseForm({ ...pauseForm, date: e.target.value })}
                  className="w-full bg-card text-foreground px-3 py-2 rounded-xl text-xs border border-border/50 focus:border-primary focus:outline-none min-h-[40px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold">Motivo (opcional)</label>
                <input
                  type="text"
                  value={pauseForm.reason}
                  onChange={(e) => setPauseForm({ ...pauseForm, reason: e.target.value })}
                  placeholder="Ex: Almoço da equipe"
                  className="w-full bg-card text-foreground px-3 py-2 rounded-xl text-xs border border-border/50 focus:border-primary focus:outline-none min-h-[40px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold">Início</label>
                <select
                  value={pauseForm.starts}
                  onChange={(e) => setPauseForm({ ...pauseForm, starts: e.target.value })}
                  className="w-full bg-card text-foreground px-3 py-2 rounded-xl text-xs border border-border/50 focus:border-primary focus:outline-none min-h-[40px]"
                >
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold">Fim</label>
                <select
                  value={pauseForm.ends}
                  onChange={(e) => setPauseForm({ ...pauseForm, ends: e.target.value })}
                  className="w-full bg-card text-foreground px-3 py-2 rounded-xl text-xs border border-border/50 focus:border-primary focus:outline-none min-h-[40px]"
                >
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <Button onClick={addPause} size="sm" className="w-full rounded-xl min-h-[40px] bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-3.5 w-3.5" /> Agendar pausa
            </Button>
            {pauses.length > 0 ? (
              <div className="space-y-1.5">
                {pauses.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-muted rounded-xl p-2.5 border border-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <Pause className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-semibold text-foreground truncate">
                        {format(new Date(p.starts_at), "dd/MM HH:mm", { locale: ptBR })} → {format(new Date(p.ends_at), "HH:mm", { locale: ptBR })}
                      </span>
                      {p.reason && <span className="text-[10px] text-muted-foreground truncate">— {p.reason}</span>}
                    </div>
                    <button onClick={() => removePause(p.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground/50 text-center py-2">Nenhuma pausa programada.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreHoursManager;
