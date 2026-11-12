import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  stashPendingReceipt,
  flushPendingReceipt,
  hasPendingReceipt,
} from "../pendingReceipt";
import { hasSilentPrintBridge } from "@/lib/thermalPrint";

// P9 (2026-11-12) — o flush do cupom adiado NÃO pode disparar
// window.print() automaticamente no navegador quando a configuração
// está desligada: o preview modal sequestra os cliques da tela
// seguinte ao "Nova venda" (4 repros ao vivo; experimento
// liga/desliga fechou a causa). Follow-up P9 (palavra do Renner):
// a configuração da loja volta a mandar, carregada no job
// (`autoPrint`, do `settings.auto_print_pdv`): no navegador, com a
// configuração LIGADA, o flush imprime automaticamente (o preview
// modal é esperado — opção do lojista, que o dispensa); com a
// configuração DESLIGADA, mostra o toast "Cupom pronto — clique
// para imprimir" (mesmo texto, CTA e duração do ramo manual do
// checkout) e o cupom só sai pelo gesto do operador. Jobs legados
// sem a flag (build anterior) caem no toast — o ramo seguro. No
// app Windows (Electron), onde o preload expõe
// window.itasuperPainel.requestSilentPrint, o flush mantém a
// impressão automática em qualquer dos casos — lá window.print()
// não abre modal.

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

const JOB_BASE = {
  order: { id: "order-1", created_at: "2026-11-12T00:00:00Z" },
  storeName: "Loja Demo",
  options: { copies: 2, paperWidth: 80 },
} as any;

// Configuração ligada: o lojista escolheu a automática.
const JOB_AUTO = { ...JOB_BASE, autoPrint: true };
// Configuração desligada: manual, via toast.
const JOB_MANUAL = { ...JOB_BASE, autoPrint: false };
// Job legado (build anterior à flag): sem `autoPrint` — cai no toast.
const JOB_LEGACY = { ...JOB_BASE };

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

  it("configuração LIGADA (autoPrint: true): imprime automaticamente, sem toast", () => {
    stashPendingReceipt(JOB_AUTO);
    expect(hasPendingReceipt()).toBe(true);

    expect(flushPendingReceipt()).toBe(true);

    expect(mocks.printPdvReceipt).toHaveBeenCalledTimes(1);
    expect(mocks.printPdvReceipt).toHaveBeenCalledWith(JOB_AUTO.order, JOB_AUTO.storeName, JOB_AUTO.options);
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(hasPendingReceipt()).toBe(false);
  });

  it("configuração DESLIGADA (autoPrint: false): NÃO imprime — mostra o toast 'Cupom pronto' com CTA e consome o job", () => {
    stashPendingReceipt(JOB_MANUAL);
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

  it("job legado sem a flag: cai no ramo seguro — toast, sem imprimir", () => {
    stashPendingReceipt(JOB_LEGACY);

    expect(flushPendingReceipt()).toBe(true);

    expect(mocks.printPdvReceipt).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith(
      "Cupom pronto — clique para imprimir",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Imprimir" }),
      })
    );
    expect(hasPendingReceipt()).toBe(false);
  });

  it("o CTA Imprimir do toast chama o caminho de impressão existente com o job guardado", () => {
    stashPendingReceipt(JOB_MANUAL);
    flushPendingReceipt();

    toastAction().onClick();

    expect(mocks.printPdvReceipt).toHaveBeenCalledTimes(1);
    expect(mocks.printPdvReceipt).toHaveBeenCalledWith(JOB_MANUAL.order, JOB_MANUAL.storeName, JOB_MANUAL.options);
  });

  it("segundo flush não reexibe o toast: o job é consumido uma única vez", () => {
    stashPendingReceipt(JOB_MANUAL);
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
  it("configuração LIGADA: imprime automaticamente e NÃO mostra o toast", () => {
    setBridge({ requestSilentPrint: vi.fn() });
    stashPendingReceipt(JOB_AUTO);

    expect(flushPendingReceipt()).toBe(true);

    expect(mocks.printPdvReceipt).toHaveBeenCalledTimes(1);
    expect(mocks.printPdvReceipt).toHaveBeenCalledWith(JOB_AUTO.order, JOB_AUTO.storeName, JOB_AUTO.options);
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(hasPendingReceipt()).toBe(false);
  });

  it("configuração DESLIGADA: a ponte silenciosa imprime automaticamente do mesmo jeito, sem toast", () => {
    setBridge({ requestSilentPrint: vi.fn() });
    stashPendingReceipt(JOB_MANUAL);

    expect(flushPendingReceipt()).toBe(true);

    expect(mocks.printPdvReceipt).toHaveBeenCalledTimes(1);
    expect(mocks.printPdvReceipt).toHaveBeenCalledWith(JOB_MANUAL.order, JOB_MANUAL.storeName, JOB_MANUAL.options);
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
