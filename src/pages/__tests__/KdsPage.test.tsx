import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

describe("KdsPage — número real do pedido (item 3)", () => {
  // A edge `kds` deployada (v41) ainda NÃO devolve `order_number` — o campo
  // só chega após o item 8 do plano. Estes testes provam o caminho de
  // exibição: com o campo, mostra o número real; sem ele, o fallback.
  it("exibe o order_number quando a edge o devolve", async () => {
    invokeMock.mockResolvedValue({
      data: {
        store_name: "Loja Demonstração",
        orders: [
          {
            ...orderWith([
              { id: "it1", quantity: 1, observations: null, addons: [], products: { name: "Lanche Teste" } },
            ]),
            order_number: 992038,
          },
        ],
      },
      error: null,
    });
    const { unmount } = render(<KdsPage />);
    expect(await screen.findByText("#992038")).toBeInTheDocument();
    expect(screen.queryByText("#7e3110")).not.toBeInTheDocument();
    unmount();
  });

  it("cai para o prefixo do UUID quando a edge não devolve order_number", async () => {
    invokeMock.mockResolvedValue({
      data: {
        store_name: "Loja Demonstração",
        orders: [
          orderWith([
            { id: "it1", quantity: 1, observations: null, addons: [], products: { name: "Lanche Teste" } },
          ]),
        ],
      },
      error: null,
    });
    const { unmount } = render(<KdsPage />);
    expect(await screen.findByText("#7e3110")).toBeInTheDocument();
    unmount();
  });
});

describe("KdsPage — som de pedido novo (item 4)", () => {
  // A detecção (id novo apita, polling não apita) é coberta no teste do
  // hook; aqui fica a fiação da tela: botão, gesto de ativar e mudo.
  let playMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    playMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(playMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const loadPage = () => {
    invokeMock.mockResolvedValue({
      data: {
        store_name: "Loja Demonstração",
        orders: [
          orderWith([
            { id: "it1", quantity: 1, observations: null, addons: [], products: { name: "Lanche Teste" } },
          ]),
        ],
      },
      error: null,
    });
    return render(<KdsPage />);
  };

  it("exibe o botão Ativar som e ativa ao clicar", async () => {
    const { unmount } = loadPage();
    const btn = await screen.findByRole("button", { name: "Ativar alertas sonoros de novos pedidos" });
    expect(btn).toHaveTextContent("Ativar som");
    expect(playMock).not.toHaveBeenCalled();
    fireEvent.click(btn);
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Silenciar" })).toBeInTheDocument();
    unmount();
  });

  it("botão de mudo alterna entre silenciar e reativar", async () => {
    const { unmount } = loadPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ativar alertas sonoros de novos pedidos" }));
    fireEvent.click(await screen.findByRole("button", { name: "Silenciar" }));
    expect(await screen.findByRole("button", { name: "Reativar som" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reativar som" }));
    expect(await screen.findByRole("button", { name: "Silenciar" })).toBeInTheDocument();
    unmount();
  });

  it("mostra 'Toque para ativar o som' quando o navegador bloqueia o play", async () => {
    playMock.mockRejectedValueOnce(new Error("NotAllowedError"));
    const { unmount } = loadPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ativar alertas sonoros de novos pedidos" }));
    expect(await screen.findByText("Toque para ativar o som")).toBeInTheDocument();
    unmount();
  });
});
