// Deep links do /super-admin(-teste): ?aba=<tab>&secao=<secao>
// Fase 1 da reestruturação do super-admin.
// A URL sempre reflete a tela atual: atualizar a página volta no mesmo
// lugar, e dá para compartilhar/favoritar uma tela específica.

export type SuperAdminFinanceSection =
  | "consolidado"
  | "fluxo"
  | "saques"
  | "areceber"
  | "historico"
  | "conciliacao"
  | "socios"
  | "test"
  | "mensalidades"
  | "planos-lojas"
  | "planos-templates"
  | "addons"
  | "revendedores"
  | "auditoria";

export type SuperAdminStoresSection = "lojas" | "cidades" | "entrega";
export type SuperAdminAppPageSection = "page" | "links";
export type SuperAdminAuditoriaSection = "auditoria" | "logs" | "debug-loja";

export interface SuperAdminDeepLink {
  tab: string;
  financeSection?: SuperAdminFinanceSection;
  storesSection?: SuperAdminStoresSection;
  appPageSection?: SuperAdminAppPageSection;
  auditoriaSection?: SuperAdminAuditoriaSection;
}

const VALID_TABS = new Set([
  "dashboard",
  "approvals",
  "stores",
  "financeiro",
  "pagamentos",
  "saques",
  "sync",
  "coupons",
  "entrega",
  "cidades",
  "juridico",
  "planos",
  "moderadores",
  "socios",
  "suporte",
  "app-page",
  "test_finance",
  "links",
  "broadcast",
  "logs",
  "coach",
  "auditoria",
  "whatsapp_plataforma",
  "atrasados",
]);

// Abas antigas -> aba consolidada + seção (mesmo mapa do painel).
const LEGACY_TAB_MAP: Record<string, SuperAdminDeepLink> = {
  pagamentos: { tab: "financeiro", financeSection: "areceber" },
  saques: { tab: "financeiro", financeSection: "saques" },
  planos: { tab: "financeiro", financeSection: "planos-lojas" },
  socios: { tab: "financeiro", financeSection: "socios" },
  test_finance: { tab: "financeiro", financeSection: "test" },
  cidades: { tab: "stores", storesSection: "cidades" },
  entrega: { tab: "stores", storesSection: "entrega" },
  links: { tab: "app-page", appPageSection: "links" },
  logs: { tab: "auditoria", auditoriaSection: "logs" },
};

const FINANCE_SECTIONS = new Set([
  "consolidado",
  "fluxo",
  "saques",
  "areceber",
  "historico",
  "conciliacao",
  "socios",
  "test",
  "mensalidades",
  "planos-lojas",
  "planos-templates",
  "addons",
  "revendedores",
  "auditoria",
]);

const STORES_SECTIONS = new Set(["lojas", "cidades", "entrega"]);
const APP_PAGE_SECTIONS = new Set(["page", "links"]);
const AUDITORIA_SECTIONS = new Set(["auditoria", "logs", "debug-loja"]);

export function parseSuperAdminDeepLink(search: string): SuperAdminDeepLink {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const rawTab = params.get("aba") || "dashboard";
  const rawSection = params.get("secao") || undefined;

  const legacy = LEGACY_TAB_MAP[rawTab];
  if (legacy) return { ...legacy };

  const tab = VALID_TABS.has(rawTab) ? rawTab : "dashboard";
  if (!rawSection) return { tab };

  if (tab === "financeiro" && FINANCE_SECTIONS.has(rawSection)) {
    return { tab, financeSection: rawSection as SuperAdminFinanceSection };
  }
  if (tab === "stores" && STORES_SECTIONS.has(rawSection)) {
    return { tab, storesSection: rawSection as SuperAdminStoresSection };
  }
  if (tab === "app-page" && APP_PAGE_SECTIONS.has(rawSection)) {
    return { tab, appPageSection: rawSection as SuperAdminAppPageSection };
  }
  if (tab === "auditoria" && AUDITORIA_SECTIONS.has(rawSection)) {
    return { tab, auditoriaSection: rawSection as SuperAdminAuditoriaSection };
  }
  return { tab };
}

export function buildSuperAdminDeepLink(link: {
  tab: string;
  financeSection?: string;
  storesSection?: string;
  appPageSection?: string;
  auditoriaSection?: string;
}): string {
  const params = new URLSearchParams();
  params.set("aba", link.tab || "dashboard");
  // A seção só vai para a URL quando não é a padrão da aba — URL limpa.
  if (link.tab === "financeiro" && link.financeSection && link.financeSection !== "consolidado") {
    params.set("secao", link.financeSection);
  }
  if (link.tab === "stores" && link.storesSection && link.storesSection !== "lojas") {
    params.set("secao", link.storesSection);
  }
  if (link.tab === "app-page" && link.appPageSection && link.appPageSection !== "page") {
    params.set("secao", link.appPageSection);
  }
  if (link.tab === "auditoria" && link.auditoriaSection && link.auditoriaSection !== "auditoria") {
    params.set("secao", link.auditoriaSection);
  }
  return `?${params.toString()}`;
}
