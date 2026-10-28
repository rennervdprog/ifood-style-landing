/**
 * Regras do painel da Matriz e das sublojas — Fase 2 (plano 28/10/2026).
 *
 * Funções PURAS que espelham as regras aplicadas no banco pelas migrations
 * 20261028140000 / 20261028141000 / 20261028142000. A fonte da verdade é o
 * banco (RLS + triggers + SECURITY DEFINER); estas funções existem para o
 * app decidir o que mostrar/habilitar e para os testes unitários — nunca
 * para autorizar nada sozinhas.
 *
 * Decisões aplicadas (não mudar sem a palavra do Renner):
 *  - Decisão 2 (matriz só apresenta): a loja-matriz é a página-guia do
 *    grupo e NÃO vende — nunca entra na lista de sublojas nem na contagem.
 *  - Decisão 4: limite de 10 sublojas por matriz (contando só sublojas).
 *  - Decisão 9: matriz pausada pausa as sublojas junto (com confirmação).
 *  - C9/M8: a subloja nasce RASCUNHO invisível e só entra na vitrine com
 *    o checklist completo (endereço, horário, cardápio, entregador).
 *  - Decisão 1: a subloja não tem mensalidade própria (plano de R$ 0).
 */

export type UnitChecklistKey = "address" | "hours" | "menu" | "driver";

export interface UnitChecklist {
  store_id: string;
  is_draft: boolean;
  address: boolean;
  hours: boolean;
  menu: boolean;
  driver: boolean;
  ready: boolean;
}

/** Rótulo de cada item do checklist (mesma ordem da tela). */
export const CHECKLIST_LABELS: Record<UnitChecklistKey, string> = {
  address: "Endereço completo",
  hours: "Horário configurado",
  menu: "Cardápio com produto disponível",
  driver: "Entregador aceito",
};

export const CHECKLIST_KEYS: UnitChecklistKey[] = [
  "address",
  "hours",
  "menu",
  "driver",
];

/** Quantos itens do checklist estão prontos (0–4). */
export function checklistDoneCount(checklist: Pick<UnitChecklist, UnitChecklistKey>): number {
  return CHECKLIST_KEYS.filter((k) => checklist[k]).length;
}

/** O checklist está completo? (espelha o `ready` do banco). */
export function isChecklistReady(checklist: Pick<UnitChecklist, UnitChecklistKey>): boolean {
  return CHECKLIST_KEYS.every((k) => checklist[k]);
}

/** Rótulos dos itens que ainda faltam concluir. */
export function checklistMissingLabels(
  checklist: Pick<UnitChecklist, UnitChecklistKey>,
): string[] {
  return CHECKLIST_KEYS.filter((k) => !checklist[k]).map((k) => CHECKLIST_LABELS[k]);
}

/** Chaves dos itens que ainda faltam concluir. */
export function checklistMissingKeys(
  checklist: Pick<UnitChecklist, UnitChecklistKey>,
): UnitChecklistKey[] {
  return CHECKLIST_KEYS.filter((k) => !checklist[k]);
}

/** Status exibido da subloja na lista do painel da matriz. */
export type UnitDisplayStatus = "draft" | "paused" | "active" | "pending";

/**
 * Resolve o status exibido — rascunho primeiro (nunca vendeu), depois
 * pausa (force_closed pela pausa da rede), depois ativa.
 */
export function resolveUnitDisplayStatus(unit: {
  is_draft?: boolean | null;
  force_closed?: boolean | null;
  status?: string | null;
}): UnitDisplayStatus {
  if (unit.is_draft) return "draft";
  if (unit.force_closed) return "paused";
  if (unit.status === "ativo") return "active";
  return "pending";
}

/** Selo do status da subloja. */
export const UNIT_STATUS_LABELS: Record<UnitDisplayStatus, string> = {
  draft: "RASCUNHO",
  paused: "PAUSADA",
  active: "ATIVA",
  pending: "PENDENTE",
};

/** A subloja pode ser publicada? Precisa ser rascunho com checklist pronto. */
export function canPublishUnit(
  unit: { is_draft?: boolean | null },
  checklist: Pick<UnitChecklist, UnitChecklistKey> | null | undefined,
): boolean {
  if (!unit.is_draft) return false;
  if (!checklist) return false;
  return isChecklistReady(checklist);
}

/** Uma loja da rede é subloja (vende) ou é a matriz-guia (só apresenta)? */
export function isSubloja(store: { is_matriz?: boolean | null }): boolean {
  return !store.is_matriz;
}

/** Filtra só as sublojas de uma lista de lojas da rede. */
export function onlySublojas<T extends { is_matriz?: boolean | null }>(stores: readonly T[]): T[] {
  return stores.filter(isSubloja);
}

/** A loja-matriz (guia) de uma lista de lojas da rede, se houver. */
export function findMatrizStore<T extends { is_matriz?: boolean | null }>(
  stores: readonly T[],
): T | undefined {
  return stores.find((s) => s.is_matriz);
}

/**
 * Gera o slug da subloja a partir do nome (mesma regra do formulário de
 * criação): minúsculas, sem acento, só [a-z0-9-].
 */
export function slugifyUnitName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface CreateUnitForm {
  name: string;
  slug: string;
  category: string;
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_cep: string;
  delivery_fee: string;
  delivery_radius: string;
  minimum_order_value: string;
}

/** Campos obrigatórios do formulário de criação (C9/M8). */
export const CREATE_UNIT_REQUIRED_FIELDS: {
  key: keyof CreateUnitForm;
  label: string;
}[] = [
  { key: "name", label: "Nome da unidade" },
  { key: "slug", label: "Slug (URL única)" },
  { key: "address_street", label: "Rua" },
  { key: "address_number", label: "Número" },
  { key: "address_neighborhood", label: "Bairro" },
  { key: "address_city", label: "Cidade" },
  { key: "address_cep", label: "CEP" },
];

/**
 * Valida o formulário de criação — devolve a lista de problemas (vazia =
 * pode enviar). Espelha a validação do banco em create_network_unit.
 */
export function validateCreateUnitForm(form: CreateUnitForm): string[] {
  const problems: string[] = [];
  for (const field of CREATE_UNIT_REQUIRED_FIELDS) {
    if (!form[field.key].trim()) {
      problems.push(`Preencha ${field.label.toLowerCase()}.`);
    }
  }
  if (form.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
    problems.push("O slug só aceita letras minúsculas, números e hífen.");
  }
  for (const [key, label] of [
    ["delivery_fee", "taxa de entrega"],
    ["delivery_radius", "raio de entrega"],
    ["minimum_order_value", "pedido mínimo"],
  ] as const) {
    const raw = form[key].trim().replace(",", ".");
    if (raw !== "" && (Number.isNaN(Number(raw)) || Number(raw) < 0)) {
      problems.push(`A ${label} precisa ser um valor maior ou igual a zero.`);
    }
  }
  return problems;
}

/** Converte o campo monetário do formulário para número ou null. */
export function parseMoneyField(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isNaN(value) ? null : value;
}

/** Link de aceite do convite de gerente (o código é o segredo). */
export function buildInviteLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/convite-rede/${code}`;
}

/** O convite está vencido para exibição (mesma regra do banco: 7 dias)? */
export function isInvitePastDue(expiresAt: string | Date, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
