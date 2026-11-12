import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  stashPendingReceipt,
  flushPendingReceipt,
  hasPendingReceipt,
} from "../pendingReceipt";
import { hasSilentPrintBridge } from "@/lib/thermalPrint";

// P9 (2026-11-12) — o flush do cupom adiado NÃO pode disparar
// window.print() automaticamente no navegador: o preview modal
// sequestra os cliques da tela seguinte ao "Nova venda" (4 repros ao
// vivo; experimento liga/desliga fechou a causa). No navegador o flush
// mostra o toast "Cupom pronto — clique para imprimir" (mesmo texto,
// CTA e duração do ramo manual do checkout) e o cupom só sai pelo
// gesto do operador. No app Windows (Electron), onde o preload expõe
// window.itasuperPainel.requestSilentPrint, o flush mantém a
// impressão automática — lá window.print() não abre modal.

const mocks = vi.hoisted(() => ({
  printPdvReceipt: vi.fn(),
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("@/lib/thermalPrint", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/thermalPrint")>();
  return { ...mod, printPdvReceipt: mocks.printPdvReceipt };
});

vi.mock("sonner", () => ({ toast: mocks.toast }));

const JOB = {
  order: { id: "order-1", created_at: "2026-11-12T00:00:00Z" },
  storeName: "Loja Demo",
  options: { copies: 2, paperWidth: 80 },
} as any;

const setBridge = (value: unknown) => {
  (window as any).itasuperPainel = value;
};

const clearBridge = () => {
  delete (window as any).itasuperPainel;
};

const toastAction = () => {
  const call = mocks.toast.mock.calls[0];
  expect(call).toBeDefined();
  return (call[1] as any).action as { label: string; onClick: () => void };
};

beforeEach(() => {
  sessionStorage.clear();
  clearBridge();
  mocks.printPdvReceipt.mockClear();
  mocks.toast.mockClear();
});

afterEach(() => {
  clearBridge();
  sessionStorage.clear();
});

describe("flushPendingReceipt — navegador (sem a ponte do Electron)", () => {
  it("sem job pendente: retorna false e não imprime nem mostra toast", () => {
    expect(flushPendingReceipt()).toBe(false);
    expect(mocks.printPdvReceipt).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("com job: NÃO imprime — mostra o toast 'Cupom pronto' com CTA e consome o job", () => {
    stashPendingReceipt(JOB);
    expect(hasPendingReceipt()).toBe(true);

    expect(flushPendingReceipt()).toBe(true);

    expect(mocks.printPdvReceipt).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith(
      "Cupom pronto — clique para imprimir",
      expect.objectContaining({
        duration: 8000,
        action: expect.objectContaining({ label: "Imprimir" }),
      })
    );
    expect(hasPendingReceipt()).toBe(false);
  });

  it("o CTA Imprimir do toast chama o caminho de impressão existente com o job guardado", () => {
    stashPendingReceipt(JOB);
    flushPendingReceipt();

    toastAction().onClick();

    expect(mocks.printPdvReceipt).toHaveBeenCalledTimes(1);
    expect(mocks.printPdvReceipt).toHaveBeenCalledWith(JOB.order, JOB.storeName, JOB.options);
  });

  it("segundo flush não reexibe o toast: o job é consumido uma única vez", () => {
    stashPendingReceipt(JOB);
    expect(flushPendingReceipt()).toBe(true);
    expect(flushPendingReceipt()).toBe(false);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it("job corrompido: retorna false sem lançar e sem imprimir", () => {
    sessionStorage.setItem("pdv_pending_receipt_v1", "{json inválido");
    expect(flushPendingReceipt()).toBe(false);
    expect(mocks.printPdvReceipt).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});

describe("flushPendingReceipt — app Windows (Electron, com a ponte)", () => {
  it("com job: imprime automaticamente e NÃO mostra o toast", () => {
    setBridge({ requestSilentPrint: vi.fn() });
    stashPendingReceipt(JOB);

    expect(flushPendingReceipt()).toBe(true);

    expect(mocks.printPdvReceipt).toHaveBeenCalledTimes(1);
    expect(mocks.printPdvReceipt).toHaveBeenCalledWith(JOB.order, JOB.storeName, JOB.options);
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(hasPendingReceipt()).toBe(false);
  });
});

describe("hasSilentPrintBridge — detecção da ponte do preload", () => {
  it("sem window.itasuperPainel: false", () => {
    expect(hasSilentPrintBridge()).toBe(false);
  });

  it("ponte com requestSilentPrint função: true", () => {
    setBridge({ requestSilentPrint: () => {} });
    expect(hasSilentPrintBridge()).toBe(true);
  });

  it("ponte sem função (objeto vazio ou valor não-função): false — cai no ramo do navegador", () => {
    setBridge({});
    expect(hasSilentPrintBridge()).toBe(false);
    setBridge({ requestSilentPrint: "sim" });
    expect(hasSilentPrintBridge()).toBe(false);
    setBridge(null);
    expect(hasSilentPrintBridge()).toBe(false);
  });
});
