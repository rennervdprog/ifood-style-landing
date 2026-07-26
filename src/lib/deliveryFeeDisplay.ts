/**
 * Fonte única de verdade (frontend) para exibir a taxa de entrega ao cliente.
 * Espelha exatamente a RPC `public.compute_store_delivery_fee(_store_id)`.
 *
 * Regras (mesmas do backend):
 *  - pickup           → sem taxa ("Retirada")
 *  - platform         → base = delivery_fee (já inclui split); sem soma extra
 *  - own + cliente    → total = own_delivery_fee + split_full
 *  - own + meio       → total = own_delivery_fee + round(split_full/2)
 *  - own + lojista    → total = own_delivery_fee (split sai do repasse)
 *  - plan_type=autonomy OU autonomy_lifetime_free → split_full = 0
 *  - platform_delivery_split_override (numeric) sobrescreve o admin_settings
 *
 * Não somar 0,99 cegamente. Não duplicar defaults.
 */
import { formatBRL } from "@/lib/utils";

const DEFAULT_ADMIN_SPLIT = 0.99;

export interface FeeDisplay {
  label: string;
  prefix?: "A partir de";
  free: boolean;
  customerTotal: number;
  baseFee: number;
  platformAddCustomer: number;
}

interface StoreLike {
  delivery_mode?: string | null;
  own_delivery_fee?: number | string | null;
  delivery_fee?: number | string | null;
  platform_fee_split?: "cliente" | "meio_a_meio" | "lojista" | string | null;
  plan_type?: string | null;
  platform_delivery_split_override?: number | string | null;
  autonomy_lifetime_free?: boolean | null;
}

export function describeStoreFee(store: StoreLike, adminSplit = DEFAULT_ADMIN_SPLIT): FeeDisplay {
  const mode = store?.delivery_mode || "platform";

  if (mode === "pickup") {
    return { label: "Retirada", free: false, customerTotal: 0, baseFee: 0, platformAddCustomer: 0 };
  }

  const isAutonomy =
    store?.plan_type === "autonomy" || store?.autonomy_lifetime_free === true;

  const overrideRaw = store?.platform_delivery_split_override;
  const overrideNum =
    overrideRaw === null || overrideRaw === undefined || overrideRaw === ""
      ? null
      : Number(overrideRaw);
  const baseSplit =
    overrideNum != null && Number.isFinite(overrideNum) ? overrideNum : adminSplit;
  const splitFull = isAutonomy ? 0 : baseSplit;

  if (mode === "platform") {
    const base = Number(store?.delivery_fee ?? 0);
    const total = base;
    return {
      label: total <= 0 ? "Grátis" : formatBRL(total),
      prefix: total <= 0 ? undefined : "A partir de",
      free: total <= 0,
      customerTotal: total,
      baseFee: base,
      platformAddCustomer: 0,
    };
  }

  // own delivery
  const base = Number(store?.own_delivery_fee ?? 0);
  const splitMode = (store?.platform_fee_split || "cliente") as string;
  let addCustomer = 0;
  if (splitMode === "cliente") addCustomer = splitFull;
  else if (splitMode === "meio_a_meio") addCustomer = Math.round((splitFull / 2) * 100) / 100;
  // lojista → 0

  const total = base + addCustomer;
  return {
    label: total <= 0 ? "Grátis" : formatBRL(total),
    prefix: total <= 0 ? undefined : "A partir de",
    free: total <= 0,
    customerTotal: total,
    baseFee: base,
    platformAddCustomer: addCustomer,
  };
}
