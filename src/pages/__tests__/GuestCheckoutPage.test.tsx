import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GuestCheckoutPage from "../GuestCheckoutPage";

// Checkout guest — pedir o CEP quando a localização falha (17/11/2026):
// o caso real (Pastelão, Rua Country Club dos Engenheiros, 320, Rio do
// Limão, sem CEP) travava com a mensagem genérica "Confira rua, número e
// bairro" + "Revise o endereço" — nenhuma revisão resolvia, porque o
// endereço estava certo e a cascata de geocodificação é que falhou. Com o
// CEP, a mesma cotação resolve. Estes testes reproduzem o caso contra a
// tela real, com a edge `guest-checkout` mockada (quote_only).

const STORE_ROW = {
  id: "store-1",
  name: "Loja Teste",
  address_city: "Araruama",
  address_state: "RJ",
  minimum_order_value: 0,
  guest_checkout_enabled: true,
  pix_direto_enabled: false,
  pix_direto_key_configured: false,
  is_open: true,
  force_closed: false,
  preorder_enabled: false,
  preorder_minutes_before: 0,
};

const CART_ITEMS = [
  { id: "prod-1", store_id: "store-1", store_name: "Loja Teste", quantity: 1, price: 42.9 },
];

const SUCCESS_QUOTE = {
  ok: true,
  fulfillment: "delivery",
  destination: {
    normalized_address: "Rua Country Club dos Engenheiros, 320",
    cep: "28981240",
    city: "Araruama",
    state: "RJ",
    neighborhood: "Rio do Limão",
    lat: -22.87,
    lng: -42.33,
    precision: "cep",
  },
  distance: { km: 0.8, source: "haversine", max_km: 15, eligible: true },
  pricing: {
    store_delivery_base: 6,
    platform_fee_customer: 0.99,
    platform_fee_store_absorbed: 0,
    delivery_fee: 6.99,
    vip_override_applied: null,
    split_mode: null,
    plan_type: null,
  },
  policy_version: 1,
};

const ADDRESS_FAILURE = { ok: false, reason: "address_unavailable" };

function makeBuilder(rows: unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "order", "limit", "in", "neq", "gte", "lte"]) {
    b[m] = () => b;
  }
  b.maybeSingle = async () => ({
    data: Array.isArray(rows) ? (rows[0] ?? null) : rows,
    error: null,
  });
  b.single = async () => ({
    data: Array.isArray(rows) ? rows[0] : rows,
    error: null,
  });
  b.then = (
    res: (v: { data: unknown; error: null }) => unknown,
    rej?: (e: unknown) => unknown,
  ) => Promise.resolve({ data: rows, error: null }).then(res, rej);
  return b;
}

const TABLE_ROWS: Record<string, unknown> = {
  stores_public: STORE_ROW,
  opening_hours: [],
  store_holidays: [],
};

const invokeMock = vi.fn();
let quoteResponder: (body: any) => unknown = () => ADDRESS_FAILURE;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []),
    functions: { invoke: (...args: any[]) => invokeMock(...args) },
    rpc: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
  },
}));

