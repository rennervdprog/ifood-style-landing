export interface CepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export const formatCep = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

// Cache em memória — evita múltiplas chamadas ao mesmo CEP durante a sessão
const cepCache = new Map<string, CepResult | null>();

/**
 * Busca dados de um CEP com:
 * - Cache em memória (evita chamadas duplicadas)
 * - Fallback automático: ViaCEP → BrasilAPI
 * - Timeout de 5s por tentativa
 */
export const fetchCep = async (cep: string): Promise<CepResult | null> => {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  if (cepCache.has(digits)) return cepCache.get(digits) ?? null;

  // Tentativa 1: ViaCEP
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      const data: CepResult = await res.json();
      if (!data.erro) { cepCache.set(digits, data); return data; }
    }
  } catch { /* fallback */ }

  // Tentativa 2: BrasilAPI
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`, { signal: ctrl.signal });
    clearTimeout(t);
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
        cepCache.set(digits, result);
        return result;
      }
    }
  } catch { /* ambas falharam */ }

  cepCache.set(digits, null);
  return null;
};

export const clearCepCache = () => cepCache.clear();
