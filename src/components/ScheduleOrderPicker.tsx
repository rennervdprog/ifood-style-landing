import { useState } from "react";
import { Calendar, Clock } from "lucide-react";

interface ScheduleOrderPickerProps {
  onSchedule: (dateTime: string | null) => void;
  scheduled: string | null;
}

const ScheduleOrderPicker = ({ onSchedule, scheduled }: ScheduleOrderPickerProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const today = new Date();
  const minDate = today.toISOString().split("T")[0];
  const maxDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const handleConfirm = () => {
    if (selectedDate && selectedTime) {
      const dt = new Date(`${selectedDate}T${selectedTime}:00`);
      if (dt.getTime() < Date.now() + 30 * 60 * 1000) {
        return; // at least 30 min in future
      }
      onSchedule(dt.toISOString());
      setShowPicker(false);
    }
  };

  const handleClear = () => {
    onSchedule(null);
    setSelectedDate("");
    setSelectedTime("");
    setShowPicker(false);
  };

  if (scheduled) {
    const dt = new Date(scheduled);
    return (
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" />
          <div>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">Agendado para</p>
            <p className="text-sm font-bold text-foreground">
              {dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })} às {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <button onClick={handleClear} className="text-xs text-blue-500 font-bold hover:underline">
          Remover
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <Calendar className="h-3.5 w-3.5" />
        Agendar para depois
      </button>

      {showPicker && (
        <div className="mt-2 bg-card border border-border rounded-xl p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-bold">Data</label>
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full mt-1 px-2 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold">Horário</label>
              <input
                type="time"
                value={selectedTime}
                onChange={e => setSelectedTime(e.target.value)}
                className="w-full mt-1 px-2 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={!selectedDate || !selectedTime}
              className="flex-1 bg-primary text-primary-foreground font-bold py-2 rounded-lg text-xs disabled:opacity-50"
            >
              Confirmar Agendamento
            </button>
            <button
              onClick={() => setShowPicker(false)}
              className="px-3 py-2 rounded-lg border border-border text-muted-foreground text-xs"
            >
              Cancelar
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">Mínimo 30 minutos a partir de agora</p>
        </div>
      )}
    </div>
  );
};

export default ScheduleOrderPicker;
