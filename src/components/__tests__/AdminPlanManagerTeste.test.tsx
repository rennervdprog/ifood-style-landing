import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminPlanManagerTeste from "../AdminPlanManagerTeste";
import AdminPlanManager from "../AdminPlanManager";

// Fase 7 — Planos das lojas redesenhado. Decisão do Renner (28/10 ~07:33):
// inclui o Somente PDV como plano de primeira classe (cartão, selo, botão).
// O supabase é mockado (mesmo padrão do MensalidadesPanelTeste.test.tsx).
// As datas são relativas ao dia do teste: próxima cobrança e "há N dias"
// dependem de "hoje", então nada pode ser data fixa.
const updateCalls: any[] = [];
const insertCalls: any[] = [];

const mockData = (table: string) => {
  if (table === "plan_templates") return TEMPLATES;
  if (table === "stores") return STORES;
  if (table === "store_plans") return PLANS;
  if (table === "plan_change_requests") return REQUESTS;
  if (table === "store_addons") return ADDONS;
  return [];
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        update: (vals: any) => {
          updateCalls.push(vals);
          return chain;
        },
        insert: (vals: any) => {
          insertCalls.push(vals);
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle: () =>
          Promise.resolve({
            data: table === "store_plans" ? { id: "p1" } : null,
            error: null,
          }),
      };
      chain.then = (resolve: any, reject: any) =>
        Promise.resolve({ data: mockData(table), error: null }).then(resolve, reject);
      return chain;
    },
    functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const short = (iso: string) => iso.slice(0, 10).split("-").reverse().slice(0, 2).join("/");

const TEMPLATES = [
  {
    plan_key: "pdv_only",
    label: "Somente PDV",
    monthly_fee: 120,
    commission_rate: 0,
    // Descrição defasada do template (R$ 69) — o Teste usa o texto do protótipo.
    description: "PDV completo para lojas físicas. R$ 69,00/mês sem taxa de plataforma nem comissão.",
    features: ["PDV completo", "Impressão térmica"],
    sort_order: 0,
  },
  {
    plan_key: "fixed",
    label: "Essencial",
    monthly_fee: 89.9,
    commission_rate: 0,
    description: "Mensalidade fixa",
    features: ["Cardápio digital"],
    sort_order: 2,
  },
];

const STORES = [
  { id: "silvia", name: "Restaurante Cantinho da Silvia", status: "ativo", address_city: "Itatinga", is_test: false },
  { id: "ric", name: "Ric Burguer", status: "ativo", address_city: "Araruama", is_test: false },
  { id: "duda", name: "Duda lanches", status: "ativo", address_city: "Araruama", is_test: false },
  { id: "gelo", name: "Gelobol", status: "ativo", address_city: "Araruama", is_test: false },
  { id: "e2e2", name: "Loja Teste E2E 2", status: "ativo", address_city: "Araruama", is_test: false },
  { id: "teste", name: "Loja Teste", status: "ativo", address_city: "Araruama", is_test: true },
  { id: "sem", name: "Teste Boutique Boutique", status: "ativo", address_city: "Araruama", is_test: false },
];

