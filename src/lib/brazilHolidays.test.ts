import { describe, it, expect } from "vitest";
import { BRAZIL_HOLIDAYS, pendingBrazilHolidays } from "@/lib/brazilHolidays";
import { todayInBrazil } from "@/lib/storeStatus";

describe("BRAZIL_HOLIDAYS — base de feriados nacionais", () => {
  it("está ordenada, sem duplicatas, só com 2026–2027", () => {
    const dates = BRAZIL_HOLIDAYS.map((h) => h.date);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates.every((d) => d.startsWith("2026") || d.startsWith("2027"))).toBe(true);
  });

  it("datas móveis batem com a Páscoa de cada ano", () => {
    const byDate = new Map(BRAZIL_HOLIDAYS.map((h) => [h.date, h]));
    // Páscoa 2026 = 05/04 → Sexta-feira Santa 03/04; Corpus Christi 04/06
    expect(byDate.get("2026-04-03")?.name).toBe("Sexta-feira Santa");
    expect(byDate.get("2026-06-04")?.name).toBe("Corpus Christi");
    // Páscoa 2027 = 28/03 → Sexta-feira Santa 26/03; Carnaval 08–09/02
    expect(byDate.get("2027-03-26")?.name).toBe("Sexta-feira Santa");
    expect(byDate.get("2027-02-08")?.name).toBe("Carnaval");
    expect(byDate.get("2027-02-09")?.kind).toBe("facultativo");
  });

  it("feriados fixos principais estão presentes como nacionais", () => {
    const byDate = new Map(BRAZIL_HOLIDAYS.map((h) => [h.date, h]));
    expect(byDate.get("2026-12-25")).toMatchObject({ name: "Natal", kind: "nacional" });
    expect(byDate.get("2027-09-07")).toMatchObject({ name: "Independência do Brasil", kind: "nacional" });
    expect(byDate.get("2027-11-20")).toMatchObject({ name: "Dia da Consciência Negra", kind: "nacional" });
  });

  it("os dias da semana das datas conferem (Natal/2026 cai numa sexta)", () => {
    const natal = BRAZIL_HOLIDAYS.find((h) => h.date === "2026-12-25")!;
    // getUTCDay: 5 = sexta-feira
    expect(new Date(natal.date + "T12:00:00Z").getUTCDay()).toBe(5);
  });
});

describe("pendingBrazilHolidays", () => {
  it("não sugere datas passadas nem já cadastradas", () => {
    const pending = pendingBrazilHolidays([]);
    const today = todayInBrazil();
    expect(pending.every((h) => h.date >= today)).toBe(true);

    const allButLast = BRAZIL_HOLIDAYS.slice(0, -1).map((h) => h.date);
    expect(pendingBrazilHolidays(allButLast)).toEqual([BRAZIL_HOLIDAYS[BRAZIL_HOLIDAYS.length - 1]]);
  });
});
