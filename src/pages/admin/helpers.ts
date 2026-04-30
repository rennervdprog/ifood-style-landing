export const parseOrderAddons = (rawAddons: unknown): any[] => {
  if (Array.isArray(rawAddons)) return rawAddons;
  if (typeof rawAddons === "string") {
    try {
      const parsed = JSON.parse(rawAddons);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const normalizeAddonName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const pad2 = (value: number) => String(value).padStart(2, "0");

export function parseDashboardDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;

  const dmy = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    let yearNum = parseInt(y, 10);
    if (yearNum < 100) yearNum += 2000;

    const dayNum = parseInt(d, 10);
    const monthNum = parseInt(m, 10);
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;

    const result = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
    if (result.getUTCDate() !== dayNum || result.getUTCMonth() !== monthNum - 1) return null;
    return result;
  }

  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const yearNum = parseInt(iso[1], 10);
    const monthNum = parseInt(iso[2], 10);
    const dayNum = parseInt(iso[3], 10);
    const result = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
    if (result.getUTCDate() !== dayNum || result.getUTCMonth() !== monthNum - 1) return null;
    return result;
  }

  const isoDateTime = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:?\d{2,4})?$/);
  if (isoDateTime) {
    const [, y, m, d, hh, mm, ss = "0", ms = "0", tz] = isoDateTime;
    const yearNum = parseInt(y, 10);
    const monthNum = parseInt(m, 10);
    const dayNum = parseInt(d, 10);
    const hourNum = parseInt(hh, 10);
    const minuteNum = parseInt(mm, 10);
    const secondNum = parseInt(ss, 10);
    const milliNum = parseInt((ms || "0").slice(0, 3).padEnd(3, "0"), 10);

    if (tz === "Z") {
      return new Date(Date.UTC(yearNum, monthNum - 1, dayNum, hourNum, minuteNum, secondNum, milliNum));
    }

    if (tz) {
      const sign = tz.startsWith("-") ? -1 : 1;
      const clean = tz.slice(1).replace(":", "");
      const offsetHours = parseInt(clean.slice(0, 2), 10);
      const offsetMinutes = parseInt(clean.slice(2, 4) || "0", 10);
      const offsetTotalMinutes = sign * (offsetHours * 60 + offsetMinutes);
      const utcMillis = Date.UTC(yearNum, monthNum - 1, dayNum, hourNum, minuteNum, secondNum, milliNum) - offsetTotalMinutes * 60 * 1000;
      return new Date(utcMillis);
    }

    return new Date(yearNum, monthNum - 1, dayNum, hourNum, minuteNum, secondNum, milliNum);
  }

  return null;
}

export const toLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
};

export const formatDateKeyPtBR = (dateKey: string) => {
  const iso = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : dateKey;
};

export const getPeriodDateKeys = (days: number, offsetDays = 0) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i + offsetDays));
    return toLocalDateKey(d);
  });
};