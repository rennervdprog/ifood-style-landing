import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MensalidadesPanelTeste from "../MensalidadesPanelTeste";

// Fase 6 — Mensalidades redesenhado. Decisão do Renner (28/10 ~06:58):
// inclui os planos Somente PDV — a Silvia aparece e o MRR vira R$ 1.071,50.
// O supabase é mockado (mesmo padrão do AReceberTabTeste.test.tsx).
// As datas são relativas ao dia do teste: status/atraso/próximas cobranças
// dependem de "hoje", então nada pode ser data fixa.
const mockPlans = vi.fn();
const mockStores = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        in: () =>
          Promise.resolve({
            data: table === "store_plans" ? mockPlans() : mockStores(),
            error: null,
          }),
      };
      chain.then = (resolve: any, reject: any) =>
        Promise.resolve({
          data: table === "store_plans" ? mockPlans() : mockStores(),
          error: null,
        }).then(resolve, reject);
      return chain;
    },
  },
}));

const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const short = (iso: string) => iso.slice(0, 10).split("-").reverse().slice(0, 2).join("/");

const PLANS = [
  { store_id: "ric", plan_type: "fixed", monthly_fee: 89.9, next_billing_date: day(7), last_billed_at: day(-77), trial_ends_at: null, started_at: day(-30), is_active: true },
  { store_id: "silvia", plan_type: "pdv_only", monthly_fee: 130, next_billing_date: day(23), last_billed_at: null, trial_ends_at: "2026-06-28T18:04:07.792987+00", started_at: day(-120), is_active: true },
  { store_id: "gelo", plan_type: "fixed", monthly_fee: 0, next_billing_date: day(-28), last_billed_at: null, trial_ends_at: null, started_at: day(-60), is_active: true },
  { store_id: "demo", plan_type: "fixed", monthly_fee: 69, next_billing_date: day(18), last_billed_at: null, trial_ends_at: day(90), started_at: day(-30), is_active: true },
  { store_id: "atr", plan_type: "fixed", monthly_fee: 69, next_billing_date: day(-5), last_billed_at: null, trial_ends_at: null, started_at: day(-60), is_active: true },
];

const STORES = [
  { id: "ric", name: "Ric Burguer", is_test: false, status: "ativo" },
  { id: "silvia", name: "Restaurante Cantinho da Silvia", is_test: false, status: "ativo" },
  { id: "gelo", name: "Gelobol", is_test: false, status: "ativo" },
  { id: "demo", name: "Loja Demonstração", is_test: false, status: "ativo" },
  { id: "atr", name: "Loja Atrasada", is_test: false, status: "ativo" },
];

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MensalidadesPanelTeste />
    </QueryClientProvider>,
  );
}

describe("MensalidadesPanelTeste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlans.mockReturnValue(PLANS);
    mockStores.mockReturnValue(STORES);
  });

  it("herói soma fixed + pdv_only e mostra a Silvia na lista", async () => {
    renderPanel();
    // MRR: 89,90 + 130 + 0 + 69 + 69 = 357,90
    expect(await screen.findByText("MRR · Receita mensal recorrente")).toBeInTheDocument();
    // Herói + cartão Resumo mostram o mesmo MRR.
    expect(screen.getAllByText(/357,90/)).toHaveLength(2);
    expect(screen.getByText("Restaurante Cantinho da Silvia")).toBeInTheDocument();
    expect(screen.getByText("Somente PDV")).toBeInTheDocument();
    // Herói + cartão Resumo do MRR mostram "5 lojas ativas".
    expect(screen.getAllByText(/5 lojas ativas/)).toHaveLength(2);
    expect(screen.getByText(/4 com mensalidade acima de R\$ 0,00/)).toBeInTheDocument();
  });

  it("cada linha mostra a próxima cobrança; trial mostra o fim do trial", async () => {
    renderPanel();
    await screen.findByText("Restaurante Cantinho da Silvia");
    expect(screen.getByText(`Próx. cobrança ${short(day(23))} · LTV R$ 520,00`)).toBeInTheDocument();
    expect(screen.getByText(`Próx. cobrança ${short(day(7))} · LTV R$ 89,90 · última cobrança ${short(day(-77))}`)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`trial até ${short(day(90))}`))).toBeInTheDocument();
    expect(screen.getByText("Trial")).toBeInTheDocument();
  });

  it("atenção destaca a vencida e a cobrança dos próximos 7 dias", async () => {
    renderPanel();
    await screen.findByText("Restaurante Cantinho da Silvia");
    expect(screen.getByText("1 mensalidade vencida")).toBeInTheDocument();
    expect(screen.getByText("Atrasado")).toBeInTheDocument();
    expect(screen.getByText("5d atraso")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`1 cobrança vence em ${short(day(7))}`))).toBeInTheDocument();
    // Na linha da loja e no detalhe de atenção.
    expect(screen.getAllByText("Ric Burguer")).toHaveLength(2);
  });

  it("loja de R$ 0 com vencimento passado fica em dia (não conta como vencida)", async () => {
    renderPanel();
    await screen.findByText("Gelobol");
    // Inadimplência continua sendo só a Loja Atrasada (R$ 69,00).
    // toFixed(1) formata com ponto ("20.0%"), igual ao painel original.
    expect(screen.getByText(/1 lojas · 20\.0%/)).toBeInTheDocument();
  });

  it("botão CSV existe e estado vazio aparece sem planos", async () => {
    renderPanel();
    await screen.findByText("Restaurante Cantinho da Silvia");
    expect(screen.getByRole("button", { name: "CSV" })).toBeInTheDocument();

    mockPlans.mockReturnValue([]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MensalidadesPanelTeste />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Sem planos com mensalidade ativa.")).toBeInTheDocument();
  });
});
