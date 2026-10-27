import { describe, it, expect } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PdvMobileBottomNav } from "../PdvMobileBottomNav";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderNav() {
  return render(
    <MemoryRouter initialEntries={["/admin/pdv"]}>
      <Routes>
        <Route
          path="/admin/pdv"
          element={<PdvMobileBottomNav tab="venda" onChange={() => {}} />}
        />
        <Route path="/admin/cardapio" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PdvMobileBottomNav — Cardápio no mobile", () => {
  it("mostra 'Cardápio' no sheet 'Mais' e navega para /admin/cardapio", async () => {
    // Regressão: no PDV mobile não havia como criar cardápio — o FAB de
    // gerenciar cardápio é `hidden md:flex` (só desktop) e nem o menu ☰ da
    // topbar nem o "Mais" da barra inferior tinham o atalho, apesar de o
    // comentário do FAB afirmar que tinham. Lojas pdv_only (sem painel do
    // lojista) ficavam sem nenhum caminho para o cardápio no celular.
    const user = userEvent.setup();
    renderNav();

    // Antes de abrir o "Mais", o Cardápio não está visível.
    expect(screen.queryByRole("button", { name: "Cardápio" })).not.toBeInTheDocument();

    // Os botões da barra têm role="tab" (dentro do tablist) — o "Mais" é
    // um deles; os itens do sheet são <button> comuns.
    await user.click(screen.getByRole("tab", { name: "Mais opções" }));
    const cardapio = await screen.findByRole("button", { name: "Cardápio" });
    await user.click(cardapio);

    expect(await screen.findByTestId("location")).toHaveTextContent("/admin/cardapio");
  });
});
