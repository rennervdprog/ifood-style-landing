/**
 * Regras do painel da Matriz e das sublojas — Fase 2 (plano 28/10/2026).
 *
 * Funções PURAS que espelham as regras aplicadas no banco pelas migrations
 * 20261028140000 / 20261028141000 / 20261028142000 / 20261028143000. A fonte
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

/**
 * Resultado estruturado de accept/decline_network_invite (bugfix Fase 2,
 * migration 20261028143000): o ramo de vencido devolve {ok:false, error}
 * em vez de levantar exceção, para o UPDATE para 'expired' persistir.
 */
export interface InviteActionResult {
  ok: boolean;
  storeId?: string;
  error?: string;
}

/** Interpreta o retorno jsonb de accept/decline_network_invite. */
export function parseInviteActionResult(data: unknown): InviteActionResult {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.ok === true) {
      return {
        ok: true,
        storeId: typeof d.store_id === "string" ? d.store_id : undefined,
      };
    }
    if (d.ok === false) {
      return {
        ok: false,
        error: typeof d.error === "string" ? d.error : "Convite inválido.",
      };
    }
  }
  return { ok: false, error: "Resposta inesperada do servidor." };
}

// ─── Herança de cardápio (Fase 3, migration 20261028170000) ────────────

/**
 * Resultado de clone_menu_from_matriz. A função antiga devolvia
 * {sections, products, addon_groups} e o painel lia
 * {categories_copied, products_copied} → 0/0 no toast (causa 2 do bug
 * "0 produtos copiados"). A reescrita devolve as chaves novas + as
 * legadas; o parser aceita as duas.
 */
export interface CloneMenuResult {
  categoriesCopied: number;
  productsCopied: number;
  productsSkipped: number;
  addonGroupsCopied: number;
  addonItemsCopied: number;
}

function asNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

/** Interpreta o retorno jsonb de clone_menu_from_matriz. */
export function parseCloneMenuResult(data: unknown): CloneMenuResult {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    categoriesCopied: asNonNegativeNumber(d.categories_copied ?? d.sections),
    productsCopied: asNonNegativeNumber(d.products_copied ?? d.products),
    productsSkipped: asNonNegativeNumber(d.products_skipped),
    addonGroupsCopied: asNonNegativeNumber(d.addon_groups_copied ?? d.addon_groups),
    addonItemsCopied: asNonNegativeNumber(d.addon_items_copied),
  };
}

/** Resultado de resync_menu_from_matriz. */
export interface ResyncMenuResult {
  categoriesCopied: number;
  categoriesUpdated: number;
  productsCopied: number;
  productsUpdated: number;
  productsPriceSynced: number;
  productsPriceSkipped: number;
  productsPriceOverwritten: number;
  addonGroupsCopied: number;
  addonGroupsUpdated: number;
  addonItemsCopied: number;
  addonItemsUpdated: number;
  productsRemovedFromMatriz: number;
}

/** Interpreta o retorno jsonb de resync_menu_from_matriz. */
export function parseResyncMenuResult(data: unknown): ResyncMenuResult {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    categoriesCopied: asNonNegativeNumber(d.categories_copied),
    categoriesUpdated: asNonNegativeNumber(d.categories_updated),
    productsCopied: asNonNegativeNumber(d.products_copied),
    productsUpdated: asNonNegativeNumber(d.products_updated),
    productsPriceSynced: asNonNegativeNumber(d.products_price_synced),
    productsPriceSkipped: asNonNegativeNumber(d.products_price_skipped),
    productsPriceOverwritten: asNonNegativeNumber(d.products_price_overwritten),
    addonGroupsCopied: asNonNegativeNumber(d.addon_groups_copied),
    addonGroupsUpdated: asNonNegativeNumber(d.addon_groups_updated),
    addonItemsCopied: asNonNegativeNumber(d.addon_items_copied),
    addonItemsUpdated: asNonNegativeNumber(d.addon_items_updated),
    productsRemovedFromMatriz: asNonNegativeNumber(d.products_removed_from_matriz),
  };
}

