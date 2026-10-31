import { describe, it, expect } from "vitest";
import { formatDocument, sanitizeDocument, validateDocument } from "@/lib/documentFormat";

describe("sanitizeDocument", () => {
  it("remove tudo que não for dígito", () => {
    expect(sanitizeDocument("123.456.789-01")).toBe("12345678901");
    expect(sanitizeDocument("12.345.678/0001-99")).toBe("12345678000199");
    expect(sanitizeDocument("abc")).toBe("");
  });
});

describe("validateDocument", () => {
  it("aceita CPF (11) e CNPJ (14)", () => {
    expect(validateDocument("123.456.789-01")).toBe(true);
    expect(validateDocument("12.345.678/0001-99")).toBe(true);
  });
  it("rejeita tamanhos inválidos", () => {
    expect(validateDocument("")).toBe(false);
    expect(validateDocument("123")).toBe(false);
    expect(validateDocument("1".repeat(20))).toBe(false);
  });
});

// Correção "máscara de CNPJ" (2026-10-31): o ramo CNPJ de formatDocument
// usava .replace() sem $1/$2 e ENGOLIA os dígitos — digitar um CNPJ
// colapsava o campo para "./-" no 12º dígito e terminava com 2 dígitos
// ("84"), e colar virava "./-84". CPF sempre funcionou. As trilhas
// abaixo simulam o formulário de verdade: a cada tecla, o campo recebe
// (valor exibido + tecla) e reaplica a máscara, como faz o onChange de
// CadastroLojista/PerfilPage.
function typeTrail(digits: string): string[] {
  const trail: string[] = [];
  let current = "";
  for (const ch of digits) {
    current = formatDocument(current + ch);
    trail.push(current);
  }
  return trail;
}

const CNPJ_CANTINHO = "47351413000184"; // 47.351.413/0001-84
const CNPJ_TESTE = "11222333000181"; // 11.222.333/0001-81
const CPF_VALIDO = "52998224725"; // 529.982.247-25

describe("formatDocument — digitação (trilha tecla a tecla)", () => {
  it("CNPJ da Cantinho: máscara progressiva sem perder nenhum dígito", () => {
    expect(typeTrail(CNPJ_CANTINHO)).toEqual([
      "4", "47", "473", "473.5", "473.51", "473.514", "473.514.1",
      "473.514.13", "473.514.130", "473.514.130-0", "473.514.130-00",
      "47.351.413/0001", "47.351.413/0001-8", "47.351.413/0001-84",
    ]);
  });

  it("CNPJ de teste 11.222.333/0001-81: idem", () => {
    expect(typeTrail(CNPJ_TESTE)).toEqual([
      "1", "11", "112", "112.2", "112.22", "112.223", "112.223.3",
      "112.223.33", "112.223.330", "112.223.330-0", "112.223.330-00",
      "11.222.333/0001", "11.222.333/0001-8", "11.222.333/0001-81",
    ]);
  });

  it("CPF: trilha intacta, como sempre foi", () => {
    expect(typeTrail(CPF_VALIDO)).toEqual([
      "5", "52", "529", "529.9", "529.98", "529.982", "529.982.2",
      "529.982.24", "529.982.247", "529.982.247-2", "529.982.247-25",
    ]);
  });

  it("nenhum prefixo perde dígitos ao reaplicar a máscara", () => {
    for (const digits of [CNPJ_CANTINHO, CNPJ_TESTE, CPF_VALIDO]) {
      for (let i = 1; i <= digits.length; i++) {
        const prefix = digits.slice(0, i);
        expect(sanitizeDocument(formatDocument(prefix))).toBe(prefix);
      }
    }
  });
});

describe("formatDocument — colar", () => {
  it("colar CNPJ formatado mantém a máscara completa", () => {
    expect(formatDocument("47.351.413/0001-84")).toBe("47.351.413/0001-84");
    expect(formatDocument("11.222.333/0001-81")).toBe("11.222.333/0001-81");
  });

  it("colar CNPJ só com dígitos aplica a máscara completa", () => {
    expect(formatDocument(CNPJ_CANTINHO)).toBe("47.351.413/0001-84");
    expect(formatDocument(CNPJ_TESTE)).toBe("11.222.333/0001-81");
  });

  it("colar CPF formatado ou cru segue intacto", () => {
    expect(formatDocument("529.982.247-25")).toBe("529.982.247-25");
    expect(formatDocument(CPF_VALIDO)).toBe("529.982.247-25");
  });
});

describe("formatDocument — ida e volta (sanitize ∘ format = identidade)", () => {
  it("CPF e CNPJs sobrevivem à ida e volta", () => {
    for (const digits of [CPF_VALIDO, CNPJ_CANTINHO, CNPJ_TESTE]) {
      expect(sanitizeDocument(formatDocument(digits))).toBe(digits);
      expect(validateDocument(formatDocument(digits))).toBe(true);
    }
  });

  it("formatar um valor já mascarado é idempotente (exibição no Perfil)", () => {
    expect(formatDocument("47.351.413/0001-84")).toBe("47.351.413/0001-84");
    expect(formatDocument("529.982.247-25")).toBe("529.982.247-25");
  });
});