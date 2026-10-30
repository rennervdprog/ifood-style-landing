/**
 * Regressão — item 3 do plano de correções (preço do adicional ÷100).
 *
 * O AddonPriceInput era definido DENTRO do AddonManager/AddonManagerTeste:
 * a cada render ele ganhava identidade nova, o React remontava o <input> a
 * cada tecla, o foco se perdia após o 1º dígito e só ele era salvo
 * (digitar 2,00 gravava R$ 0,02). Estes testes usam o componente REAL,
 * içado para nível de módulo, com o mesmo gesto que falhava.
 */
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddonPriceInput } from "@/components/AddonManager";
import { AddonPriceInput as AddonPriceInputTeste } from "@/components/AddonManagerTeste";

// Espelha o uso real: o form guarda a string e o salvamento faz
// parseFloat(form.price) || 0 (addItem/updateItem dos dois gerenciadores).
const Harness = ({ Input, initial = "0" }: { Input: typeof AddonPriceInput; initial?: string }) => {
  const [price, setPrice] = useState(initial);
  return (
    <div>
      <Input value={price} onChange={setPrice} />
      <output data-testid="payload">{parseFloat(price) || 0}</output>
    </div>
  );
};

const variants = [
  { name: "AddonManager (/admin)", Input: AddonPriceInput },
  { name: "AddonManagerTeste (/admin-teste)", Input: AddonPriceInputTeste },
];

describe.each(variants)("AddonPriceInput — $name", ({ Input }) => {
  it("criar: digitar 2,0,0 salva R$ 2,00 (e não R$ 0,02)", async () => {
    const user = userEvent.setup();
    render(<Harness Input={Input} />);
    const input = screen.getByPlaceholderText("0,00") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("2");
    // Sem remontagem: mesmo nó no DOM e foco mantido após a 1ª tecla.
    expect(screen.getByPlaceholderText("0,00")).toBe(input);
    expect(document.activeElement).toBe(input);
    await user.keyboard("00");
    expect(input.value).toBe("2,00");
    expect(screen.getByTestId("payload").textContent).toBe("2");
  });

  it("criar: digitar 0,5,0 salva R$ 0,50", async () => {
    const user = userEvent.setup();
    render(<Harness Input={Input} />);
    const input = screen.getByPlaceholderText("0,00") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("050");
    expect(input.value).toBe("0,50");
    expect(screen.getByTestId("payload").textContent).toBe("0.5");
  });

  it("criar: digitar 1,2,3,4 salva R$ 12,34", async () => {
    const user = userEvent.setup();
    render(<Harness Input={Input} />);
    const input = screen.getByPlaceholderText("0,00") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("1234");
    expect(input.value).toBe("12,34");
    expect(screen.getByTestId("payload").textContent).toBe("12.34");
  });

  it("editar: abrir item de R$ 2,00 mostra 2,00 e redigitar 3,5,0 salva R$ 3,50", async () => {
    const user = userEvent.setup();
    render(<Harness Input={Input} initial="2" />);
    const input = screen.getByPlaceholderText("0,00") as HTMLInputElement;
    expect(input.value).toBe("2,00");
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}");
    await user.keyboard("350");
    expect(input.value).toBe("3,50");
    expect(screen.getByTestId("payload").textContent).toBe("3.5");
  });

  it("limpar o campo volta para grátis (payload 0)", async () => {
    const user = userEvent.setup();
    render(<Harness Input={Input} initial="2" />);
    const input = screen.getByPlaceholderText("0,00") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}{Backspace}");
    expect(screen.getByTestId("payload").textContent).toBe("0");
  });
});
