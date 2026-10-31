import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "fs";
import { join } from "path";
import MenuBuilder from "../MenuBuilder";
import DailyMenuManager from "../DailyMenuManager";

// Correção "gestor de cardápio do dia invisível em loja nova" (2026-10-31).
// Antes: com o cardápio totalmente vazio, o MenuBuilder renderiza o
// EmptyState NO LUGAR do ramo que contém o MenuToolbar — e o único
// caminho pro gestor ("Cardápio do dia" no dropdown ⋯ da toolbar)
// sumia. Loja recém-criada (ex.: Cantinho Do Tempero, 0 produtos)
// não tinha NENHUM caminho visível pro gestor: a Sheet existia no
// nível raiz, mas nada a abria. E o DailyMenuManager, aberto com
// 0 produtos, mostrava uma lista vazia sem explicação.
// Prova no COMPONENTE REAL (Supabase mockado):
//   1. estado vazio exibe a ação "Cardápio do dia" no EmptyState e o
//      clique abre a Sheet com o gestor + o aviso de vazio;
//   2. o gate de "adegas" é o mesmo da Sheet (ação não aparece);
//   3. com produtos, o caminho atual (⋯ → Cardápio do dia) segue igual;
//   4. DailyMenuManager sem produtos mostra o aviso; com produtos,
//      o fluxo de seleção segue intacto.

let tableRows: Record<string, unknown> = {};

function makeBuilder(rows: unknown) {
  const b: Record<string, unknown> = {};
  for (const m of [
    "select", "eq", "gte", "lte", "in", "is", "order", "neq",
    "insert", "update", "delete", "upsert", "limit",
  ]) {
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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeBuilder(tableRows[table] ?? []),
    rpc: async () => ({ data: null, error: null }),
  },
}));

// jsdom não implementa pointer capture nem scrollIntoView, que os
// primitivos Radix (Sheet/DropdownMenu) usam — stubs de ambiente.
{
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.scrollIntoView) proto.scrollIntoView = () => {};
}
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
}

const EMPTY_TABLES: Record<string, unknown> = {
  menu_sections: [],
  products: [],
  stores: { slug: "loja-teste" },
  addon_groups: [],
  product_addon_groups: [],
  product_recipes: [],
};

const PRODUCT = {
  id: "prod-1",
  store_id: "store-1",
  section_id: null,
  name: "Marmita do Dia",
  price: 25,
  description: "Arroz, feijão e frango",
  image_url: null,
  is_available: true,
  metadata: {},
  sold_by_weight: false,
  price_per_kg: null,
  weight_unit: null,
  sort_order: 0,
  created_at: new Date().toISOString(),
};

function renderBuilder(storeCategory: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MenuBuilder storeId="store-1" storeCategory={storeCategory} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  tableRows = { ...EMPTY_TABLES };
});

describe("MenuBuilder vazio — gestor de cardápio do dia alcançável", () => {
  it("EmptyState exibe 'Cardápio do dia'; o clique abre a Sheet com o gestor e o aviso de vazio", async () => {
    const user = userEvent.setup();
    renderBuilder("restaurante");

    expect(await screen.findByText("Vamos montar seu cardápio")).toBeInTheDocument();

    const action = screen.getByRole("button", { name: "Cardápio do dia" });
    await user.click(action);

    // A Sheet abriu com o DailyMenuManager (o launcher do gestor).
    const launcher = await screen.findByText("Gestor de Cardápio do Dia");
    await user.click(launcher);

    // Sem produtos, o gestor explica em vez de mostrar uma lista vazia.
    expect(
      await screen.findByText(/Nenhum produto cadastrado ainda — cadastre produtos ou importe o cardápio/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Selecione os produtos para atualizar:")).not.toBeInTheDocument();
  });

  it("categoria 'adegas' não oferece a ação (mesmo gate da Sheet)", async () => {
    renderBuilder("adegas");

    expect(await screen.findByText("Vamos montar seu cardápio")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cardápio do dia" })).not.toBeInTheDocument();
  });
});

describe("MenuBuilder com produtos — caminho atual preservado", () => {
  it("⋯ (Mais opções) → 'Cardápio do dia' abre a mesma Sheet com o gestor", async () => {
    tableRows = { ...EMPTY_TABLES, products: [PRODUCT] };
    const user = userEvent.setup();
    renderBuilder("restaurante");

    const more = await screen.findByRole("button", { name: "Mais opções" });
    await user.click(more);

    const item = await screen.findByRole("menuitem", { name: "Cardápio do dia" });
    await user.click(item);

    expect(await screen.findByText("Gestor de Cardápio do Dia")).toBeInTheDocument();
  });
});

describe("DailyMenuManager — aviso de vazio × fluxo com produtos", () => {
  it("sem produtos: abrir o gestor mostra o aviso no lugar da lista", async () => {
    const user = userEvent.setup();
    render(<DailyMenuManager storeId="store-1" products={[]} onUpdate={() => {}} />);

    await user.click(screen.getByText("Gestor de Cardápio do Dia"));

    expect(
      await screen.findByText(/Nenhum produto cadastrado ainda — cadastre produtos ou importe o cardápio/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Selecione os produtos para atualizar:")).not.toBeInTheDocument();
  });

  it("com produtos: lista de seleção aparece, sem o aviso", async () => {
    const user = userEvent.setup();
    render(
      <DailyMenuManager
        storeId="store-1"
        products={[{ id: "p1", name: "Marmita do Dia", price: 25, description: "", metadata: {} }]}
        onUpdate={() => {}}
      />,
    );

    await user.click(screen.getByText("Gestor de Cardápio do Dia"));

    expect(await screen.findByText("Selecione os produtos para atualizar:")).toBeInTheDocument();
    expect(screen.getByText("Marmita do Dia")).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum produto cadastrado ainda/)).not.toBeInTheDocument();
  });
});

describe("Espelho /admin-teste — guarda de fidelidade nas fontes reais", () => {
  const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

  it("MenuBuilderTeste aplica a MESMA correção no EmptyState", () => {
    const src = read("../../pages/admin/sections/MenuBuilderTeste.tsx");
    expect(src).toContain("onOpenDailyMenu?: () => void");
    expect(src).toContain(
      'onOpenDailyMenu={storeCategory !== "adegas" ? () => setDailyMenuOpen(true) : undefined}',
    );
    expect(src).toContain("Cardápio do dia");
  });

  it("DailyMenuManager contém o aviso de vazio", () => {
    const src = read("../DailyMenuManager.tsx");
    expect(src).toContain(
      "Nenhum produto cadastrado ainda — cadastre produtos ou importe o cardápio para montar o cardápio do dia",
    );
    expect(src).toContain("products.length === 0");
  });
});
