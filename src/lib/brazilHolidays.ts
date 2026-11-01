import { todayInBrazil } from "@/lib/storeStatus";

/**
 * Base de feriados nacionais do Brasil (fixos + móveis calculados pela Páscoa),
 * usada no painel do lojista como SUGESTÃO: nada fecha automaticamente a partir
 * desta lista — a loja só fecha nos feriados que o lojista adicionar aos seus
 * `store_holidays`. `facultativo` = ponto facultativo federal (Carnaval, Cinzas,
 * Corpus Christi): não é feriado por lei, mas muitas lojas fecham ou mudam o horário.
 */
export interface BrazilHoliday {
  /** yyyy-MM-dd */
  date: string;
  name: string;
  kind: "nacional" | "facultativo";
}

export const BRAZIL_HOLIDAYS: BrazilHoliday[] = [
  // 2026
  { date: "2026-01-01", name: "Confraternização Universal", kind: "nacional" },
  { date: "2026-02-16", name: "Carnaval", kind: "facultativo" },
  { date: "2026-02-17", name: "Carnaval", kind: "facultativo" },
  { date: "2026-02-18", name: "Quarta-feira de Cinzas", kind: "facultativo" },
  { date: "2026-04-03", name: "Sexta-feira Santa", kind: "nacional" },
  { date: "2026-04-21", name: "Tiradentes", kind: "nacional" },
  { date: "2026-05-01", name: "Dia do Trabalhador", kind: "nacional" },
  { date: "2026-06-04", name: "Corpus Christi", kind: "facultativo" },
  { date: "2026-09-07", name: "Independência do Brasil", kind: "nacional" },
  { date: "2026-10-12", name: "Nossa Senhora Aparecida", kind: "nacional" },
  { date: "2026-11-02", name: "Finados", kind: "nacional" },
  { date: "2026-11-15", name: "Proclamação da República", kind: "nacional" },
  { date: "2026-11-20", name: "Dia da Consciência Negra", kind: "nacional" },
  { date: "2026-12-25", name: "Natal", kind: "nacional" },
  // 2027
  { date: "2027-01-01", name: "Confraternização Universal", kind: "nacional" },
  { date: "2027-02-08", name: "Carnaval", kind: "facultativo" },
  { date: "2027-02-09", name: "Carnaval", kind: "facultativo" },
  { date: "2027-02-10", name: "Quarta-feira de Cinzas", kind: "facultativo" },
  { date: "2027-03-26", name: "Sexta-feira Santa", kind: "nacional" },
  { date: "2027-04-21", name: "Tiradentes", kind: "nacional" },
  { date: "2027-05-01", name: "Dia do Trabalhador", kind: "nacional" },
  { date: "2027-05-27", name: "Corpus Christi", kind: "facultativo" },
  { date: "2027-09-07", name: "Independência do Brasil", kind: "nacional" },
  { date: "2027-10-12", name: "Nossa Senhora Aparecida", kind: "nacional" },
  { date: "2027-11-02", name: "Finados", kind: "nacional" },
  { date: "2027-11-15", name: "Proclamação da República", kind: "nacional" },
  { date: "2027-11-20", name: "Dia da Consciência Negra", kind: "nacional" },
  { date: "2027-12-25", name: "Natal", kind: "nacional" },
];

/** Feriados nacionais de hoje em diante que a loja ainda NÃO cadastrou. */
export function pendingBrazilHolidays(registeredDates: Iterable<string>): BrazilHoliday[] {
  const today = todayInBrazil();
  const registered = new Set(registeredDates);
  return BRAZIL_HOLIDAYS.filter((h) => h.date >= today && !registered.has(h.date));
}
