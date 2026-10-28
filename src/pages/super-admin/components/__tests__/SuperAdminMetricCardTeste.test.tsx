import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Clock, AlertTriangle, TrendingUp } from "lucide-react";
import SuperAdminMetricCardTeste from "../SuperAdminMetricCardTeste";

describe("SuperAdminMetricCardTeste (Fase 3)", () => {
  it("mostra valor, rótulo e detalhe", () => {
    render(
      <SuperAdminMetricCardTeste
        icon={TrendingUp}
        label="Comissão"
        value="R$ 12,34"
        sublabel="Delivery R$ 10,00"
        sublabel2="PDV R$ 2,34"
      />,
    );
    expect(screen.getByText("R$ 12,34")).toBeTruthy();
    expect(screen.getByText("Comissão")).toBeTruthy();
    expect(screen.getByText("Delivery R$ 10,00")).toBeTruthy();
    expect(screen.getByText("PDV R$ 2,34")).toBeTruthy();
  });

  it("sem onClick não é clicável", () => {
    const { container } = render(
      <SuperAdminMetricCardTeste icon={Clock} label="Ativos" value="3" sublabel="em andamento" />,
    );
    expect(container.querySelector('[role="button"]')).toBeNull();
  });

  it("com onClick dispara o clique e o Enter", () => {
    const onClick = vi.fn();
    const { container } = render(
      <SuperAdminMetricCardTeste icon={AlertTriangle} label="Atraso" value="2" sublabel="mais de 60 min" alert onClick={onClick} />,
    );
    const el = container.querySelector('[role="button"]');
    expect(el).not.toBeNull();
    fireEvent.click(el!);
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(el!, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("alerta usa o tom de perigo no valor", () => {
    render(
      <SuperAdminMetricCardTeste icon={AlertTriangle} label="Atraso" value="2" sublabel="mais de 60 min" alert />,
    );
    const value = screen.getByText("2");
    expect(value.className).toContain("text-destructive");
  });
});