/**
 * Status de um produto na divergência (network_menu_divergence).
 *  - ok: preço igual e nenhum campo não-preço divergente.
 *  - divergente: preço igual, mas nome/descrição/imagem/disponibilidade/
 *    seção divergem (o re-sync atualiza esses campos).
 *  - preco_proprio: o dono mudou o preço depois do sync — o re-sync NÃO
 *    sobrescreve sem confirmação explícita (sobrescrever preços).
 *  - desatualizado: a matriz mudou o preço depois do sync — o re-sync
 *    atualiza.
 *  - novo_na_matriz: existe na matriz, ainda não foi copiado.
 *  - removido_na_matriz: cópia herdada cujo produto sumiu da matriz
 *    (o re-sync apenas reporta — nunca apaga na subloja).
 */
export type MenuDivergenceStatus =
  | "ok"
  | "divergente"
  | "preco_proprio"
  | "desatualizado"
  | "novo_na_matriz"
  | "removido_na_matriz";

export interface MenuDivergenceItem {
  networkCode: string;
  productName: string;
  matrizPrice: number | null;
  sublojaPrice: number | null;
  lastSyncedPrice: number | null;
  status: MenuDivergenceStatus;
  changedFields: string[];
}

const DIVERGENCE_STATUSES: readonly string[] = [
  "ok",
  "divergente",
  "preco_proprio",
  "desatualizado",
  "novo_na_matriz",
  "removido_na_matriz",
];

/** Rótulo exibido de cada status de divergência. */
export const MENU_DIVERGENCE_LABELS: Record<MenuDivergenceStatus, string> = {
  ok: "Sincronizado",
  divergente: "Divergente",
  preco_proprio: "Preço próprio",
  desatualizado: "Desatualizado",
  novo_na_matriz: "Novo na matriz",
  removido_na_matriz: "Removido na matriz",
};

/** Rótulo exibido de cada campo não-preço divergente. */
export const DIVERGENCE_FIELD_LABELS: Record<string, string> = {
  name: "nome",
  description: "descrição",
  image_url: "imagem",
  is_available: "disponibilidade",
  section: "seção",
};

/** Interpreta o retorno jsonb de network_menu_divergence. */
export function parseMenuDivergence(data: unknown): MenuDivergenceItem[] {
  if (!data || typeof data !== "object") return [];
  const items = (data as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
    .map((it) => {
      const rawStatus = typeof it.status === "string" ? it.status : "";
      const status: MenuDivergenceStatus = (DIVERGENCE_STATUSES as readonly string[]).includes(rawStatus)
        ? (rawStatus as MenuDivergenceStatus)
        : "ok";
      const changedFields = Array.isArray(it.changed_fields)
        ? it.changed_fields.filter((f): f is string => typeof f === "string")
        : [];
      return {
        networkCode: typeof it.network_code === "string" ? it.network_code : "",
        productName: typeof it.product_name === "string" ? it.product_name : "Produto",
        matrizPrice: typeof it.matriz_price === "number" ? it.matriz_price : null,
        sublojaPrice: typeof it.subloja_price === "number" ? it.subloja_price : null,
        lastSyncedPrice: typeof it.last_synced_price === "number" ? it.last_synced_price : null,
        status,
        changedFields,
      };
    });
}

/** Resumo da divergência: quantos itens em cada status que exige ação. */
export interface MenuDivergenceSummary {
  total: number;
  needsSync: number;
  ownPrice: number;
  newInMatriz: number;
  removedFromMatriz: number;
}

/** Conta os itens que pedem ação (tudo menos "ok"). */
export function summarizeMenuDivergence(items: readonly MenuDivergenceItem[]): MenuDivergenceSummary {
  const count = (s: MenuDivergenceStatus) => items.filter((it) => it.status === s).length;
  const needsSync = items.filter((it) => it.status !== "ok").length;
  return {
    total: items.length,
    needsSync,
    ownPrice: count("preco_proprio"),
    newInMatriz: count("novo_na_matriz"),
    removedFromMatriz: count("removido_na_matriz"),
  };
}

/**
 * Regra de preço do re-sync, espelhada do banco (para o painel decidir o
 * que avisar antes de sincronizar — o banco é quem aplica de verdade):
 * preço próprio = preço atual difere do preço da matriz E difere do
 * último sync (não-nulo). Sem registro de sync, trata como desatualizado.
 */
export function isOwnPrice(args: {
  matrizPrice: number | null;
  sublojaPrice: number | null;
  lastSyncedPrice: number | null;
}): boolean {
  if (args.matrizPrice === null || args.sublojaPrice === null) return false;
  if (args.matrizPrice === args.sublojaPrice) return false;
  if (args.lastSyncedPrice === null) return false;
  return args.sublojaPrice !== args.lastSyncedPrice;
}
