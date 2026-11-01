// Utility to check if a store is currently open based on opening_hours and force_closed

export interface OpeningHour {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed_all_day: boolean;
}

/** Feriado/fechamento em data específica cadastrado pelo lojista (store_holidays). */
export interface StoreHoliday {
  /** Data no formato yyyy-MM-dd (calendário de America/Sao_Paulo). */
  date: string;
  reason?: string | null;
}

export interface StoreStatusResult {
  isOpen: boolean;
  reason: string; // e.g. "Abre às 15:00" or "Aberto até 22:00"
  nextOpenTime?: string;
  nextOpenDay?: string;
  /** Loja fechada, mas aceitando pré-pedidos que serão disparados na abertura */
  acceptingPreorder?: boolean;
  /** ISO string do momento em que o pré-pedido será liberado para o lojista */
  releaseAt?: string;
}

const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const brDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data de hoje (yyyy-MM-dd) no fuso America/Sao_Paulo. */
export function todayInBrazil(now: Date = new Date()): string {
  return brDayFmt.format(now);
}

function dateStrOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function getStoreOpenStatus(
  hours: OpeningHour[],
  forceClosed: boolean,
  isOpenManual: boolean,
  preorder?: { enabled: boolean; minutesBefore: number },
  holidays?: StoreHoliday[]
): StoreStatusResult {
  if (forceClosed) {
    return { isOpen: false, reason: "Fechado temporariamente" };
  }

  // Feriado cadastrado pelo lojista fecha a loja o dia inteiro, mesmo sem
  // horário semanal configurado (a data é uma decisão explícita da loja).
  const todayHoliday = holidays?.find((h) => h.date === todayInBrazil());
  if (todayHoliday) {
    return {
      isOpen: false,
      reason: todayHoliday.reason ? `Fechado — ${todayHoliday.reason}` : "Fechado — Feriado",
    };
  }

  // If no hours configured, fall back to manual is_open
  if (!hours || hours.length === 0) {
    return isOpenManual
      ? { isOpen: true, reason: "Aberto" }
      : { isOpen: false, reason: "Fechado" };
  }

  // Force Brazil timezone (UTC-3) to avoid device timezone differences
  const now = new Date();
  const brFmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = brFmt.formatToParts(now);
  const brHour = Number(parts.find(p => p.type === "hour")?.value ?? 0);
  const brMinute = Number(parts.find(p => p.type === "minute")?.value ?? 0);

  // Get day of week in Brazil timezone
  const brDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const currentDay = brDate.getDay(); // 0=Sunday
  const currentMinutes = brHour * 60 + brMinute;

  const todayHours = hours.find(h => h.day_of_week === currentDay);

  // Fase 7 (L18): verifica se o horário de ONTEM (overnight) ainda está válido hoje
  // Ex: terça 18h-02h, à 00:30 de quarta a loja está aberta pelo horário da terça
  const yesterdayDay = (currentDay + 6) % 7;
  const yesterdayHours = hours.find(h => h.day_of_week === yesterdayDay);
  if (yesterdayHours && !yesterdayHours.is_closed_all_day) {
    const [yOpenH, yOpenM] = yesterdayHours.open_time.split(":").map(Number);
    const [yCloseH, yCloseM] = yesterdayHours.close_time.split(":").map(Number);
    const yOpenMinutes = yOpenH * 60 + yOpenM;
    const yCloseMinutes = yCloseH * 60 + yCloseM;
    // Overnight: fecha depois da meia-noite
    if (yCloseMinutes <= yOpenMinutes && currentMinutes < yCloseMinutes) {
      return {
        isOpen: true,
        reason: `Aberto até ${yesterdayHours.close_time.slice(0, 5)}`,
      };
    }
  }

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
      const preorderActive =
        preorder?.enabled === true &&
        (preorder.minutesBefore ?? 0) > 0 &&
        currentMinutes >= openMinutes - (preorder.minutesBefore ?? 0);
      const releaseDate = new Date(brDate);
      releaseDate.setHours(openH, openM, 0, 0);
      return {
        isOpen: false,
        acceptingPreorder: preorderActive,
        releaseAt: preorderActive ? releaseDate.toISOString() : undefined,
        reason: `Abre hoje às ${todayHours.open_time.slice(0, 5)}`,
        nextOpenTime: todayHours.open_time.slice(0, 5),
        nextOpenDay: "Hoje",
      };
    }
  }

  // Find next open day (pula dias fechados na semana E feriados cadastrados)
  for (let offset = 1; offset <= 14; offset++) {
    const nextDay = (currentDay + offset) % 7;
    const nextHours = hours.find(h => h.day_of_week === nextDay);
    const candidate = new Date(brDate);
    candidate.setDate(candidate.getDate() + offset);
    const isHoliday = holidays?.some((h) => h.date === dateStrOf(candidate));
    if (nextHours && !nextHours.is_closed_all_day && !isHoliday) {
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
