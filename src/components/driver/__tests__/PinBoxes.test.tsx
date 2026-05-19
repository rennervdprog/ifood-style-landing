import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { PinBoxes } from "@/components/driver/PinBoxes";

function Harness({ initial = "" }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return (
    <div>
      <PinBoxes value={v} onChange={setV} />
      <div data-testid="current">{v}</div>
    </div>
  );
}

describe("<PinBoxes />", () => {
  it("renderiza 4 inputs por padrão", () => {
    render(<Harness />);
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
  });

  it("auto-avança ao digitar dígitos", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const inputs = screen.getAllByRole("textbox");
    await user.click(inputs[0]);
    await user.keyboard("1234");
    expect(screen.getByTestId("current").textContent).toBe("1234");
    expect(document.activeElement).toBe(inputs[3]);
  });

  it("ignora caracteres não-numéricos", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const inputs = screen.getAllByRole("textbox");
    await user.click(inputs[0]);
    await user.keyboard("a1b2c3");
    expect(screen.getByTestId("current").textContent).toBe("123");
  });

  it("Backspace em caixa vazia volta para a anterior", async () => {
    const user = userEvent.setup();
    render(<Harness initial="12" />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    inputs[2].focus();
    await user.keyboard("{Backspace}");
    expect(document.activeElement).toBe(inputs[1]);
  });

  it("setas navegam entre caixas", async () => {
    const user = userEvent.setup();
    render(<Harness initial="12" />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    inputs[0].focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(document.activeElement).toBe(inputs[2]);
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(inputs[1]);
  });

  it("paste preenche todas as caixas", async () => {
    const onChange = vi.fn();
    render(<PinBoxes value="" onChange={onChange} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    inputs[0].focus();
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true }) as any;
    pasteEvent.clipboardData = { getData: () => "9876" };
    inputs[0].dispatchEvent(pasteEvent);
    expect(onChange).toHaveBeenCalledWith("9876");
  });

  it("paste limita ao comprimento configurado", async () => {
    const onChange = vi.fn();
    render(<PinBoxes value="" onChange={onChange} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true }) as any;
    pasteEvent.clipboardData = { getData: () => "12345678" };
    inputs[0].dispatchEvent(pasteEvent);
    expect(onChange).toHaveBeenCalledWith("1234");
  });

  it("respeita prop length customizado", () => {
    render(<PinBoxes value="" onChange={() => {}} length={6} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });
});