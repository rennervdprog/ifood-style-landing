/**
 * Tela "Redes" do super-admin — SÓ LEITURA (Fase 2, plano 28/10/2026).
 *
 * Helpers puros para agrupar redes (matriz) com suas sublojas e resumir o
 * que o admin vê. Nenhuma ação aqui — sem botões de aprovar, suspender,
 * ajustar limite ou criar rede nesta fase.
 */

export interface NetworkRow {
  id: string;
  name: string;
  logo_url?: string | null;
  owner_id: string;
  plan_type: string;
  monthly_fee: number | string | null;
  max_units: number | string | null;
  is_approved?: boolean | null;
  is_paused?: boolean | null;
  matriz_store_id?: string | null;
  created_at?: string | null;
}

export interface NetworkStoreRow {
  id: string;
  name: string;
  slug?: string | null;
  network_id?: string | null;
  is_matriz?: boolean | null;
  is_draft?: boolean | null;
  status?: string | null;
  address_city?: string | null;
  address_neighborhood?: string | null;
  force_closed?: boolean | null;
}

export interface NetworkManagerRow {
  store_id: string;
  user_id: string;
  is_active?: boolean | null;
}

export interface NetworkProfileRow {
  user_id: string;
  email?: string | null;
  full_name?: string | null;
}

export interface NetworkGroup {
  network: NetworkRow;
  ownerEmail: string | null;
  ownerName: string | null;
  matrizStore: NetworkStoreRow | null;
  sublojas: NetworkStoreRow[];
  drafts: NetworkStoreRow[];
  managersByStore: Record<string, string | null>;
}

/** Status exibido da rede (suspensa manda — o admin pode suspender). */
export type NetworkDisplayStatus = "suspended" | "paused" | "active";

export function resolveNetworkDisplayStatus(network: NetworkRow): NetworkDisplayStatus {
  if (network.is_approved === false) return "suspended";
  if (network.is_paused) return "paused";
  return "active";
}

export const NETWORK_STATUS_LABELS: Record<NetworkDisplayStatus, string> = {
  suspended: "SUSPENSA",
  paused: "PAUSADA",
  active: "ATIVA",
};

/** Agrupa as redes com suas lojas e gerentes (tudo já carregado). */
export function groupNetworksWithUnits(args: {
  networks: readonly NetworkRow[];
  stores: readonly NetworkStoreRow[];
  managers: readonly NetworkManagerRow[];
  profiles: readonly NetworkProfileRow[];
}): NetworkGroup[] {
  const { networks, stores, managers, profiles } = args;
  const profileById = new Map(profiles.map((p) => [p.user_id, p]));
  const managerEmailByStore = new Map<string, string | null>();
  for (const m of managers) {
    if (!m.is_active) continue;
    managerEmailByStore.set(m.store_id, profileById.get(m.user_id)?.email ?? null);
  }
  return networks.map((network) => {
    const networkStores = stores.filter((s) => s.network_id === network.id);
    const matrizStore = networkStores.find((s) => s.is_matriz) ?? null;
    const sublojas = networkStores.filter((s) => !s.is_matriz);
    const drafts = sublojas.filter((s) => s.is_draft);
    const owner = profileById.get(network.owner_id);
    const managersByStore: Record<string, string | null> = {};
    for (const s of sublojas) {
      managersByStore[s.id] = managerEmailByStore.get(s.id) ?? null;
    }
    return {
      network,
      ownerEmail: owner?.email ?? null,
      ownerName: owner?.full_name ?? null,
      matrizStore,
      sublojas,
      drafts,
      managersByStore,
    };
  });
}

/** Totais do cabeçalho da tela (redes, sublojas, rascunhos, gerentes). */
export function summarizeNetworks(groups: readonly NetworkGroup[]): {
  networks: number;
  sublojas: number;
  drafts: number;
  withManager: number;
  paused: number;
} {
  let sublojas = 0;
  let drafts = 0;
  let withManager = 0;
  let paused = 0;
  for (const g of groups) {
    sublojas += g.sublojas.length;
    drafts += g.drafts.length;
    withManager += Object.values(g.managersByStore).filter((e) => e).length;
    if (resolveNetworkDisplayStatus(g.network) === "paused") paused += 1;
  }
  return { networks: groups.length, sublojas, drafts, withManager, paused };
}

/** Rótulo do plano da rede (mesmo texto das telas de planos). */
export function networkPlanLabel(planType: string): string {
  switch (planType) {
    case "fixed":
      return "Essencial";
    case "commission_only":
      return "Comissão";
    case "pdv_only":
      return "Somente PDV";
    case "hybrid":
      return "Crescimento";
    case "supporter":
      return "Apoiadores";
    default:
      return planType;
  }
}
