// Fase 3 — pedido transacional: montador do payload da RPC
// `create_order_with_items`.
//
// Função pura (testável): recebe os dados do checkout e devolve os
// parâmetros da RPC, sem tocar no Supabase. O CheckoutPage usa este
// montador e chama a RPC; a RPC cria pedido + itens + descontos numa
// transação só, com idempotência pela `idempotency_key`.
//
// A chave de idempotência é gerada UMA vez por montagem da página de
// checkout (useRef) e reutilizada no retry do mesmo submit — é ela que
// faz o segundo submit devolver o pedido já criado, sem duplicar.

export interface CreateOrderCartItem {
  id: string;
  quantity: number;
  price: number;
  addons?: Array<{
    name: string;
    price: number;
    required?: boolean;
    groupName?: string;
    id?: string;
    groupId?: string;
  }> | null;
  observations?: string | null;
}

export interface CreateOrderItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  addons: unknown;
  observations: string | null;
}

export interface CreateOrderPayload {
  p_client_id: string;
  p_store_id: string;
  p_idempotency_key: string;
  p_items: CreateOrderItemInput[];
  p_delivery_fee: number;
  p_delivery_fee_absorbed: number;
  p_payment_method: string;
  p_neighborhood: string | null;
  p_address_details: string | null;
  p_delivery_cep: string | null;
  p_delivery_city: string | null;
  p_delivery_state: string | null;
  p_client_lat: number | null;
  p_client_lng: number | null;
  p_needs_change: boolean;
  p_change_for: number | null;
  p_is_pickup: boolean;
  p_is_preorder: boolean;
  p_scheduled_for: string | null;
  p_coupon_id: string | null;
  p_coupon_discount: number;
  p_loyalty_points: number;
  p_loyalty_discount: number;
  p_wallet_discount: number;
  p_empties_discount: number;
  p_empties: unknown;
  p_delivery_quote: Record<string, unknown> | null;
  p_is_guest: boolean;
  p_delivery_pin: string | null;
  p_order_source: string;
}

export interface BuildCreateOrderInput {
  clientId: string;
  storeId: string;
  idempotencyKey: string;
  items: CreateOrderCartItem[];
  deliveryFee: number;
  deliveryFeeAbsorbed: number;
  paymentMethod: string;
  neighborhood: string | null;
  addressDetails: string | null;
  deliveryCep: string | null;
  deliveryCity: string | null;
  deliveryState: string | null;
  clientLat: number | null;
  clientLng: number | null;
  needsChange: boolean;
  changeFor: number | null;
  isPickup: boolean;
  isPreorder: boolean;
  scheduledFor: string | null;
  couponId: string | null;
  couponDiscount: number;
  loyaltyPoints: number;
  loyaltyDiscount: number;
  walletDiscount: number;
  emptiesDiscount: number;
  empties: unknown;
  deliveryQuote: Record<string, unknown> | null;
}

export function buildCreateOrderPayload(input: BuildCreateOrderInput): CreateOrderPayload {
  return {
    p_client_id: input.clientId,
    p_store_id: input.storeId,
    p_idempotency_key: input.idempotencyKey,
    p_items: input.items.map((item) => ({
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      addons: item.addons && item.addons.length > 0 ? item.addons : null,
      observations: item.observations || null,
    })),
    p_delivery_fee: input.deliveryFee,
    p_delivery_fee_absorbed: input.deliveryFeeAbsorbed,
    p_payment_method: input.paymentMethod,
    p_neighborhood: input.neighborhood,
    p_address_details: input.addressDetails,
    p_delivery_cep: input.deliveryCep,
    p_delivery_city: input.deliveryCity,
    p_delivery_state: input.deliveryState,
    p_client_lat: input.clientLat,
    p_client_lng: input.clientLng,
    p_needs_change: input.needsChange,
    p_change_for: input.changeFor,
    p_is_pickup: input.isPickup,
    p_is_preorder: input.isPreorder,
    p_scheduled_for: input.scheduledFor,
    p_coupon_id: input.couponId,
    p_coupon_discount: input.couponDiscount,
    p_loyalty_points: input.loyaltyPoints,
    p_loyalty_discount: input.loyaltyDiscount,
    p_wallet_discount: input.walletDiscount,
    p_empties_discount: input.emptiesDiscount,
    p_empties: input.empties ?? [],
    p_delivery_quote: input.deliveryQuote,
    p_is_guest: false,
    p_delivery_pin: null,
    p_order_source: "delivery",
  };
}

export interface CreateOrderResult {
  order_id: string;
  order_number: number | null;
  status: string;
  subtotal: number;
  delivery_fee: number;
  total_price: number;
  wallet_discount: number;
  delivery_pin: string | null;
  is_new: boolean;
}

export function isCreateOrderResult(value: unknown): value is CreateOrderResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.order_id === "string" && v.order_id.length > 0;
}
