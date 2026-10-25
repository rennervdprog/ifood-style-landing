import { describe, it, expect } from "vitest";
import { describeStoreFee } from "@/lib/deliveryFeeDisplay";

// Fase 4 — taxa exibida igual a cobrada (P1-N1) + "A partir de" so para km (P2-9).
// Casos reais da auditoria 2026-10-25: Aguia (override 0), Duda (override 0,
// entrega gratis), Pastelao (km), Gelobol/Ric (override 0,99).
describe("describeStoreFee — Fase 4", () => {
  it("Aguia: split resolvido 0 → exibe R$ 4,00 sem 'A partir de'", () => {
    const d = describeStoreFee({
      delivery_mode: "own",
      delivery_fee_type: "fixed",
      own_delivery_fee: 4,
      platform_fee_split: "cliente",
      platform_split_effective: 0,
    });
    expect(d.customerTotal).toBe(4);
    expect(d.platformAddCustomer).toBe(0);
    expect(d.label).toContain("4,00");
    expect(d.prefix).toBeUndefined();
    expect(d.free).toBe(false);
  });

  it("Duda: taxa 0 + split 0 → Grátis", () => {
    const d = describeStoreFee({
      delivery_mode: "own",
      delivery_fee_type: "fixed",
      own_delivery_fee: 0,
      platform_fee_split: "cliente",
      platform_split_effective: 0,
    });
    expect(d.customerTotal).toBe(0);
    expect(d.label).toBe("Grátis");
    expect(d.free).toBe(true);
    expect(d.prefix).toBeUndefined();
  });

  it("Pastelao (km): piso base + split, com 'A partir de'", () => {
    const d = describeStoreFee({
      delivery_mode: "own",
      delivery_fee_type: "km",
      delivery_fee_base: 6,
      platform_fee_split: "cliente",
      platform_split_effective: 0.99,
    });
    expect(d.customerTotal).toBeCloseTo(6.99, 2);
    expect(d.platformAddCustomer).toBe(0.99);
    expect(d.prefix).toBe("A partir de");
    expect(d.label).toContain("6,99");
  });

  it("taxa fixa com split 0,99 → valor exato, sem 'A partir de'", () => {
    const d = describeStoreFee({
      delivery_mode: "own",
      delivery_fee_type: "fixed",
      own_delivery_fee: 2.33,
      platform_fee_split: "cliente",
      platform_split_effective: 0.99,
    });
    expect(d.customerTotal).toBeCloseTo(3.32, 2);
    expect(d.prefix).toBeUndefined();
  });

  it("modo platform: delivery_fee e exato, sem prefixo", () => {
    const d = describeStoreFee({
      delivery_mode: "platform",
      delivery_fee: 5,
      platform_split_effective: 0.99,
    });
    expect(d.customerTotal).toBe(5);
    expect(d.label).toContain("5,00");
    expect(d.prefix).toBeUndefined();
  });

  it("prioridade: effective vence o override", () => {
    const d = describeStoreFee({
      delivery_mode: "own",
      delivery_fee_type: "fixed",
      own_delivery_fee: 2,
      platform_fee_split: "cliente",
      platform_delivery_split_override: 0,
      platform_split_effective: 0.5,
    });
    expect(d.platformAddCustomer).toBe(0.5);
    expect(d.customerTotal).toBe(2.5);
  });

  it("fallback: sem effective usa o override; sem override usa 0,99", () => {
    const comOverride = describeStoreFee({
      delivery_mode: "own",
      delivery_fee_type: "fixed",
      own_delivery_fee: 2,
      platform_fee_split: "cliente",
      platform_delivery_split_override: 0,
    });
    expect(comOverride.platformAddCustomer).toBe(0);

    const semNada = describeStoreFee({
      delivery_mode: "own",
      delivery_fee_type: "fixed",
      own_delivery_fee: 2,
      platform_fee_split: "cliente",
    });
    expect(semNada.platformAddCustomer).toBe(0.99);
  });

  it("meio_a_meio: soma metade do split (0,99 → 0,50)", () => {
    const d = describeStoreFee({
      delivery_mode: "own",
      delivery_fee_type: "fixed",
      own_delivery_fee: 3,
      platform_fee_split: "meio_a_meio",
      platform_split_effective: 0.99,
    });
    expect(d.platformAddCustomer).toBe(0.5);
    expect(d.customerTotal).toBe(3.5);
  });

  it("lojista arca com o split: cliente nao paga nada extra", () => {
    const d = describeStoreFee({
      delivery_mode: "own",
      delivery_fee_type: "fixed",
      own_delivery_fee: 4,
      platform_fee_split: "lojista",
      platform_split_effective: 0.99,
    });
    expect(d.platformAddCustomer).toBe(0);
    expect(d.customerTotal).toBe(4);
    expect(d.prefix).toBeUndefined();
  });

  it("autonomia zera o split mesmo sem o campo resolvido", () => {
    const d = describeStoreFee({
      delivery_mode: "own",
      delivery_fee_type: "fixed",
      own_delivery_fee: 2,
      platform_fee_split: "cliente",
      plan_type: "autonomy",
    });
    expect(d.platformAddCustomer).toBe(0);
    expect(d.customerTotal).toBe(2);
  });

  it("retirada nao tem taxa", () => {
    const d = describeStoreFee({ delivery_mode: "pickup" });
    expect(d.label).toBe("Retirada");
    expect(d.customerTotal).toBe(0);
  });

  it("aceita o split como string ('0' vindo do payload)", () => {
    const d = describeStoreFee({
      delivery_mode: "own",
      delivery_fee_type: "fixed",
      own_delivery_fee: 4,
      platform_fee_split: "cliente",
      platform_split_effective: "0",
    });
    expect(d.platformAddCustomer).toBe(0);
    expect(d.customerTotal).toBe(4);
  });
});
