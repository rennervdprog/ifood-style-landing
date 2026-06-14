/**
 * Promo price helpers — usados em card, modal, carrinho, checkout.
 * Lê os campos novos da tabela `products`:
 *   promo_active, promo_price, promo_starts_at, promo_ends_at
 */

export interface PromoFields {
  price?: number | string | null;
  promo_active?: boolean | null;
  promo_price?: number | string | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
}

export function isPromoActive(p: PromoFields | null | undefined, now: Date = new Date()): boolean {
  if (!p?.promo_active) return false;
  const promo = Number(p.promo_price);
  if (!Number.isFinite(promo) || promo <= 0) return false;
  if (p.promo_starts_at && new Date(p.promo_starts_at) > now) return false;
  if (p.promo_ends_at && new Date(p.promo_ends_at) < now) return false;
  return true;
}

export function getEffectivePrice(p: PromoFields | null | undefined, now: Date = new Date()): number {
  if (!p) return 0;
  if (isPromoActive(p, now)) return Number(p.promo_price);
  return Number(p.price ?? 0);
}

export function getOriginalPrice(p: PromoFields | null | undefined): number {
  return Number(p?.price ?? 0);
}

/** Percentual de desconto arredondado, ex: 36 (%) */
export function getPromoDiscountPct(p: PromoFields | null | undefined): number | null {
  if (!isPromoActive(p)) return null;
  const original = Number(p?.price ?? 0);
  const promo = Number(p?.promo_price ?? 0);
  if (original <= 0 || promo <= 0 || promo >= original) return null;
  return Math.round(((original - promo) / original) * 100);
}