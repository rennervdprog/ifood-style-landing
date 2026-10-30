import { describe, it, expect } from "vitest";
import {
  PROFILE_LINK_FIELDS,
  NETWORK_ADMIN_FIELDS,
  EXTRA_UNIT_MONTHLY_FEE,
  FREE_UNITS_INCLUDED,
  NETWORK_FREE_GMV_THRESHOLD,
  MAX_UNITS_PER_NETWORK,
  NETWORK_INVITE_VALIDITY_DAYS,
  canChangeProfileLinkFields,
  canUpdateProfile,
  canChangeNetworkAdminFields,
  canUpdateNetwork,
  canManageNetworkUnits,
  countBillableUnitsForLimit,
  canCreateUnit,
  calcNetworkMonthlyFee,
  canAcceptInvite,
  isInviteExpired,
} from "../networkLinkRules";

describe("canChangeProfileLinkFields (C1 — trava do perfil)", () => {
  it("usuário comum NÃO pode mudar campo de vínculo do próprio perfil", () => {
    expect(canChangeProfileLinkFields("common")).toBe(false);
  });

  it("dono da rede NÃO pode mudar vínculo direto (só via função link_unit_user)", () => {
    expect(canChangeProfileLinkFields("network_owner")).toBe(false);
  });

  it("admin da plataforma pode", () => {
    expect(canChangeProfileLinkFields("platform_admin")).toBe(true);
  });
});

describe("canUpdateProfile", () => {
  it("cadastro normal não quebra: nome, telefone, avatar continuam editáveis", () => {
    expect(canUpdateProfile("common", ["full_name", "phone", "avatar_url"])).toBe(true);
    expect(canUpdateProfile("common", ["street", "pix_key", "whatsapp_number"])).toBe(true);
    expect(canUpdateProfile("common", [])).toBe(true);
  });

  it("bloqueia cada um dos 3 campos de vínculo para o usuário comum", () => {
    for (const field of PROFILE_LINK_FIELDS) {
      expect(canUpdateProfile("common", [field])).toBe(false);
      expect(canUpdateProfile("common", ["full_name", field])).toBe(false);
    }
  });

  it("admin pode mudar os campos de vínculo", () => {
    expect(canUpdateProfile("platform_admin", [...PROFILE_LINK_FIELDS])).toBe(true);
  });
});

describe("canChangeNetworkAdminFields (C2 — trava da rede)", () => {
  it("dono NÃO pode se auto-aprovar nem mudar o próprio limite", () => {
    expect(canChangeNetworkAdminFields("network_owner")).toBe(false);
    expect(canUpdateNetwork("network_owner", ["is_approved"])).toBe(false);
    expect(canUpdateNetwork("network_owner", ["max_units"])).toBe(false);
    expect(canUpdateNetwork("network_owner", ["monthly_fee"])).toBe(false);
    expect(canUpdateNetwork("network_owner", ["plan_type"])).toBe(false);
    expect(canUpdateNetwork("network_owner", ["owner_id"])).toBe(false);
    expect(canUpdateNetwork("network_owner", ["matriz_store_id"])).toBe(false);
  });

  it("dono pode editar nome e logo", () => {
    expect(canUpdateNetwork("network_owner", ["name", "logo_url"])).toBe(true);
  });

  it("admin pode mudar qualquer campo da rede", () => {
    expect(canUpdateNetwork("platform_admin", [...NETWORK_ADMIN_FIELDS])).toBe(true);
  });
});

describe("canManageNetworkUnits", () => {
  it("só dono da rede e admin criam subloja / vinculam gerente", () => {
    expect(canManageNetworkUnits("network_owner")).toBe(true);
    expect(canManageNetworkUnits("platform_admin")).toBe(true);
    expect(canManageNetworkUnits("common")).toBe(false);
  });
});

