export type DeliveryAddressInput = {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city?: string;
  state?: string;
  cep: string;
};

export type DeliveryQuote = {
  ok: true;
  fulfillment: "delivery" | "pickup";
  destination: {
    normalized_address: string;
    cep: string;
    city: string;
    state: string;
    neighborhood: string;
    lat: number;
    lng: number;
    precision: "address" | "street" | "cep";
  } | null;
  distance: { km: number; source: string; max_km: number | null; eligible: boolean };
  pricing: {
    store_delivery_base: number;
    platform_fee_customer: number;
    platform_fee_store_absorbed: number;
    delivery_fee: number;
    vip_override_applied: number | null;
    split_mode: string | null;
    plan_type: string | null;
    free_delivery_applied?: boolean;
  };
  policy_version: number;
};

export type DeliveryQuoteFailure = {
  ok: false;
  reason?: string;
  message?: string;
  distance?: Partial<DeliveryQuote["distance"]>;
};

export type DeliveryQuoteResponse = DeliveryQuote | DeliveryQuoteFailure;

export function normalizeCep(value: string | null | undefined): string {
  return String(value || "").replace(/\D/g, "");
}

export function asDeliveryAddress(input: Partial<DeliveryAddressInput>): DeliveryAddressInput | null {
  const address: DeliveryAddressInput = {
    street: String(input.street || "").trim(),
    number: String(input.number || "").trim(),
    complement: String(input.complement || "").trim() || undefined,
    neighborhood: String(input.neighborhood || "").trim(),
    city: String(input.city || "").trim(),
    state: String(input.state || "").trim().toUpperCase(),
    cep: normalizeCep(input.cep),
  };
  return address.street && address.number && address.neighborhood && address.cep.length === 8 ? address : null;
}

export function isSuccessfulDeliveryQuote(value: DeliveryQuoteResponse | null): value is DeliveryQuote {
  return !!value
    && value.ok === true
    && value.fulfillment === "delivery"
    && !!value.destination
    && Number.isFinite(Number(value.destination.lat))
    && Number.isFinite(Number(value.destination.lng))
    && Number.isFinite(Number(value.pricing.delivery_fee));
}

export function deliveryQuoteFailureMessage(value: DeliveryQuoteFailure | null | undefined): string {
  const reason = value?.reason || "";
  if (reason === "delivery_unavailable") return "Esta loja não está aceitando pedidos de entrega no momento.";
  if (reason === "no_driver_available") return value?.message || "Esta loja está sem entregador disponível no momento. Você ainda pode escolher retirada.";
  if (reason === "delivery_availability_unavailable") return "Não foi possível confirmar a disponibilidade de entrega agora. Tente novamente em instantes.";
  if (reason === "outside_delivery_area") {
    const km = Number(value?.distance?.km);
    const maxKm = Number(value?.distance?.max_km);
    return Number.isFinite(km) && Number.isFinite(maxKm)
      ? `O endereço de entrega está a ${km.toFixed(1)} km da loja. Limite de ${maxKm} km.`
      : "O endereço informado está fora da área de entrega da loja.";
  }
  if (reason === "address_unavailable") return "Não localizamos esse endereço. Revise rua, número, bairro, cidade/UF e CEP.";
  if (reason === "unauthorized") return "Sua sessão expirou. Entre novamente para confirmar o endereço.";
  if (reason === "invalid_cep") return "Informe um CEP válido com 8 dígitos para calcular a entrega.";
  return "Não foi possível calcular a entrega agora. Seu carrinho foi preservado — tente novamente em instantes.";
}

export function deliveryQuoteBreakdown(quote: DeliveryQuote | null): string | null {
  if (!quote || quote.fulfillment !== "delivery") return null;
  if (quote.pricing.free_delivery_applied) return "Frete grátis aplicado pela regra da loja";
  const base = Number(quote.pricing.store_delivery_base || 0);
  const platform = Number(quote.pricing.platform_fee_customer || 0);
  if (platform > 0) return `Entrega: R$ ${base.toFixed(2).replace(".", ",")} + Taxa operacional: R$ ${platform.toFixed(2).replace(".", ",")}`;
  return `Entrega: R$ ${base.toFixed(2).replace(".", ",")}`;
}

export function serializeDeliveryQuote(quote: DeliveryQuote) {
  return {
    policy_version: quote.policy_version || 1,
    distance_km: Number(quote.distance.km || 0),
    distance_source: quote.distance.source || "haversine",
    max_delivery_km: quote.distance.max_km ?? null,
    destination_precision: quote.destination?.precision || "cep",
    store_delivery_base: Number(quote.pricing.store_delivery_base || 0),
    platform_fee_customer: Number(quote.pricing.platform_fee_customer || 0),
    platform_fee_store_absorbed: Number(quote.pricing.platform_fee_store_absorbed || 0),
    delivery_fee: Number(quote.pricing.delivery_fee || 0),
    vip_override_applied: quote.pricing.vip_override_applied ?? null,
    split_mode: quote.pricing.split_mode ?? null,
    plan_type: quote.pricing.plan_type ?? null,
    free_delivery_applied: Boolean(quote.pricing.free_delivery_applied),
  };
}

export function snapshotFromDeliveryQuote(quote: DeliveryQuote) {
  return {
    address_details: quote.destination?.normalized_address || "",
    neighborhood: quote.destination?.neighborhood || "",
    delivery_cep: quote.destination?.cep || "",
    delivery_city: quote.destination?.city || "",
    delivery_state: quote.destination?.state || "",
    client_lat: Number(quote.destination?.lat),
    client_lng: Number(quote.destination?.lng),
  };
}

export async function requestAuthenticatedDeliveryQuote(input: {
  accessToken: string;
  storeId: string;
  subtotal: number;
  address: DeliveryAddressInput;
}): Promise<DeliveryQuoteResponse> {
  const response = await fetch("/api/quote-delivery", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.accessToken}` },
    body: JSON.stringify({ store_id: input.storeId, fulfillment: "delivery", subtotal: input.subtotal, address: input.address }),
  });
  const body = await response.json().catch(() => ({ ok: false, reason: "quote_unreachable" }));
  return response.ok ? body as DeliveryQuoteResponse : { ...(body || {}), ok: false } as DeliveryQuoteFailure;
}

export function hasUsableCoordinates(lat: unknown, lng: unknown): boolean {
  return lat !== null && lat !== undefined && lng !== null && lng !== undefined
    && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

export function quoteErrorFromUnknown(error: unknown): DeliveryQuoteFailure {
  return { ok: false, reason: error instanceof Error && error.message === "missing_authenticated_session" ? "unauthorized" : "quote_unreachable" };
}

export function quoteRequestKey(storeId: string | undefined, subtotal: number, address: DeliveryAddressInput | null): string {
  return JSON.stringify({ storeId: storeId || "", subtotal: Number(subtotal || 0), address });
}
