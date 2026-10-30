// Fase 3 — pedido transacional: testes do montador do payload da RPC
// `create_order_with_items`. A RPC em si (SQL) não roda no Vitest —
// ela é validada por revisão + teste ao vivo pós-publicação (ver PR).
import { describe, it, expect } from "vitest";
import {
  buildCreateOrderPayload,
  isCreateOrderResult,
  type BuildCreateOrderInput,
} from "./createOrder";

function baseInput(overrides: Partial<BuildCreateOrderInput> = {}): BuildCreateOrderInput {
  return {
    clientId: "11111111-1111-1111-1111-111111111111",
    storeId: "22222222-2222-2222-2222-222222222222",
    idempotencyKey: "33333333-3333-3333-3333-333333333333",
    items: [
      {
        id: "44444444-4444-4444-4444-444444444444",
        quantity: 2,
        price: 29.9,
        addons: [{ name: "Borda Catupiry", price: 10, groupName: "Borda" }],
        observations: "Sem cebola",
      },
      { id: "55555555-5555-5555-5555-555555555555", quantity: 1, price: 8 },
    ],
    deliveryFee: 5,
    deliveryFeeAbsorbed: 0,
    paymentMethod: "pix_direto",
    neighborhood: "Centro",
    addressDetails: "Rua A, 123",
    deliveryCep: "28979000",
    deliveryCity: "Araruama",
    deliveryState: "RJ",
    clientLat: -22.87,
    clientLng: -42.33,
    needsChange: false,
    changeFor: null,
    isPickup: false,
    isPreorder: false,
    scheduledFor: null,
    couponId: null,
    couponDiscount: 0,
    loyaltyPoints: 0,
    loyaltyDiscount: 0,
    walletDiscount: 0,
    emptiesDiscount: 0,
    empties: [],
    deliveryQuote: { policy_version: 1 },
    ...overrides,
  };
}

describe("buildCreateOrderPayload", () => {
  it("mapeia os itens do carrinho para o formato da RPC", () => {
    const payload = buildCreateOrderPayload(baseInput());
    expect(payload.p_items).toEqual([
      {
        product_id: "44444444-4444-4444-4444-444444444444",
        quantity: 2,
        unit_price: 29.9,
        addons: [{ name: "Borda Catupiry", price: 10, groupName: "Borda" }],
        observations: "Sem cebola",
      },
      {
        product_id: "55555555-5555-5555-5555-555555555555",
        quantity: 1,
        unit_price: 8,
        addons: null,
        observations: null,
      },
    ]);
  });

  it("repete a mesma idempotency_key (o retry do mesmo submit usa a mesma)", () => {
    const input = baseInput();
    const a = buildCreateOrderPayload(input);
    const b = buildCreateOrderPayload(input);
    expect(a.p_idempotency_key).toBe("33333333-3333-3333-3333-333333333333");
    expect(b.p_idempotency_key).toBe(a.p_idempotency_key);
  });

  it("leva cliente, loja, taxa, pagamento e endereço", () => {
    const payload = buildCreateOrderPayload(baseInput());
    expect(payload.p_client_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(payload.p_store_id).toBe("22222222-2222-2222-2222-222222222222");
    expect(payload.p_delivery_fee).toBe(5);
    expect(payload.p_delivery_fee_absorbed).toBe(0);
    expect(payload.p_payment_method).toBe("pix_direto");
    expect(payload.p_neighborhood).toBe("Centro");
    expect(payload.p_address_details).toBe("Rua A, 123");
    expect(payload.p_delivery_cep).toBe("28979000");
    expect(payload.p_delivery_city).toBe("Araruama");
    expect(payload.p_delivery_state).toBe("RJ");
    expect(payload.p_client_lat).toBe(-22.87);
    expect(payload.p_client_lng).toBe(-42.33);
    expect(payload.p_delivery_quote).toEqual({ policy_version: 1 });
  });

  it("leva os descontos (cupom, fidelidade, carteira, vasilhames) para a RPC", () => {
    const payload = buildCreateOrderPayload(
      baseInput({
        couponId: "66666666-6666-6666-6666-666666666666",
        couponDiscount: 10,
        loyaltyPoints: 100,
        loyaltyDiscount: 5,
        walletDiscount: 7.5,
        emptiesDiscount: 4,
        empties: [{ group: "garrafa", qty: 2, unit_price: 2 }],
      }),
    );
    expect(payload.p_coupon_id).toBe("66666666-6666-6666-6666-666666666666");
    expect(payload.p_coupon_discount).toBe(10);
    expect(payload.p_loyalty_points).toBe(100);
    expect(payload.p_loyalty_discount).toBe(5);
    expect(payload.p_wallet_discount).toBe(7.5);
    expect(payload.p_empties_discount).toBe(4);
    expect(payload.p_empties).toEqual([{ group: "garrafa", qty: 2, unit_price: 2 }]);
  });

  it("marca retirada e pré-pedido quando for o caso", () => {
    const payload = buildCreateOrderPayload(
      baseInput({
        isPickup: true,
        deliveryFee: 0,
        neighborhood: "RETIRADA",
        addressDetails: "Retirada na loja",
        isPreorder: true,
        scheduledFor: "2026-10-26T18:00:00.000Z",
      }),
    );
    expect(payload.p_is_pickup).toBe(true);
    expect(payload.p_delivery_fee).toBe(0);
    expect(payload.p_neighborhood).toBe("RETIRADA");
    expect(payload.p_is_preorder).toBe(true);
    expect(payload.p_scheduled_for).toBe("2026-10-26T18:00:00.000Z");
  });

  it("sempre cria pedido logado de delivery por padrão (guest é só na edge)", () => {
    const payload = buildCreateOrderPayload(baseInput());
    expect(payload.p_is_guest).toBe(false);
    expect(payload.p_delivery_pin).toBeNull();
    expect(payload.p_order_source).toBe("delivery");
  });

  it("troco só vai quando o pagamento é dinheiro com troco", () => {
    const withChange = buildCreateOrderPayload(
      baseInput({ paymentMethod: "dinheiro", needsChange: true, changeFor: 100 }),
    );
    expect(withChange.p_needs_change).toBe(true);
    expect(withChange.p_change_for).toBe(100);

    const withoutChange = buildCreateOrderPayload(baseInput());
    expect(withoutChange.p_needs_change).toBe(false);
    expect(withoutChange.p_change_for).toBeNull();
  });
});

describe("isCreateOrderResult", () => {
  it("aceita o retorno válido da RPC", () => {
    expect(
      isCreateOrderResult({
        order_id: "77777777-7777-7777-7777-777777777777",
        order_number: 12,
        status: "pendente",
        subtotal: 67.8,
        delivery_fee: 5,
        total_price: 72.8,
        wallet_discount: 0,
        delivery_pin: "1234",
        is_new: true,
      }),
    ).toBe(true);
  });

  it("rejeita retorno sem order_id, nulo ou de outro formato", () => {
    expect(isCreateOrderResult(null)).toBe(false);
    expect(isCreateOrderResult(undefined)).toBe(false);
    expect(isCreateOrderResult({})).toBe(false);
    expect(isCreateOrderResult({ order_id: "" })).toBe(false);
    expect(isCreateOrderResult({ error: "algo deu errado" })).toBe(false);
  });
});