const PLANS = [
  { store_id: "silvia", plan_type: "pdv_only", monthly_fee: 130, commission_rate: 0, next_billing_date: day(23), last_billed_at: null, trial_ends_at: "2026-06-28T00:00:00.000Z", started_at: day(-120), is_active: true, essencial_lifetime_free: true, pdv_enabled: true, pdv_commission_rate: 0, pdv_commission_pending: 0, pdv_fixed_fee_per_sale: 0 },
  { store_id: "ric", plan_type: "fixed", monthly_fee: 89.9, commission_rate: 0, next_billing_date: day(7), last_billed_at: null, trial_ends_at: null, started_at: day(-30), is_active: true, essencial_lifetime_free: false, pdv_enabled: true, pdv_commission_rate: 0, pdv_commission_pending: 0, pdv_fixed_fee_per_sale: 1 },
  { store_id: "duda", plan_type: "fixed", monthly_fee: 89.9, commission_rate: 0, next_billing_date: day(7), last_billed_at: null, trial_ends_at: null, started_at: day(-30), is_active: true, essencial_lifetime_free: false, pdv_enabled: true, pdv_commission_rate: 0, pdv_commission_pending: 0, pdv_fixed_fee_per_sale: 1 },
  { store_id: "gelo", plan_type: "commission_only", monthly_fee: 0, commission_rate: 6, next_billing_date: day(11), last_billed_at: null, trial_ends_at: null, started_at: day(-60), is_active: true, essencial_lifetime_free: false, pdv_enabled: true, pdv_commission_rate: 0, pdv_commission_pending: 0, pdv_fixed_fee_per_sale: 0 },
  { store_id: "e2e2", plan_type: "commission_only", monthly_fee: 0, commission_rate: 6, next_billing_date: day(11), last_billed_at: null, trial_ends_at: null, started_at: day(-60), is_active: true, essencial_lifetime_free: false, pdv_enabled: true, pdv_commission_rate: 0, pdv_commission_pending: 0, pdv_fixed_fee_per_sale: 0 },
  { store_id: "teste", plan_type: "fixed", monthly_fee: 10, commission_rate: 0, next_billing_date: day(11), last_billed_at: null, trial_ends_at: null, started_at: day(-30), is_active: true, essencial_lifetime_free: false, pdv_enabled: false, pdv_commission_rate: 0, pdv_commission_pending: 0, pdv_fixed_fee_per_sale: 1 },
];

const REQUESTS = [
  {
    id: "req1",
    store_id: "e2e2",
    status: "pending",
    current_plan_type: "commission_only",
    current_monthly_fee: 0,
    requested_plan_type: "fixed",
    requested_monthly_fee: 89.9,
    requested_commission_rate: 0,
    requested_at: day(-19),
  },
];

const ADDONS = [{ store_id: "sem" }];

function renderTeste() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminPlanManagerTeste />
    </QueryClientProvider>,
  );
}

function renderOriginal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminPlanManager />
    </QueryClientProvider>,
  );
}

