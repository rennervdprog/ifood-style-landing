import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DriverOnlineToggle } from "../DriverOnlineToggle";

describe("DriverOnlineToggle", () => {
  it("mostra estado offline por padrão", () => {
    render(<DriverOnlineToggle isOnline={false} toggling={false} onToggle={() => {}} />);
    expect(screen.getByText("Você está Offline")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("mostra estado online", () => {
    render(<DriverOnlineToggle isOnline={true} toggling={false} onToggle={() => {}} />);
    expect(screen.getByText("Você está Online")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("chama onToggle ao clicar", async () => {
    const fn = vi.fn();
    render(<DriverOnlineToggle isOnline={false} toggling={false} onToggle={fn} />);
    await userEvent.click(screen.getByRole("button"));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("desabilita o botão quando toggling=true", async () => {
    const fn = vi.fn();
    render(<DriverOnlineToggle isOnline={false} toggling={true} onToggle={fn} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(fn).not.toHaveBeenCalled();
  });

  it("aria-label reflete a próxima ação", () => {
    const { rerender } = render(
      <DriverOnlineToggle isOnline={false} toggling={false} onToggle={() => {}} />
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Ficar online");
    rerender(<DriverOnlineToggle isOnline={true} toggling={false} onToggle={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Ficar offline");
  });
});
