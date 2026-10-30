import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import LojistaHomeRedirect from "../LojistaHomeRedirect";
import { useUserRouting } from "@/hooks/useUserRouting";

vi.mock("@/hooks/useUserRouting", () => ({
  useUserRouting: vi.fn(),
}));

const mockUseUserRouting = vi.mocked(useUserRouting);

const baseRouting = {
  role: "lojista" as const,
  isAdmin: false,
  isLojista: true,
  isMatriz: false,
  isMotoboy: false,
  isReseller: false,
  isPdvOnly: false,
  isApproved: true,
  storeId: null as string | null,
  storeSlug: null as string | null,
  homeRoute: "/admin" as const,
  loading: false,
};

function LocationProbe() {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
}

function renderAtAdmin() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <LojistaHomeRedirect>
              <div>painel delivery</div>
            </LojistaHomeRedirect>
          }
        />
        <Route path="/admin/pdv" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LojistaHomeRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin com isPdvOnly NÃO é redirecionado (simulação de painel)", () => {
    // Regressão: o Renner (admin) era jogado para o PDV da Boutique porque
    // o get_user_routing_context devolvia pdv_only (LIMIT 1 arbitrário
    // entre as lojas dele). Admin abre o painel de qualquer loja.
    mockUseUserRouting.mockReturnValue({
      ...baseRouting,
      role: "admin",
      isAdmin: true,
      isLojista: false,
      isPdvOnly: true,
      storeId: "boutique-id",
      homeRoute: "/super-admin",
    });
    renderAtAdmin();
    expect(screen.getByText("painel delivery")).toBeInTheDocument();
  });

  it("admin sem pdv_only abre o painel normalmente", () => {
    mockUseUserRouting.mockReturnValue({
      ...baseRouting,
      role: "admin",
      isAdmin: true,
      isLojista: false,
      homeRoute: "/super-admin",
    });
    renderAtAdmin();
    expect(screen.getByText("painel delivery")).toBeInTheDocument();
  });

  it("lojista pdv_only é redirecionado para o PDV com o storeId dele", () => {
    mockUseUserRouting.mockReturnValue({
      ...baseRouting,
      isPdvOnly: true,
      storeId: "s1",
      homeRoute: "/admin/pdv",
    });
    renderAtAdmin();
    expect(screen.getByText("/admin/pdv?storeId=s1")).toBeInTheDocument();
    expect(screen.queryByText("painel delivery")).not.toBeInTheDocument();
  });

  it("lojista pdv_only sem storeId vai para /admin/pdv", () => {
    mockUseUserRouting.mockReturnValue({
      ...baseRouting,
      isPdvOnly: true,
      homeRoute: "/admin/pdv",
    });
    renderAtAdmin();
    expect(screen.getByText("/admin/pdv")).toBeInTheDocument();
  });

  it("lojista delivery abre o painel normalmente", () => {
    mockUseUserRouting.mockReturnValue({ ...baseRouting });
    renderAtAdmin();
    expect(screen.getByText("painel delivery")).toBeInTheDocument();
  });

  it("enquanto carrega mostra o spinner e não redireciona", () => {
    mockUseUserRouting.mockReturnValue({ ...baseRouting, loading: true });
    renderAtAdmin();
    expect(screen.queryByText("painel delivery")).not.toBeInTheDocument();
    expect(document.querySelector("svg.animate-spin")).not.toBeNull();
  });
});