vi.mock("@/contexts/CartContext", () => ({
  useCart: () => ({ items: CART_ITEMS, subtotal: 42.9, clearCart: vi.fn() }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/lib/pageView", () => ({ trackPageView: vi.fn() }));

vi.mock("@/lib/location", async (importActual) => {
  const actual: any = await importActual();
  return { ...actual, fetchCep: vi.fn(async () => null) };
});

beforeEach(() => {
  invokeMock.mockReset();
  quoteResponder = () => ADDRESS_FAILURE;
  invokeMock.mockImplementation(async (fn: string, opts: any) => {
    if (fn === "guest-lookup") return { data: { found: false }, error: null };
    if (fn === "guest-checkout") return { data: quoteResponder(opts?.body), error: null };
    return { data: null, error: null };
  });
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GuestCheckoutPage />
    </QueryClientProvider>,
  );
}

function fillContactAndAddress() {
  fireEvent.change(screen.getByPlaceholderText("(14) 99999-9999"), {
    target: { value: "22999999999" },
  });
  fireEvent.change(screen.getByPlaceholderText("Seu nome"), {
    target: { value: "Cliente Teste" },
  });
  fireEvent.change(screen.getByPlaceholderText("Rua"), {
    target: { value: "Rua Country Club dos Engenheiros" },
  });
  fireEvent.change(screen.getByPlaceholderText("Nº"), { target: { value: "320" } });
  fireEvent.change(screen.getByPlaceholderText("Bairro"), {
    target: { value: "Rio do Limão" },
  });
}

const CEP_PROMPT = "Informe o CEP para localizar seu endereço.";
const CEP_FAILURE_MESSAGE =
  "Não conseguimos localizar esse endereço sem o CEP. Informe o CEP para localizar seu endereço.";

describe("GuestCheckoutPage — pedir o CEP quando a localização falha", () => {
  it("falha sem CEP pede o CEP: destaque no campo, aviso no resumo e botão 'Informe o CEP'", async () => {
    const { unmount } = renderPage();
    fillContactAndAddress();

    expect(await screen.findByText(CEP_FAILURE_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(CEP_PROMPT)).toBeInTheDocument();
    expect(screen.queryByText(/Confira rua, número e bairro/)).not.toBeInTheDocument();
    const cepInput = screen.getByPlaceholderText("CEP (opcional)");
    expect(cepInput.className).toContain("border-primary");
    expect(cepInput.className).toContain("ring-2");
    expect(await screen.findByRole("button", { name: "Informe o CEP" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revise o endereço" })).not.toBeInTheDocument();
    unmount();
  });

  it("preencher o CEP re-tenta a cotação com o CEP e a falha some", async () => {
    quoteResponder = (body: any) =>
      body?.address?.cep === "28981240" ? SUCCESS_QUOTE : ADDRESS_FAILURE;
    const { unmount } = renderPage();
    fillContactAndAddress();
    expect(await screen.findByText(CEP_PROMPT)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("CEP (opcional)"), {
      target: { value: "28981240" },
    });

    expect(await screen.findByText(/Endereço confirmado/)).toBeInTheDocument();
    expect(screen.queryByText(CEP_PROMPT)).not.toBeInTheDocument();
    expect(screen.queryByText(CEP_FAILURE_MESSAGE)).not.toBeInTheDocument();
    const quoteCalls = invokeMock.mock.calls.filter((c: any[]) => c[0] === "guest-checkout");
    expect(quoteCalls.some((c: any[]) => c[1]?.body?.address?.cep === "28981240")).toBe(true);
    unmount();
  });

  it("falha COM CEP preenchido mantém a mensagem genérica, sem pedir o CEP de novo", async () => {
    const { unmount } = renderPage();
    fireEvent.change(screen.getByPlaceholderText("CEP (opcional)"), {
      target: { value: "28981240" },
    });
    fillContactAndAddress();

    expect(
      await screen.findByText(/Não localizamos esse endereço\. Confira rua, número e bairro/),
    ).toBeInTheDocument();
    expect(screen.queryByText(CEP_PROMPT)).not.toBeInTheDocument();
    const cepInput = screen.getByPlaceholderText("CEP (opcional)");
    expect(cepInput.className).toContain("border-border");
    expect(cepInput.className).not.toContain("border-primary");
    expect(await screen.findByRole("button", { name: "Revise o endereço" })).toBeInTheDocument();
    unmount();
  });

  it("cotação OK sem CEP não muda nada: sem aviso de CEP, hint opcional intacto", async () => {
    quoteResponder = () => SUCCESS_QUOTE;
    const { unmount } = renderPage();
    fillContactAndAddress();

    expect(await screen.findByText(/Endereço confirmado/)).toBeInTheDocument();
    expect(screen.queryByText(CEP_PROMPT)).not.toBeInTheDocument();
    expect(
      screen.getByText("Opcional — ajuda a achar sua rua, mas dá pra pedir sem ele."),
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Escolha a forma de pagamento" })).toBeInTheDocument();
    unmount();
  });

  it("falha que não é de endereço (sem motoboy) não pede o CEP", async () => {
    quoteResponder = () => ({ ok: false, reason: "no_driver_available" });
    const { unmount } = renderPage();
    fillContactAndAddress();

    expect(await screen.findByText(/sem entregador disponível/)).toBeInTheDocument();
    expect(screen.queryByText(CEP_PROMPT)).not.toBeInTheDocument();
    const cepInput = screen.getByPlaceholderText("CEP (opcional)");
    expect(cepInput.className).not.toContain("border-primary");
    expect(await screen.findByRole("button", { name: "Revise o endereço" })).toBeInTheDocument();
    unmount();
  });
});
