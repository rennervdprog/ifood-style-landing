// Helpers para formatar/sanitizar chaves PIX conforme exigido pelo Asaas.
export type PixType = "cpf" | "cnpj" | "email" | "phone" | "random" | string;

export function formatPixKeyDisplay(value: string, type: PixType): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  switch ((type || "").toLowerCase()) {
    case "cpf": {
      const d = raw.replace(/\D/g, "").slice(0, 11);
      return d
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
    }
    case "cnpj": {
      const d = raw.replace(/\D/g, "").slice(0, 14);
      return d
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    case "phone": {
      const d = raw.replace(/\D/g, "").slice(-11); // pega últimos 11
      if (d.length <= 2) return `(${d}`;
      if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
    }
    case "email":
      return raw.toLowerCase();
    default:
      return raw;
  }
}

// Versão "limpa" para salvar no banco e enviar ao Asaas.
export function sanitizePixKeyForAsaas(value: string, type: PixType): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  switch ((type || "").toLowerCase()) {
    case "cpf":
    case "cnpj":
      return raw.replace(/\D/g, "");
    case "phone": {
      const digits = raw.replace(/\D/g, "");
      if (digits.length === 11) return `+55${digits}`;
      if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
      if (raw.startsWith("+")) return raw;
      return `+${digits}`;
    }
    case "email":
      return raw.toLowerCase();
    default:
      return raw; // random / EVP
  }
}

export function validatePixKey(value: string, type: PixType): string | null {
  const clean = sanitizePixKeyForAsaas(value, type);
  if (!clean) return "Chave PIX obrigatória";
  switch ((type || "").toLowerCase()) {
    case "cpf":
      if (clean.length !== 11) return "CPF deve ter 11 dígitos";
      return null;
    case "cnpj":
      if (clean.length !== 14) return "CNPJ deve ter 14 dígitos";
      return null;
    case "phone":
      if (!/^\+\d{12,13}$/.test(clean)) return "Telefone inválido (ex: (14) 99162-4997)";
      return null;
    case "email":
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return "E-mail inválido";
      return null;
    case "random":
      if (clean.length < 20) return "Chave aleatória parece inválida";
      return null;
    default:
      return null;
  }
}

export const PIX_PLACEHOLDERS: Record<string, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  email: "voce@email.com",
  phone: "(14) 99999-9999",
  random: "Cole sua chave aleatória",
};
