// Mensalidades (Teste, Fase 6) — helpers puros, sem React/Supabase.
// Decisão do Renner (28/10 ~06:58): a tela inclui os planos Somente PDV —
// o MRR vira R$ 1.071,50 (igual ao Consolidado) e a Silvia aparece na lista.
// A lógica de linha/estatísticas é a mesma do MensalidadesPanel original,
// só muda a lista de tipos aceitos (pdv_only entra) e o vencimento passa
// a ser exibido (o painel já tinha o dado, mas não mostrava).

/** Tipos de plano listados na tela Mensalidades (Teste). */
export const MENSALIDADES_PLAN_TYPES = [
  "fixed",
  "supporter",
  "autonomy",
  "pdv_only",
] as const;

export type MensalidadeStatus = "em_dia" | "atrasado" | "trial" | "inativo";

export interface MensalidadeRow {
  store_id: string;
  name: string;
  store_status: string;
  plan_type: string;
  monthly: number;
  status: MensalidadeStatus;
  daysLate: number;
  nextBilling: string | null;
  lastBilled: string | null;
  /** Fim do trial (só exibição — o CSV continua sem essa coluna). */
  trialEnds: string | null;
  monthsActive: number;
  ltv: number;
}

export interface MensalidadePlanInput {
  store_id: string;
  plan_type: string;
  monthly_fee: number | string | null;
  next_billing_date: string | null;
  last_billed_at: string | null;
  trial_ends_at: string | null;
  started_at: string | null;
  is_active: boolean | null;
}

export interface MensalidadeStoreInput {
  id: string;
  name: string;
  is_test: boolean | null;
  status: string | null;
}

/**
 * Monta uma linha a partir do plano + loja — mesma lógica do painel
 * original, verbatim (status, atraso, meses ativo, LTV), só com o
 * trialEnds a mais, para exibir "trial até DD/MM".
 */
export function buildMensalidadeRow(
  p: MensalidadePlanInput,
  s: MensalidadeStoreInput | undefined,
  now: Date,
): MensalidadeRow | null {
  if (!s || s.is_test) return null;
  const trialActive = p.trial_ends_at && new Date(p.trial_ends_at) > now;
  const nextBilling = p.next_billing_date ? new Date(p.next_billing_date) : null;
  const daysLate = nextBilling
    ? Math.floor((now.getTime() - nextBilling.getTime()) / 86400000)
    : 0;
  const monthly = Number(p.monthly_fee || 0);
  let status: MensalidadeStatus = "em_dia";
  if (!p.is_active) status = "inativo";
  else if (trialActive) status = "trial";
  else if (daysLate > 0 && monthly > 0) status = "atrasado";
  const startedAt = p.started_at ? new Date(p.started_at) : null;
  const monthsActive = startedAt
    ? Math.max(1, Math.floor((now.getTime() - startedAt.getTime()) / (86400000 * 30)))
    : 1;
  return {
    store_id: p.store_id,
    name: s.name as string,
    store_status: s.status as string,
    plan_type: p.plan_type as string,
    monthly,
    status,
    daysLate: Math.max(0, daysLate),
    nextBilling: p.next_billing_date,
    lastBilled: p.last_billed_at,
    trialEnds: p.trial_ends_at ?? null,
    monthsActive,
    ltv: monthly * monthsActive,
  };
}

/** Mesma ordenação de hoje: maior atraso primeiro, depois maior mensalidade. */
export function sortMensalidadeRows(rows: MensalidadeRow[]): MensalidadeRow[] {
  return [...rows].sort((a, b) => b.daysLate - a.daysLate || b.monthly - a.monthly);
}

export interface MensalidadesStats {
  mrr: number;
  inadAmt: number;
  inadPct: number;
  ativos: number;
  /** Ativas com mensalidade acima de R$ 0,00. */
  paying: number;
  avgMonths: number;
  avgLtv: number;
  inadCount: number;
}

/** Mesma fórmula do painel original — agora contando os Somente PDV. */
export function computeMensalidadesStats(rows: MensalidadeRow[]): MensalidadesStats {
  const active = rows.filter((r) => r.status !== "inativo");
  const mrr = active.reduce((s, r) => s + r.monthly, 0);
  const inad = rows.filter((r) => r.status === "atrasado");
  const inadAmt = inad.reduce((s, r) => s + r.monthly, 0);
  const inadPct = active.length ? (inad.length / active.length) * 100 : 0;
  const avgMonths = active.length
    ? active.reduce((s, r) => s + r.monthsActive, 0) / active.length
    : 0;
  const avgLtv = active.length
    ? active.reduce((s, r) => s + r.ltv, 0) / active.length
    : 0;
  const paying = active.filter((r) => r.monthly > 0).length;
  return { mrr, inadAmt, inadPct, ativos: active.length, paying, avgMonths, avgLtv, inadCount: inad.length };
}

export interface UpcomingCharges {
  count: number;
  total: number;
  names: string[];
  /** "04/11" quando todas caem no mesmo dia; "04/11 a 09/11" se espalham. */
  dateLabel: string | null;
}

/**
 * Cobranças que vencem nos próximos `days` dias (só mensalidade > 0, fora
 * trial — em trial não há cobrança — e fora inativas). A comparação é por
 * DATA de calendário (UTC, como os vencimentos são gravados): de hoje até
 * hoje+`days`, inclusive. Não pode ser `now + 7d` exato — as cobranças de
 * 04/11 são às 14:41 e cairiam fora da janela por ~3h.
 */
export function upcomingCharges(
  rows: MensalidadeRow[],
  now: Date,
  days = 7,
): UpcomingCharges {
  const today = now.toISOString().slice(0, 10);
  const cutoffDate = new Date(now.getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);
  const list = rows.filter((r) => {
    if (r.monthly <= 0 || r.status === "inativo" || r.status === "trial") return false;
    if (!r.nextBilling) return false;
    const d = r.nextBilling.slice(0, 10);
    return d >= today && d <= cutoffDate;
  });
  const total = list.reduce((s, r) => s + r.monthly, 0);
  const dates = [...new Set(list.map((r) => formatShortDate(r.nextBilling)))];
  return {
    count: list.length,
    total,
    names: list.map((r) => r.name),
    dateLabel:
      dates.length === 1
        ? dates[0]
        : dates.length > 1
          ? `${dates[0]} a ${dates[dates.length - 1]}`
          : null,
  };
}

/** "2026-11-04T14:41:11.878+00" -> "04/11". Só a parte de calendário. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}`;
}
