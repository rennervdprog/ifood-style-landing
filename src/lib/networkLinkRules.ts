/**
 * Regras do sistema de Matriz e Sublojas — Fase 1 (plano 28/10/2026).
 *
 * Funções PURAS que espelham as regras aplicadas no banco pelas migrations
 * 20261028130000 / 20261028131000 / 20261028132000 / 20261028133000.
 * A fonte da verdade é o banco (RLS + triggers + SECURITY DEFINER); estas
 * funções existem para o app decidir o que mostrar/habilitar e para os
 * testes unitários — nunca para autorizar nada sozinhas.
 *
 * Decisões aplicadas (não mudar sem a palavra do Renner):
 *  - Decisão 1: 1 mensalidade por rede cobre até 3 sublojas grátis; a partir
 *    da 4ª subloja, R$ 39,90 por subloja adicional.
 *  - Decisão 2: gratuidade por rede — soma do GMV das sublojas em 60 dias
 *    <= R$ 5.000 → a rede não paga nada (nem mensalidade, nem os R$ 39,90).
 *  - Decisão 4: limite de 10 sublojas por matriz (contando só as sublojas).
 *  - Decisão 5: a rede nasce aprovada.
 *  - Decisão 6: loja só-PDV não conta nos 3 grátis nem paga os R$ 39,90.
 */

/** Campos de vínculo do perfil — só admin/dono (via função) podem mudar. */
export const PROFILE_LINK_FIELDS = [
  "unit_store_id",
  "network_id",
  "role",
] as const;

export type ProfileLinkField = (typeof PROFILE_LINK_FIELDS)[number];

/** Campos de administração da rede — só o admin da plataforma muda. */
export const NETWORK_ADMIN_FIELDS = [
  "is_approved",
  "max_units",
  "plan_type",
  "monthly_fee",
  "owner_id",
  "matriz_store_id",
] as const;

export type NetworkAdminField = (typeof NETWORK_ADMIN_FIELDS)[number];

/** Preço da subloja adicional a partir da 4ª (decisão 1). */
export const EXTRA_UNIT_MONTHLY_FEE = 39.9;

/** Sublojas grátis incluídas na mensalidade da rede (decisão 1). */
export const FREE_UNITS_INCLUDED = 3;

/** Teto de GMV em 60 dias para a rede não pagar nada (decisão 2). */
export const NETWORK_FREE_GMV_THRESHOLD = 5000;

/** Limite de sublojas por matriz (decisão 4). */
export const MAX_UNITS_PER_NETWORK = 10;

/** Validade do convite de gerente, em dias (plano 4.3). */
export const NETWORK_INVITE_VALIDITY_DAYS = 7;

export type ActorKind = "platform_admin" | "network_owner" | "common";

/**
 * Quem pode mudar os campos de vínculo (unit_store_id / network_id / role)
 * de um perfil? Espelha o trigger `prevent_role_self_change` + a policy
 * "Users can update own profile" (migration 20261028131000).
 * - admin da plataforma: pode (também via service_role nas funções);
 * - usuário comum no PRÓPRIO perfil: NÃO pode;
 * - dono da rede no perfil DE OUTRA pessoa: NÃO pode direto — só pela
 *   função SECURITY DEFINER `link_unit_user` / `unlink_unit_user`.
 */
export function canChangeProfileLinkFields(actor: ActorKind): boolean {
  return actor === "platform_admin";
}

/**
 * Uma atualização de perfil é permitida? `changedFields` são os campos que
 * a atualização tenta mudar. Campos comuns (nome, telefone, avatar...)
 * continuam editáveis pelo próprio usuário; campo de vínculo, só admin.
 */
export function canUpdateProfile(
  actor: ActorKind,
  changedFields: readonly string[],
): boolean {
  if (changedFields.some((f) => (PROFILE_LINK_FIELDS as readonly string[]).includes(f))) {
    return canChangeProfileLinkFields(actor);
  }
  return true;
}

/**
 * Quem pode mudar os campos de administração da rede (aprovação, limite,
 * plano, mensalidade, dono, loja-matriz)? Espelha o trigger
 * `prevent_network_self_admin` (migration 20261028130000). O dono só edita
 * nome e logo.
 */
export function canChangeNetworkAdminFields(actor: ActorKind): boolean {
  return actor === "platform_admin";
}

/** Uma atualização da rede é permitida? */
export function canUpdateNetwork(
  actor: ActorKind,
  changedFields: readonly string[],
): boolean {
  if (changedFields.some((f) => (NETWORK_ADMIN_FIELDS as readonly string[]).includes(f))) {
    return canChangeNetworkAdminFields(actor);
  }
  return true;
}

/**
 * Quem pode criar subloja, vincular/desvincular gerente? Só o dono da rede
 * ou o admin — e sempre via função SECURITY DEFINER, nunca por escrita
 * direta na tabela (plano 4.2).
 */
export function canManageNetworkUnits(actor: ActorKind): boolean {
  return actor === "platform_admin" || actor === "network_owner";
}

/**
 * Quantas sublojas contam para o limite? Só as sublojas — a matriz não
 * entra (M1: o teto real era 9 porque a matriz era contada).
 */
export function countBillableUnitsForLimit(
  stores: readonly { is_matriz?: boolean | null }[],
): number {
  return stores.filter((s) => !s.is_matriz).length;
}

/** Ainda cabe mais uma subloja na rede? (decisão 4: 10 sublojas) */
export function canCreateUnit(unitCount: number, maxUnits = MAX_UNITS_PER_NETWORK): boolean {
  return unitCount < maxUnits;
}

/**
 * Mensalidade da rede (decisão 1 + decisão 2 + decisão 6).
 * - `deliveryUnitCount`: sublojas de delivery (só-PDV NÃO entra aqui:
 *   decisão 6 — loja só-PDV não conta nos 3 grátis nem paga os R$ 39,90).
 * - `gmv60d`: soma do GMV das sublojas em 60 dias (PDV conta — decisão 11).
 * - `baseMonthlyFee`: mensalidade do plano da rede (ex.: Essencial R$ 89,90).
 * Retorna 0 quando a rede está na gratuidade (GMV <= R$ 5.000).
 */
export function calcNetworkMonthlyFee(args: {
  baseMonthlyFee: number;
  deliveryUnitCount: number;
  gmv60d: number;
}): number {
  const { baseMonthlyFee, deliveryUnitCount, gmv60d } = args;
  if (gmv60d <= NETWORK_FREE_GMV_THRESHOLD) return 0;
  const extraUnits = Math.max(0, deliveryUnitCount - FREE_UNITS_INCLUDED);
  return baseMonthlyFee + extraUnits * EXTRA_UNIT_MONTHLY_FEE;
}

/** Status do convite de gerente. */
export type NetworkInviteStatus = "pending" | "accepted" | "declined" | "expired";

/**
 * O convite ainda pode ser aceito? Precisa estar pendente e dentro da
 * validade de 7 dias (plano 4.3).
 */
export function canAcceptInvite(
  status: NetworkInviteStatus,
  expiresAt: string | Date,
  now: Date = new Date(),
): boolean {
  if (status !== "pending") return false;
  return new Date(expiresAt).getTime() > now.getTime();
}

/** O convite venceu (ainda pendente, mas fora da validade)? */
export function isInviteExpired(
  status: NetworkInviteStatus,
  expiresAt: string | Date,
  now: Date = new Date(),
): boolean {
  return status === "pending" && new Date(expiresAt).getTime() <= now.getTime();
}
