import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "fs";
import { join } from "path";
import PdvUpsellScreen from "../PdvUpsellScreen";
import { toast } from "sonner";

// Correção "ativação do PDV retorna 'edge function'" (2026-10-31):
// a função manage-store-addon está deployada e saudável — o que
// quebrou a experiência foi a tela engolir o motivo real do erro.
// O supabase-js devolve "Edge Function returned a non-2xx status code"
// para QUALQUER não-2xx (401 sessão inválida, 403 sem permissão,
// 404, 500) e os chamadores faziam `if (error) throw error` antes de
// ler o corpo — o lojista via sempre a mesma frase em inglês.
// Prova no componente real: com a função respondendo 403
// { error: "Sem permissão." }, o toast mostra "Sem permissão.".

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function httpError(body: unknown) {
  return Object.assign(new Error("Edge Function returned a non-2xx status code"), {
    name: "FunctionsHttpError",
    context: {
      clone: () => ({ json: async () => body }),
    },
  });
}

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PdvUpsellScreen storeId="store-1" monthlyPrice={49} onBack={() => {}} />
    </QueryClientProvider>,
  );
}

describe("PdvUpsellScreen — ativação do PDV", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("403 da função → toast mostra o motivo real, não o genérico", async () => {
    invokeMock.mockResolvedValue({ data: null, error: httpError({ error: "Sem permissão." }) });
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: /ativar pdv agora/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sem permissão."));
    expect(toast.error).not.toHaveBeenCalledWith(
      expect.stringContaining("Edge Function"),
    );
  });

  it("401 da função → toast mostra 'Sessão inválida.'", async () => {
    invokeMock.mockResolvedValue({ data: null, error: httpError({ error: "Sessão inválida." }) });
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: /ativar pdv agora/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sessão inválida."));
  });

  it("sucesso → toast de ativado e nenhum erro", async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, action: "activate" }, error: null });
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: /ativar pdv agora/i }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("PDV ativado!"),
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("os outros chamadores da manage-store-addon usam o mesmo extrator (fidelidade)", () => {
    const root = join(__dirname, "..", "..", "..", "..");
    for (const rel of [
      "src/components/StoreAddonsPanel.tsx",
      "src/components/admin/AdminStoreAddonsPanel.tsx",
      "src/pages/pdv/components/PdvMigratePlanCard.tsx",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src, rel).toContain("getFunctionErrorMessage");
    }
  });
});
