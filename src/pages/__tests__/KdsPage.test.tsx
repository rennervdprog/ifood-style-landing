import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import KdsPage from "../KdsPage";

// Item 1 do plano do KDS (16/11/2026): a tela do link escondia sabores e
// adicionais — pizza meio a meio aparecia só como "Pizza Meio a Meio".
// Estes testes reproduzem o caso 1 do E2E (pedido com addons em string JSON
// e em array) contra a tela real, com a edge `kds` mockada.

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: any[]) => invokeMock(...args) } },
}));

vi.mock("react-router-dom", async (importActual) => {
  const actual: any = await importActual();
  return { ...actual, useParams: () => ({ token: "tok-teste" }) };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const orderWith = (items: any[]) => ({
  id: "7e311067-0459-4265-a3db-e7fe56c596bc",
  status: "preparando",
  created_at: new Date().toISOString(),
  order_items: items,
});

beforeEach(() => {
  invokeMock.mockReset();
});

describe("KdsPage — sabores e adicionais (item 1)", () => {
  it("exibe sabores e adicional quando addons vem como string JSON", async () => {
    invokeMock.mockResolvedValue({
      data: {
        store_name: "Loja Demonstração",
        orders: [
          orderWith([
            {
              id: "it1",
              quantity: 1,
              observations: "sem cebola",
              addons: JSON.stringify([
                { name: "½ Calabresa", price: 0 },
                { name: "½ Mussarela", price: 0 },
                { name: "Bacon extra", price: 5 },
              ]),
              products: { name: "Pizza Teste KDS" },
            },
          ]),
        ],
      },
      error: null,
    });
    const { unmount } = render(<KdsPage />);
    expect(await screen.findByText("Pizza Meio a Meio")).toBeInTheDocument();
    expect(await screen.findByText("½ Calabresa")).toBeInTheDocument();
    expect(screen.getByText("½ Mussarela")).toBeInTheDocument();
    expect(screen.getByText("+ Bacon extra")).toBeInTheDocument();
    expect(screen.getByText("obs: sem cebola")).toBeInTheDocument();
    unmount();
  });

  it("exibe adicional quando addons vem como array, sem duplicar frações", async () => {
    invokeMock.mockResolvedValue({
      data: {
        store_name: "Loja Demonstração",
        orders: [
          orderWith([
            {
              id: "it2",
              quantity: 1,
              observations: "massa crocante",
              addons: [
                { name: "½ Calabresa", price: 0 },
                { name: "½ Mussarela", price: 0 },
                { name: "Cheddar extra", price: 4 },
              ],
              products: { name: "Pizza Teste KDS" },
            },
          ]),
        ],
      },
      error: null,
    });
    const { unmount } = render(<KdsPage />);
    expect(await screen.findByText("Pizza Meio a Meio")).toBeInTheDocument();
    expect(screen.getByText("½ Calabresa")).toBeInTheDocument();
    expect(screen.getByText("+ Cheddar extra")).toBeInTheDocument();
    // As frações aparecem só como sabores, não na linha de opcionais.
    expect(screen.queryByText(/\+ ½/)).not.toBeInTheDocument();
    unmount();
  });

  it("exibe opcionais de item sem fração", async () => {
    invokeMock.mockResolvedValue({
      data: {
        store_name: "Loja Demonstração",
        orders: [
          orderWith([
            {
              id: "it3",
              quantity: 2,
              observations: null,
              addons: [{ name: "Cheddar extra" }, { name: "Bacon extra" }],
              products: { name: "Lanche Teste" },
            },
          ]),
        ],
      },
      error: null,
    });
    const { unmount } = render(<KdsPage />);
    expect(await screen.findByText("Lanche Teste")).toBeInTheDocument();
    expect(screen.getByText("+ Cheddar extra, Bacon extra")).toBeInTheDocument();
    unmount();
  });
});
