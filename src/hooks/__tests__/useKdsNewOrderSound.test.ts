import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKdsNewOrderSound } from "../useKdsNewOrderSound";

// Item 4 do plano do KDS (17/11/2026): sino de pedido novo nas telas do
// KDS. O som só toca após o gesto de ativar (portão de autoplay); a
// primeira lista é marcada como vista sem tocar; só id novo apita.

let playMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  playMock = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(playMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useKdsNewOrderSound", () => {
  it("não toca na primeira lista recebida", () => {
    renderHook(() => useKdsNewOrderSound(["a", "b"]));
    expect(playMock).not.toHaveBeenCalled();
  });

  it("ativar toca o sino uma vez e marca o som como ativado", async () => {
    const { result } = renderHook(() => useKdsNewOrderSound(["a"]));
    expect(result.current.soundEnabled).toBe(false);
    await act(async () => {
      result.current.activateSound();
    });
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(result.current.soundEnabled).toBe(true);
    expect(result.current.soundBlocked).toBe(false);
  });

  it("toca quando um id novo aparece após ativar", async () => {
    const { result, rerender } = renderHook(({ ids }) => useKdsNewOrderSound(ids), {
      initialProps: { ids: ["a"] as string[] },
    });
    await act(async () => {
      result.current.activateSound();
    });
    expect(playMock).toHaveBeenCalledTimes(1);
    rerender({ ids: ["a", "b"] });
    expect(playMock).toHaveBeenCalledTimes(2);
  });

  it("não toca quando a lista atualiza sem id novo (polling)", async () => {
    const { result, rerender } = renderHook(({ ids }) => useKdsNewOrderSound(ids), {
      initialProps: { ids: ["a"] as string[] },
    });
    await act(async () => {
      result.current.activateSound();
    });
    // Nova identidade de array, mesmos ids — é o que o polling faz.
    rerender({ ids: ["a"] });
    rerender({ ids: ["a"] });
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  it("não toca quando um pedido sai da lista", async () => {
    const { result, rerender } = renderHook(({ ids }) => useKdsNewOrderSound(ids), {
      initialProps: { ids: ["a", "b"] as string[] },
    });
    await act(async () => {
      result.current.activateSound();
    });
    rerender({ ids: ["a"] });
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  it("não toca pedido novo quando mutado, e volta a tocar ao desmutar", async () => {
    const { result, rerender } = renderHook(({ ids }) => useKdsNewOrderSound(ids), {
      initialProps: { ids: ["a"] as string[] },
    });
    await act(async () => {
      result.current.activateSound();
    });
    act(() => {
      result.current.toggleMuted();
    });
    expect(result.current.soundMuted).toBe(true);
    rerender({ ids: ["a", "b"] });
    expect(playMock).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.toggleMuted();
    });
    rerender({ ids: ["a", "b", "c"] });
    expect(playMock).toHaveBeenCalledTimes(2);
  });

  it("não toca pedido novo sem o gesto de ativar", () => {
    const { rerender } = renderHook(({ ids }) => useKdsNewOrderSound(ids), {
      initialProps: { ids: ["a"] as string[] },
    });
    rerender({ ids: ["a", "b"] });
    expect(playMock).not.toHaveBeenCalled();
  });

  it("play bloqueado na ativação marca bloqueado e não ativa", async () => {
    playMock.mockRejectedValueOnce(new Error("NotAllowedError"));
    const { result } = renderHook(() => useKdsNewOrderSound(["a"]));
    await act(async () => {
      result.current.activateSound();
    });
    expect(result.current.soundEnabled).toBe(false);
    expect(result.current.soundBlocked).toBe(true);
  });

  it("play bloqueado após ativar volta a exigir o gesto", async () => {
    const { result, rerender } = renderHook(({ ids }) => useKdsNewOrderSound(ids), {
      initialProps: { ids: ["a"] as string[] },
    });
    await act(async () => {
      result.current.activateSound();
    });
    expect(result.current.soundEnabled).toBe(true);
    playMock.mockRejectedValueOnce(new Error("NotAllowedError"));
    rerender({ ids: ["a", "b"] });
    // A rejeição resolve de forma assíncrona.
    await act(async () => {});
    expect(result.current.soundEnabled).toBe(false);
    expect(result.current.soundBlocked).toBe(true);
  });
});
