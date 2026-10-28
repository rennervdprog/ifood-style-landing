import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AReceberTabTeste from "../AReceberTabTeste";

// Fase 5 — A Receber redesenhado. O botão "Pago" pede confirmação
// antes de zerar a dívida (decisão do Renner, 28/10 ~06:33) e o rótulo
// é "R$ 0,99/entrega" (a original escreve "R$2/entrega", errado).
// O supabase é mockado (mesmo padrão do CartContext.test.tsx): a RPC
// devolve as 3 lojas devedoras de 27/10/2026 e as escritas são espiadas.
const mockRpc = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockGetUser = vi.fn();
const mockOpen = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    auth: { getUser: (...args: any[]) => mockGetUser(...args) },
    from: (table: string) => ({
      insert: (...args: any[]) => {
        mockInsert(table, ...args);
        return Promise.resolve({ error: null });
      },
      update: (...args: any[]) => {
        mockUpdate(table, ...args);
        const chain: any = { eq: vi.fn(() => chain) };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve({ error: null }).then(resolve, reject);
        return chain;
      },
    }),
  },
}));

const RPC_ROWS = [
  { store_id: "duda", store_name: "Duda lanches Teste", phone: null, plan_type: "essencial", mensalidade: 0, comissao: 0, entrega_fee: 29.7, pdv_fee: 0, total: 29.7, next_billing_date: "2026-11-20T12:00:00.000Z" },
  { store_id: "pdv-teste", store_name: "PDV Only Teste", phone: null, plan_type: "pdv_only", mensalidade: 0, comissao: 0, entrega_fee: 0, pdv_fee: 18, total: 18, next_billing_date: "2026-11-03T12:00:00.000Z" },
  { store_id: "pastelao", store_name: "Pastelão Carioca", phone: "22977776666", plan_type: "essencial", mensalidade: 0, comissao: 0, entrega_fee: 6, pdv_fee: 1, total: 7, next_billing_date: "2026-11-10T12:00:00.000Z" },
];

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AReceberTabTeste />
    </QueryClientProvider>
  );
}

describe("AReceberTabTeste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: RPC_ROWS, error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    window.open = mockOpen;
  });

  it("mostra o herói com o total e o rótulo R$ 0,99/entrega (nunca 'R$2')", async () => {
    renderTab();
    expect(await screen.findByText("Total a receber das lojas")).toBeInTheDocument();
    expect(screen.getByText(/54,70/)).toBeInTheDocument();
    expect(screen.getByText("R$ 0,99/entrega")).toBeInTheDocument();
    expect(screen.queryByText("R$2/entrega")).toBeNull();
    expect(screen.getByText("Duda lanches Teste")).toBeInTheDocument();
    expect(screen.getByText("PDV Only Teste")).toBeInTheDocument();
    expect(screen.getByText("Pastelão Carioca")).toBeInTheDocument();
  });

  it("'Pago' abre a confirmação e NÃO dá baixa antes de confirmar", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Duda lanches Teste");
    const pagoButtons = screen.getAllByRole("button", { name: "Pago" });
    await user.click(pagoButtons[0]); // Duda, taxa de entrega R$ 29,70
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Dar baixa como pago?");
    expect(dialog).toHaveTextContent(/29,70/);
    expect(dialog).toHaveTextContent("Duda lanches Teste");
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("confirmar no diálogo executa a baixa (insert + zera o saldo)", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Duda lanches Teste");
    await user.click(screen.getAllByRole("button", { name: "Pago" })[0]);
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Dar baixa" }));
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    const [table, rows] = mockInsert.mock.calls[0];
    expect(table).toBe("payout_history");
    expect(rows[0]).toMatchObject({
      entity_type: "store",
      entity_id: "duda",
      amount: 29.7,
      payout_type: "manual",
      kind: "entrega_fee",
    });
    expect(mockUpdate).toHaveBeenCalledWith("store_balances", { repasse_pendente: 0 });
  });

  it("cancelar fecha o diálogo sem nenhuma escrita", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Duda lanches Teste");
    await user.click(screen.getAllByRole("button", { name: "Pago" })[0]);
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("'Cobrar via WhatsApp' sem telefone não abre nada; com telefone abre wa.me com o rótulo certo", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Duda lanches Teste");
    const whatsButtons = screen.getAllByRole("button", { name: "Cobrar via WhatsApp" });
    await user.click(whatsButtons[0]); // Duda, sem telefone
    expect(mockOpen).not.toHaveBeenCalled();
    await user.click(whatsButtons[2]); // Pastelão, com telefone
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const url = String(mockOpen.mock.calls[0][0]);
    expect(url).toContain("https://wa.me/5522977776666?text=");
    expect(url).toContain("Taxa%20R%24%200%2C99%2Fentrega");
    expect(url).not.toContain("R%242");
  });
});