describe("AdminPlanManagerTeste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateCalls.length = 0;
    insertCalls.length = 0;
  });

  it("herói soma fixed + pdv_only e mostra o exato e o sem-teste", async () => {
    renderTeste();
    // Total: 130 + 89,90 + 89,90 + 0 + 0 + 10 = 319,80; sem teste: 309,80.
    expect(await screen.findByText("Receita mensal · todos os planos ativos")).toBeInTheDocument();
    expect(screen.getByText("R$ 320")).toBeInTheDocument();
    // "R$ 319,80/mês" aparece 2×: no contexto do herói e no grupo Pagantes.
    expect(screen.getAllByText(/R\$ 319,80\/mês/)).toHaveLength(2);
    expect(screen.getByText(/R\$ 309,80/)).toBeInTheDocument();
    expect(screen.getByText(/6 planos ativos · 1 lojas sem plano · 4 pagantes/)).toBeInTheDocument();
  });

  it("distribuição inclui Somente PDV e Sem plano", async () => {
    renderTeste();
    expect(await screen.findByText("Distribuição")).toBeInTheDocument();
    // Essencial 3 (ric, duda, teste), Comissão 2, Somente PDV 1, Sem plano 1.
    const cards = screen.getAllByText("Somente PDV");
    expect(cards.length).toBeGreaterThan(0);
    expect(screen.getByText(/R\$ 120,00\/mês · R\$ 130,00 no total/)).toBeInTheDocument();
    expect(screen.getByText(/2 pagando o valor cheio/)).toBeInTheDocument();
    expect(screen.getByText(/2 com 6%/)).toBeInTheDocument();
  });

  it("cartão Somente PDV é novo, com o texto do protótipo (não o defasado do template)", async () => {
    renderTeste();
    expect(await screen.findByRole("heading", { name: "Somente PDV" })).toBeInTheDocument();
    expect(screen.getByText("NOVO · 1 lojas")).toBeInTheDocument();
    expect(screen.getByText("Só o PDV presencial, sem delivery — o plano da Silvia.")).toBeInTheDocument();
    expect(screen.queryByText(/R\$ 69,00\/mês sem taxa de plataforma/)).not.toBeInTheDocument();
  });

  it("atenção mostra a solicitação pendente há 19 dias e a loja sem plano com add-on PDV", async () => {
    renderTeste();
    expect(await screen.findByText("Precisa de atenção")).toBeInTheDocument();
    expect(screen.getByText(/há 19 dias/)).toBeInTheDocument();
    expect(screen.getByText(/Loja Teste E2E 2 quer sair de Comissão/)).toBeInTheDocument();
    expect(screen.getByText("1 lojas sem plano")).toBeInTheDocument();
    expect(screen.getAllByText(/Teste Boutique Boutique/)).toHaveLength(2);
    expect(screen.getByText(/com o add-on PDV ativado/)).toBeInTheDocument();
  });

  it("linha da Silvia tem selo com nome, próxima cobrança e Personalizado", async () => {
    renderTeste();
    expect(await screen.findByText("Restaurante Cantinho da Silvia")).toBeInTheDocument();
    // Selo com nome aparece na linha (o original deixava sem nome).
    expect(screen.getAllByText("Somente PDV").length).toBeGreaterThan(0);
    expect(screen.getByText("R$ 130,00")).toBeInTheDocument();
    expect(screen.getByText(`Próx. ${short(day(23))} · Personalizado`)).toBeInTheDocument();
    // Lista agrupada: pagantes antes dos gratuitos.
    expect(screen.getByText(/Pagantes · 4 lojas · R\$ 319,80\/mês/)).toBeInTheDocument();
    expect(screen.getByText(/Gratuitos · 2 lojas/)).toBeInTheDocument();
    expect(screen.getByText(/Sem plano · 1 lojas/)).toBeInTheDocument();
  });

  it("expandir a Silvia mostra o botão Somente PDV desabilitado (plano atual)", async () => {
    const user = userEvent.setup();
    renderTeste();
    await screen.findByText("Restaurante Cantinho da Silvia");
    await user.click(screen.getByText("Restaurante Cantinho da Silvia"));
    expect(await screen.findByText("Alterar plano")).toBeInTheDocument();
    // O nome acessível do botão da linha inclui o subtítulo — o botão de
    // troca é o que COMEÇA com "Somente PDV".
    const buttons = screen.getAllByRole("button", { name: /^Somente PDV/ });
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0]).toBeDisabled();
  });

  it("trocar o Gelobol para Somente PDV grava plan_type pdv_only com R$ 120", async () => {
    const user = userEvent.setup();
    renderTeste();
    await screen.findByText("Gelobol");
    await user.click(screen.getByText("Gelobol"));
    expect(await screen.findByText("Alterar plano")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: /^Somente PDV/ });
    const target = buttons.find((b) => !b.hasAttribute("disabled"));
    expect(target).toBeDefined();
    await user.click(target!);
    expect(updateCalls.some((c) => c.plan_type === "pdv_only" && c.monthly_fee === 120 && c.commission_rate === 0)).toBe(true);
  });
});

describe("AdminPlanManager (original intacto)", () => {
  it("não conhece o Somente PDV: sem cartão, sem selo com nome, sem próxima cobrança", async () => {
    renderOriginal();
    expect(await screen.findByText("Receita Mensal")).toBeInTheDocument();
    expect(screen.queryByText("Somente PDV")).not.toBeInTheDocument();
    expect(screen.queryByText("NOVO")).not.toBeInTheDocument();
    expect(screen.queryByText(/Próx\./)).not.toBeInTheDocument();
    // A Silvia continua sem nome de plano no original.
    expect(screen.getByText("Restaurante Cantinho da Silvia")).toBeInTheDocument();
  });
});
