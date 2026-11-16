import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PdvKdsPage from "../PdvKdsPage";

// Item 2 do plano do KDS (16/11/2026): o KDS do PDV só listava adicionais
// quando `addons` chegava como array (`Array.isArray`). Pedidos manuais
// gravam `addons` como string JSON, então os adicionais sumiam da tela.
// Estes testes reproduzem o caso 1 do E2E contra a tela real, com a
// consulta do Supabase mockada.

let ordersResult: { data: any[]; error: any } = { data: [], error: null };

const makeChain = () => {
  const chain: any = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.in = () => chain;
  chain.order = () => chain;
  chain.limit = () => Promise.resolve(ordersResult);
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => makeChain(),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-teste" } }),
}));

vi.mock("react-router-dom", async (importActual) => {
  const actual: any = await importActual();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const orderWith = (items: any[]) => ({
  id: "7e311067-0459-4265-a3db-e7fe56c596bc",
  status: "preparando",
  created_at: new Date().toISOString(),
  confirmed_at: null,
  order_source: "manual",
  address_details: null,
  order_items: items,
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("pdv_store_v1", JSON.stringify({ id: "store-teste" }));
  ordersResult = { data: [], error: null };
});

describe("PdvKdsPage — adicionais string + título meio a meio (item 2)", () => {
  it("exibe sabores e adicional quando addons vem como string JSON", async () => {
    ordersResult = {
      data: [
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
      error: null,
    };
    const { unmount } = render(<PdvKdsPage />);
    expect(await screen.findByText("Pizza Meio a Meio")).toBeInTheDocument();
    expect(screen.getByText("½ Calabresa")).toBeInTheDocument();
    expect(screen.getByText("½ Mussarela")).toBeInTheDocument();
    expect(screen.getByText("+ Bacon extra")).toBeInTheDocument();
    expect(screen.getByText(/sem cebola/)).toBeInTheDocument();
    unmount();
  });

  it("exibe sabores e adicional quando addons vem como array, sem duplicar frações", async () => {
    ordersResult = {
      data: [
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
      error: null,
    };
    const { unmount } = render(<PdvKdsPage />);
    expect(await screen.findByText("Pizza Meio a Meio")).toBeInTheDocument();
    expect(screen.getByText("½ Calabresa")).toBeInTheDocument();
    expect(screen.getByText("+ Cheddar extra")).toBeInTheDocument();
    // As frações aparecem só como sabores, não na linha de opcionais.
    expect(screen.queryByText(/\+ ½/)).not.toBeInTheDocument();
    unmount();
  });

  it("exibe opcionais de item sem fração", async () => {
    ordersResult = {
      data: [
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
      error: null,
    };
    const { unmount } = render(<PdvKdsPage />);
    expect(await screen.findByText("Lanche Teste")).toBeInTheDocument();
    expect(screen.getByText("+ Cheddar extra, Bacon extra")).toBeInTheDocument();
    unmount();
  });
});
