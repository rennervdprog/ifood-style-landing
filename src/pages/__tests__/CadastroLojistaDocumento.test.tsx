import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CadastroLojista from "../CadastroLojista";
import { sanitizeDocument, validateDocument } from "@/lib/documentFormat";

// Correção "máscara de CNPJ" (2026-10-31) — prova no COMPONENTE REAL.
// O gesto que falhou na reunião da Cantinho: digitar/colar um CNPJ no
// campo "CPF ou CNPJ" da etapa 3 do cadastro. Antes da correção, a
// máscara formatDocument engolia os dígitos do CNPJ (12º dígito
// colapsava o campo para "./-"; final "84") e o cadastro travava com
// "CPF ou CNPJ inválido" — só CPF passava. Aqui a página real é
// renderizada, o funil é percorrido até a etapa 3 e o campo real é
// exercitado tecla a tecla e por colagem, afirmando o valor VISÍVEL
// a cada passo e a validação do documento (a mesma do schema zod).

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    },
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ error: null })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}));

vi.mock("@/lib/location", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/location")>();
  return {
    ...actual,
    fetchCep: vi.fn(async () => ({
      logradouro: "Rua das Flores",
      bairro: "Centro",
      localidade: "Araruama",
      uf: "RJ",
    })),
  };
});

vi.mock("@/lib/pageView", () => ({ trackPageView: vi.fn() }));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const CNPJ_CANTINHO_DIGITS = "47351413000184";
const CNPJ_CANTINHO_TRAIL = [
  "4", "47", "473", "473.5", "473.51", "473.514", "473.514.1",
  "473.514.13", "473.514.130", "473.514.130-0", "473.514.130-00",
  "47.351.413/0001", "47.351.413/0001-8", "47.351.413/0001-84",
];
const CPF_DIGITS = "52998224725";
const CPF_TRAIL = [
  "5", "52", "529", "529.9", "529.98", "529.982", "529.982.2",
  "529.982.24", "529.982.247", "529.982.247-2", "529.982.247-25",
];

/** Percorre o funil real (plano → conta → loja) e devolve o campo de documento da etapa 3. */
async function gotoDocumentField(user: ReturnType<typeof userEvent.setup>) {
  render(
    <MemoryRouter>
      <CadastroLojista />
    </MemoryRouter>,
  );

  // Etapa 0 — plano Essencial (dinâmico: exige o aceite das condições
  // p/ habilitar o "Próximo" — disabled enquanto não aceito)
  await user.click(screen.getByRole("button", { name: /Plano Essencial/ }));
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: /Próximo/ }));

  // Etapa 1 — conta
  await user.type(screen.getByPlaceholderText("Seu e-mail"), "loja.teste@example.com");
  await user.type(screen.getByPlaceholderText("Confirme seu e-mail"), "loja.teste@example.com");
  await user.type(screen.getByPlaceholderText(/Sua senha/), "senha123");
  await user.click(screen.getByRole("button", { name: /Próximo/ }));

  // Etapa 2 — loja + endereço (CEP com lookup mockado)
  await user.type(screen.getByPlaceholderText("Nome da Loja"), "Loja Teste CNPJ");
  const categorySelect = document.querySelector("select");
  expect(categorySelect).not.toBeNull();
  await user.selectOptions(categorySelect as HTMLSelectElement, "restaurante");
  await user.type(screen.getByPlaceholderText(/CEP/), "28970000");
  await screen.findByDisplayValue("Rua das Flores");
  await screen.findByDisplayValue("Centro");
  await user.type(screen.getByPlaceholderText("Nº *"), "150");
  await user.click(screen.getByRole("button", { name: /Próximo/ }));

  // Etapa 3 — dados pessoais: o campo real do documento
  return screen.getByPlaceholderText("CPF ou CNPJ") as HTMLInputElement;
}

describe("CadastroLojista — campo CPF ou CNPJ (página real)", () => {
  it("digitar o CNPJ da Cantinho tecla a tecla: máscara visível correta a cada tecla e validação passa", async () => {
    const user = userEvent.setup();
    const input = await gotoDocumentField(user);

    await user.click(input);
    for (let i = 0; i < CNPJ_CANTINHO_DIGITS.length; i++) {
      await user.keyboard(CNPJ_CANTINHO_DIGITS[i]);
      expect(input.value).toBe(CNPJ_CANTINHO_TRAIL[i]);
    }
    expect(sanitizeDocument(input.value)).toBe(CNPJ_CANTINHO_DIGITS);
    expect(validateDocument(input.value)).toBe(true);
  }, 30000);

  it("colar o CNPJ formatado 11.222.333/0001-81: máscara completa e validação passa", async () => {
    const user = userEvent.setup();
    const input = await gotoDocumentField(user);

    await user.click(input);
    await user.paste("11.222.333/0001-81");
    expect(input.value).toBe("11.222.333/0001-81");
    expect(sanitizeDocument(input.value)).toBe("11222333000181");
    expect(validateDocument(input.value)).toBe(true);
  }, 30000);

  it("colar o CNPJ só com dígitos: máscara completa e validação passa", async () => {
    const user = userEvent.setup();
    const input = await gotoDocumentField(user);

    await user.click(input);
    await user.paste(CNPJ_CANTINHO_DIGITS);
    expect(input.value).toBe("47.351.413/0001-84");
    expect(sanitizeDocument(input.value)).toBe(CNPJ_CANTINHO_DIGITS);
    expect(validateDocument(input.value)).toBe(true);
  }, 30000);

  it("digitar CPF: trilha visível intacta e validação passa", async () => {
    const user = userEvent.setup();
    const input = await gotoDocumentField(user);

    await user.click(input);
    for (let i = 0; i < CPF_DIGITS.length; i++) {
      await user.keyboard(CPF_DIGITS[i]);
      expect(input.value).toBe(CPF_TRAIL[i]);
    }
    expect(sanitizeDocument(input.value)).toBe(CPF_DIGITS);
    expect(validateDocument(input.value)).toBe(true);
  }, 30000);
});
