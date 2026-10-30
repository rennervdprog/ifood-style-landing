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
 *  - own + km (delivery_fee_type='km') → base = delivery_fee_base (piso "a partir de");
 *    o valor final por distância continua vindo da cotação do servidor (quote-delivery)
 *  - plan_type=autonomy OU autonomy_lifetime_free → split_full = 0
 *  - platform_split_effective (resolvido no servidor em get_public_stores,
 *    mesma regra de compute_store_delivery_fee) tem prioridade sobre o
 *    platform_delivery_split_override, que por sua vez sobrescreve o
 *    admin_settings. O payload publico nao traz o override — sem o campo
 *    resolvido o front caia sempre no padrao 0,99 (Fase 4: Aguia exibia
 *    R$ 4,99 e cobrava R$ 4,00; Duda exibia R$ 0,99 e a entrega e gratis).
 *  - prefixo "A partir de" SO para loja por km: taxa fixa mostra o valor
 *    exato (Fase 4, P2-9). Antes, todo total > 0 ganhava o prefixo.
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
  // Split ja resolvido no servidor (get_public_stores) — mesma regra da RPC
  // compute_store_delivery_fee. Quando presente, vale mais que o override.
  platform_split_effective?: number | string | null;
  autonomy_lifetime_free?: boolean | null;
  delivery_fee_type?: string | null;
  delivery_fee_base?: number | string | null;
}

function toSplitNumber(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function describeStoreFee(store: StoreLike, adminSplit = DEFAULT_ADMIN_SPLIT): FeeDisplay {
  const mode = store?.delivery_mode || "platform";

  if (mode === "pickup") {
    return { label: "Retirada", free: false, customerTotal: 0, baseFee: 0, platformAddCustomer: 0 };
  }

  const isAutonomy =
    store?.plan_type === "autonomy" || store?.autonomy_lifetime_free === true;

  // Ordem de prioridade (Fase 4): split resolvido no servidor > override do
  // plano > padrao do admin. O payload publico nao traz o override, entao
  // sem o campo resolvido todo mundo caia no padrao 0,99.
  const effectiveNum = toSplitNumber(store?.platform_split_effective);
  const overrideNum = toSplitNumber(store?.platform_delivery_split_override);
  const baseSplit = effectiveNum ?? overrideNum ?? adminSplit;
  const splitFull = isAutonomy ? 0 : baseSplit;

  // "A partir de" so para loja por km: a taxa fixa e o valor exato.
  const prefix = store?.delivery_fee_type === "km" ? "A partir de" : undefined;

  if (mode === "platform") {
    const base = Number(store?.delivery_fee ?? 0);
    const total = base;
    return {
      label: total <= 0 ? "Grátis" : formatBRL(total),
      // Taxa da plataforma e valor exato — nunca "A partir de".
      prefix: undefined,
      free: total <= 0,
      customerTotal: total,
      baseFee: base,
      platformAddCustomer: 0,
    };
  }

  // own delivery
  // Loja por km: o piso exibido é delivery_fee_base + split (não own_delivery_fee).
  // O valor final por distância continua vindo da cotação do servidor (quote-delivery).
  const base =
    store?.delivery_fee_type === "km"
      ? Number(store?.delivery_fee_base ?? 0)
      : Number(store?.own_delivery_fee ?? 0);
  const splitMode = (store?.platform_fee_split || "cliente") as string;
  let addCustomer = 0;
  if (splitMode === "cliente") addCustomer = splitFull;
  else if (splitMode === "meio_a_meio") addCustomer = Math.round((splitFull / 2) * 100) / 100;
  // lojista → 0

  const total = base + addCustomer;
  return {
    label: total <= 0 ? "Grátis" : formatBRL(total),
    prefix: total <= 0 ? undefined : prefix,
    free: total <= 0,
    customerTotal: total,
    baseFee: base,
    platformAddCustomer: addCustomer,
  };
}
