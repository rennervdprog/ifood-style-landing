// Utility to check if a store is currently open based on opening_hours and force_closed

export interface OpeningHour {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed_all_day: boolean;
}

export interface StoreStatusResult {
  isOpen: boolean;
  reason: string; // e.g. "Abre às 15:00" or "Aberto até 22:00"
  nextOpenTime?: string;
  nextOpenDay?: string;
}

const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function getStoreOpenStatus(
  hours: OpeningHour[],
  forceClosed: boolean,
  isOpenManual: boolean
): StoreStatusResult {
  if (forceClosed) {
    return { isOpen: false, reason: "Fechado temporariamente" };
  }

  // If no hours configured, fall back to manual is_open
  if (!hours || hours.length === 0) {
    return isOpenManual
      ? { isOpen: true, reason: "Aberto" }
      : { isOpen: false, reason: "Fechado" };
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0=Sunday
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todayHours = hours.find(h => h.day_of_week === currentDay);

  if (todayHours && !todayHours.is_closed_all_day) {
    const [openH, openM] = todayHours.open_time.split(":").map(Number);
    const [closeH, closeM] = todayHours.close_time.split(":").map(Number);
    const openMinutes = openH * 60 + openM;
    let closeMinutes = closeH * 60 + closeM;

    // Handle overnight (e.g. 18:00 - 02:00)
    if (closeMinutes <= openMinutes) {
      // If current time is after opening OR before closing (next day)
      if (currentMinutes >= openMinutes || currentMinutes < closeMinutes) {
        return {
          isOpen: true,
          reason: `Aberto até ${todayHours.close_time.slice(0, 5)}`,
        };
      }
    } else {
      if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
        return {
          isOpen: true,
          reason: `Aberto até ${todayHours.close_time.slice(0, 5)}`,
        };
      }
    }

    // Store is closed now but opens later today
    if (currentMinutes < openMinutes) {
      return {
        isOpen: false,
        reason: `Abre hoje às ${todayHours.open_time.slice(0, 5)}`,
        nextOpenTime: todayHours.open_time.slice(0, 5),
        nextOpenDay: "Hoje",
      };
    }
  }

  // Find next open day
  for (let offset = 1; offset <= 7; offset++) {
    const nextDay = (currentDay + offset) % 7;
    const nextHours = hours.find(h => h.day_of_week === nextDay);
    if (nextHours && !nextHours.is_closed_all_day) {
      const dayLabel = offset === 1 ? "Amanhã" : dayNames[nextDay];
      return {
        isOpen: false,
        reason: `Abre ${dayLabel} às ${nextHours.open_time.slice(0, 5)}`,
        nextOpenTime: nextHours.open_time.slice(0, 5),
        nextOpenDay: dayLabel,
      };
    }
  }

  return { isOpen: false, reason: "Fechado" };
}
