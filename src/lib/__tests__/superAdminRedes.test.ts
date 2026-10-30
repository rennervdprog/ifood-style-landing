/**
 * Testes da tela "Redes" do super-admin — Fase 2 (só leitura).
 *
 * Regras puras de src/lib/superAdminRedes.ts: agrupar redes com sublojas
 * e gerentes, e resumir os totais do cabeçalho.
 */
import { describe, it, expect } from "vitest";
import {
  groupNetworksWithUnits,
  summarizeNetworks,
  networkPlanLabel,
  resolveNetworkDisplayStatus,
  NETWORK_STATUS_LABELS,
} from "../superAdminRedes";

const networks = [
  {
    id: "n1",
    name: "Cantinho do Tempero",
    owner_id: "o1",
    plan_type: "fixed",
    monthly_fee: 89.9,
    max_units: 10,
    is_approved: true,
    is_paused: false,
    matriz_store_id: "m1",
  },
  {
    id: "n2",
    name: "Graal",
    owner_id: "o2",
    plan_type: "commission_only",
    monthly_fee: 0,
    max_units: 10,
    is_approved: true,
    is_paused: true,
    matriz_store_id: "m2",
  },
];

const stores = [
  { id: "m1", name: "Cantinho Matriz", network_id: "n1", is_matriz: true, is_draft: false, status: "ativo" },
  { id: "u1", name: "Bittenca's", network_id: "n1", is_matriz: false, is_draft: false, status: "ativo", address_city: "Araruama" },
  { id: "u2", name: "Filial Rascunho", network_id: "n1", is_matriz: false, is_draft: true, status: "analise", address_city: "Araruama" },
  { id: "m2", name: "Maristela", network_id: "n2", is_matriz: true, is_draft: false, status: "ativo" },
];

const managers = [{ store_id: "u1", user_id: "g1", is_active: true }];

const profiles = [
  { user_id: "o1", email: "elizete@teste.com", full_name: "Elizete" },
  { user_id: "o2", email: "maristela@teste.com", full_name: "Maristela" },
  { user_id: "g1", email: "gerente@teste.com", full_name: "Gerente" },
];

describe("groupNetworksWithUnits", () => {
  const groups = groupNetworksWithUnits({ networks, stores, managers, profiles });

  it("agrupa matriz-guia, sublojas e rascunhos por rede", () => {
    expect(groups).toHaveLength(2);
    const g1 = groups[0];
    expect(g1.matrizStore?.id).toBe("m1");
    expect(g1.sublojas.map((s) => s.id)).toEqual(["u1", "u2"]);
    expect(g1.drafts.map((s) => s.id)).toEqual(["u2"]);
    expect(g1.ownerEmail).toBe("elizete@teste.com");
    expect(groups[1].sublojas).toEqual([]);
  });

  it("resolve o gerente de cada subloja pelo e-mail", () => {
    const g1 = groups[0];
    expect(g1.managersByStore["u1"]).toBe("gerente@teste.com");
    expect(g1.managersByStore["u2"]).toBeNull();
  });

  it("resume os totais do cabeçalho", () => {
    expect(summarizeNetworks(groups)).toEqual({
      networks: 2,
      sublojas: 2,
      drafts: 1,
      withManager: 1,
      paused: 1,
    });
  });
});

describe("rótulos da tela Redes", () => {
  it("status da rede: suspensa manda, depois pausada", () => {
    expect(resolveNetworkDisplayStatus({ ...networks[0], is_approved: false })).toBe("suspended");
    expect(resolveNetworkDisplayStatus(networks[1])).toBe("paused");
    expect(resolveNetworkDisplayStatus(networks[0])).toBe("active");
    expect(NETWORK_STATUS_LABELS).toEqual({
      suspended: "SUSPENSA",
      paused: "PAUSADA",
      active: "ATIVA",
    });
  });

  it("rótulo do plano", () => {
    expect(networkPlanLabel("fixed")).toBe("Essencial");
    expect(networkPlanLabel("commission_only")).toBe("Comissão");
    expect(networkPlanLabel("pdv_only")).toBe("Somente PDV");
    expect(networkPlanLabel("hybrid")).toBe("Crescimento");
    expect(networkPlanLabel("supporter")).toBe("Apoiadores");
    expect(networkPlanLabel("xpto")).toBe("xpto");
  });
});
