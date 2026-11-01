import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getStoreOpenStatus, todayInBrazil, type OpeningHour } from "@/lib/storeStatus";

// Semana inteira aberta 08:00–22:00 (day_of_week: 0=Domingo … 6=Sábado)
const allWeek: OpeningHour[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  day_of_week: d,
  open_time: "08:00",
  close_time: "22:00",
  is_closed_all_day: false,
}));

function at(isoLocal: string) {
  vi.setSystemTime(new Date(isoLocal));
}

describe("getStoreOpenStatus — feriados (store_holidays)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fecha a loja no dia do feriado cadastrado, com o motivo no reason", () => {
    at("2026-12-25T15:00:00-03:00"); // sexta-feira, Natal
    const s = getStoreOpenStatus(allWeek, false, true, undefined, [
      { date: "2026-12-25", reason: "Natal" },
    ]);
    expect(s.isOpen).toBe(false);
    expect(s.reason).toBe("Fechado — Natal");
  });

  it("sem motivo, usa o rótulo padrão de feriado", () => {
    at("2026-12-25T15:00:00-03:00");
    const s = getStoreOpenStatus(allWeek, false, true, undefined, [
      { date: "2026-12-25", reason: null },
    ]);
    expect(s.isOpen).toBe(false);
    expect(s.reason).toBe("Fechado — Feriado");
  });

  it("feriado em OUTRO dia não fecha a loja", () => {
    at("2026-12-25T15:00:00-03:00");
    const s = getStoreOpenStatus(allWeek, false, true, undefined, [
      { date: "2026-12-26", reason: "Natal" },
    ]);
    expect(s.isOpen).toBe(true);
    expect(s.reason).toBe("Aberto até 22:00");
  });

  it("forceClosed tem precedência sobre o feriado", () => {
    at("2026-12-25T15:00:00-03:00");
    const s = getStoreOpenStatus(allWeek, true, true, undefined, [
      { date: "2026-12-25", reason: "Natal" },
    ]);
    expect(s.isOpen).toBe(false);
    expect(s.reason).toBe("Fechado temporariamente");
  });

  it("feriado fecha mesmo sem horário semanal (fallback manual)", () => {
    at("2026-12-25T15:00:00-03:00");
    const s = getStoreOpenStatus([], false, true, undefined, [
      { date: "2026-12-25", reason: "Natal" },
    ]);
    expect(s.isOpen).toBe(false);
    expect(s.reason).toBe("Fechado — Natal");
  });

  it("sem feriados informados, o comportamento é o de antes", () => {
    at("2026-12-25T15:00:00-03:00");
    const s = getStoreOpenStatus(allWeek, false, true);
    expect(s.isOpen).toBe(true);
  });

  it("a próxima abertura pula o dia que é feriado", () => {
    // Loja só abre aos sábados 08:00–12:00. Sexta 25/12/2026 15:00 → o próximo
    // sábado (26/12) é feriado cadastrado; a abertura cai no sábado seguinte.
    const saturdayOnly: OpeningHour[] = [
      { day_of_week: 6, open_time: "08:00", close_time: "12:00", is_closed_all_day: false },
    ];
    at("2026-12-25T15:00:00-03:00");
    const s = getStoreOpenStatus(saturdayOnly, false, true, undefined, [
      { date: "2026-12-26", reason: "Fechamento especial" },
    ]);
    expect(s.isOpen).toBe(false);
    expect(s.nextOpenTime).toBe("08:00");
    expect(s.nextOpenDay).toBe("Sábado");
    expect(s.reason).toContain("Sábado");
  });
});

describe("todayInBrazil", () => {
  it("retorna a data do fuso de São Paulo, não a do relógio de origem", () => {
    // 26/12 01:00 em Tóquio = 25/12 13:00 em São Paulo
    expect(todayInBrazil(new Date("2026-12-26T01:00:00+09:00"))).toBe("2026-12-25");
    // 25/12 23:30 em São Paulo = 26/12 02:30 UTC — continua 25 no Brasil
    expect(todayInBrazil(new Date("2026-12-25T23:30:00-03:00"))).toBe("2026-12-25");
  });
});
