import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductFormInline } from "./ProductCard";
import { ProductSheet } from "./ProductSheet";

const initialProduct = {
  name: "Produto de teste",
  price: "12.50",
  description: "",
  image_url: "",
  metadata: {},
};

afterEach(() => cleanup());

describe("experiência de cadastro de produto", () => {
  it("associa semanticamente o rótulo ao seletor de categoria em lojas multicategoria", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <ProductFormInline
          initial={initialProduct}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          storeCategory="lanches"
          storeCategories={["lanches", "farmacias"]}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText("Categoria do produto")).toBeTruthy();
  });

  it("explica e encaminha o novo produto para a seção selecionada", () => {
    const onSave = vi.fn();

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ProductSheet
          open
          onOpenChange={vi.fn()}
          mode="create"
          sectionId="bebidas"
          sections={[
            { id: "lanches", name: "Lanches" },
            { id: "bebidas", name: "Bebidas" },
          ]}
          onSave={onSave}
          storeCategory="lanches"
        />
      </QueryClientProvider>,
    );

    const sectionSelect = screen.getByLabelText("Seção de destino") as HTMLSelectElement;
    expect(sectionSelect.value).toBe("bebidas");
    expect(screen.getByText(/Este produto será salvo em/i).textContent).toContain("Bebidas");

    fireEvent.change(sectionSelect, { target: { value: "lanches" } });
    expect(screen.getByText(/Este produto será salvo em/i).textContent).toContain("Lanches");

    const nameInput = screen.getByPlaceholderText("Nome do produto *");
    const priceInput = screen.getByPlaceholderText("0,00");
    fireEvent.change(nameInput, { target: { value: "Produto com seção" } });
    fireEvent.change(priceInput, { target: { value: "1290" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Produto" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Produto com seção", price: "12.90" }),
      "lanches",
    );
  });

  it("mantém a opção explícita de salvar sem seção", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ProductSheet
          open
          onOpenChange={vi.fn()}
          mode="create"
          sections={[]}
          onSave={vi.fn()}
          storeCategory="lanches"
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Sem seção — organizar depois")).toBeTruthy();
    expect(screen.getByText("Você pode salvar agora e mover o produto para uma seção depois.")).toBeTruthy();
  });
});