describe("limite de sublojas (M1 / decisão 4)", () => {
  it("a matriz não conta no limite — só as sublojas", () => {
    expect(
      countBillableUnitsForLimit([
        { is_matriz: true },
        { is_matriz: false },
        { is_matriz: false },
        {},
      ]),
    ).toBe(3);
  });

  it("10 sublojas é o teto: a 11ª não cabe", () => {
    expect(canCreateUnit(9)).toBe(true);
    expect(canCreateUnit(10)).toBe(false);
    expect(canCreateUnit(10, MAX_UNITS_PER_NETWORK)).toBe(false);
    expect(MAX_UNITS_PER_NETWORK).toBe(10);
  });
});

describe("calcNetworkMonthlyFee (decisões 1, 2 e 6)", () => {
  it("até 3 sublojas: só a mensalidade base", () => {
    expect(calcNetworkMonthlyFee({ baseMonthlyFee: 89.9, deliveryUnitCount: 3, gmv60d: 6000 })).toBeCloseTo(89.9, 2);
    expect(calcNetworkMonthlyFee({ baseMonthlyFee: 89.9, deliveryUnitCount: 1, gmv60d: 6000 })).toBeCloseTo(89.9, 2);
  });

  it("a partir da 4ª: R$ 39,90 por subloja adicional", () => {
    expect(EXTRA_UNIT_MONTHLY_FEE).toBe(39.9);
    expect(FREE_UNITS_INCLUDED).toBe(3);
    // Exemplo do plano: Cantinho do Tempero, 5 sublojas → 89,90 + 2×39,90
    expect(calcNetworkMonthlyFee({ baseMonthlyFee: 89.9, deliveryUnitCount: 5, gmv60d: 6000 })).toBeCloseTo(169.7, 2);
    expect(calcNetworkMonthlyFee({ baseMonthlyFee: 89.9, deliveryUnitCount: 4, gmv60d: 6000 })).toBeCloseTo(129.8, 2);
  });

  it("gratuidade por rede: GMV 60d <= R$ 5.000 → não paga nada", () => {
    expect(NETWORK_FREE_GMV_THRESHOLD).toBe(5000);
    expect(calcNetworkMonthlyFee({ baseMonthlyFee: 89.9, deliveryUnitCount: 5, gmv60d: 5000 })).toBe(0);
    expect(calcNetworkMonthlyFee({ baseMonthlyFee: 89.9, deliveryUnitCount: 5, gmv60d: 4999.99 })).toBe(0);
    expect(calcNetworkMonthlyFee({ baseMonthlyFee: 89.9, deliveryUnitCount: 5, gmv60d: 5000.01 })).toBeCloseTo(169.7, 2);
  });
});

describe("convite de gerente (plano 4.3)", () => {
  it("vale 7 dias e só aceita quando pendente e dentro da validade", () => {
    expect(NETWORK_INVITE_VALIDITY_DAYS).toBe(7);
    const now = new Date("2026-10-28T12:00:00-03:00");
    expect(canAcceptInvite("pending", "2026-11-04T12:00:00-03:00", now)).toBe(true);
    expect(canAcceptInvite("pending", "2026-10-28T12:00:00-03:00", now)).toBe(false);
    expect(canAcceptInvite("accepted", "2026-11-04T12:00:00-03:00", now)).toBe(false);
    expect(canAcceptInvite("declined", "2026-11-04T12:00:00-03:00", now)).toBe(false);
    expect(canAcceptInvite("expired", "2026-11-04T12:00:00-03:00", now)).toBe(false);
  });

  it("detecta convite vencido ainda pendente", () => {
    const now = new Date("2026-10-28T12:00:00-03:00");
    expect(isInviteExpired("pending", "2026-10-27T12:00:00-03:00", now)).toBe(true);
    expect(isInviteExpired("pending", "2026-11-04T12:00:00-03:00", now)).toBe(false);
    expect(isInviteExpired("accepted", "2026-10-27T12:00:00-03:00", now)).toBe(false);
  });
});
