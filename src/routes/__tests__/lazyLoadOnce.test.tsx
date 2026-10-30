import { Suspense } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadLazyOnce } from "../lazyLoadOnce";

const Ok = () => <div>Página carregada</div>;

function renderLazy(Comp: React.ComponentType) {
  return render(
    <Suspense fallback={<div>carregando</div>}>
      <Comp />
    </Suspense>,
  );
}

describe("loadLazyOnce — sem loop infinito no reload", () => {
  const reloadMock = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    sessionStorage.clear();
    reloadMock.mockClear();
    // jsdom não deixa espiar window.location.reload (não-configurável);
    // troca o objeto location inteiro por um com reload mockado.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("carrega normal quando o chunk existe e limpa marca antiga", async () => {
    sessionStorage.setItem("lazy-reload:rota-ok", "1");
    const Comp = loadLazyOnce("rota-ok", () => Promise.resolve({ default: Ok }));
    renderLazy(Comp);
    await screen.findByText("Página carregada");
    expect(reloadMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("lazy-reload:rota-ok")).toBeNull();
  });

  it("na 1ª falha recarrega UMA vez e não mostra erro", async () => {
    const Comp = loadLazyOnce("rota-falha-1", () =>
      Promise.reject(new Error("chunk 404")),
    );
    renderLazy(Comp);
    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem("lazy-reload:rota-falha-1")).toBe("1");
    expect(screen.queryByText("Não foi possível carregar esta tela")).toBeNull();
  });

  it("na 2ª falha NÃO recarrega e mostra a tela de erro com botão", async () => {
    sessionStorage.setItem("lazy-reload:rota-falha-2", "1");
    const Comp = loadLazyOnce("rota-falha-2", () =>
      Promise.reject(new Error("chunk 404")),
    );
    renderLazy(Comp);
    await screen.findByText("Não foi possível carregar esta tela");
    expect(reloadMock).not.toHaveBeenCalled();
    const btn = screen.getByRole("button", { name: "Atualizar a página" });
    await userEvent.click(btn);
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("lazy-reload:rota-falha-2")).toBeNull();
  });

  it("a marca é por rota: falhar numa rota não gasta a recarga da outra", async () => {
    const CompA = loadLazyOnce("rota-a", () => Promise.reject(new Error("chunk 404")));
    const CompB = loadLazyOnce("rota-b", () => Promise.reject(new Error("chunk 404")));
    renderLazy(CompA);
    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
    renderLazy(CompB);
    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(2));
  });
});
