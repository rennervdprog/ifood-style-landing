/**
 * Lookup de CEP unificado (ViaCEP → BrasilAPI), com cache persistente.
 */
import { cacheGet, cacheSet, TTL } from "./cache";

export interface CepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export const formatCep = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchCep(cep: string): Promise<CepResult | null> {
  const digits = (cep || "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const key = `loc:cep:${digits}`;
  const cached = cacheGet<CepResult | null>(key, { persist: true });
  if (cached !== null) return cached;

  // ViaCEP
  try {
    const res = await withTimeout(
      fetch(`https://viacep.com.br/ws/${digits}/json/`),
      5000,
    );
    if (res.ok) {
      const data = (await res.json()) as CepResult & { erro?: boolean };
      if (!data.erro) {
        cacheSet(key, data, TTL.cep, { persist: true });
        return data;
      }
    }
  } catch {
    /* fallback */
  }

  // BrasilAPI
  try {
    const res = await withTimeout(
      fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`),
      5000,
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.cep) {
        const result: CepResult = {
          cep: data.cep,
          logradouro: data.street || "",
          complemento: "",
          bairro: data.neighborhood || "",
          localidade: data.city || "",
          uf: data.state || "",
        };
        cacheSet(key, result, TTL.cep, { persist: true });
        return result;
      }
    }
  } catch {
    /* both failed */
  }

  cacheSet(key, null, 60 * 60 * 1000, { persist: true });
  return null;
}
