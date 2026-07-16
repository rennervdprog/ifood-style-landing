import { useCallback, useEffect, useState } from "react";

export interface PdvOperator {
  id: string;
  name: string;
  loggedAt: number;
}

const key = (storeId?: string | null) => `pdv:operator:${storeId ?? "none"}`;

/**
 * Persistência simples do operador ativo no PDV (por loja).
 * Guardamos apenas id + nome + timestamp. O PIN nunca é armazenado.
 */
export function usePdvOperator(storeId?: string | null) {
  const [operator, setOperatorState] = useState<PdvOperator | null>(null);

  useEffect(() => {
    if (!storeId) { setOperatorState(null); return; }
    try {
      const raw = localStorage.getItem(key(storeId));
      setOperatorState(raw ? (JSON.parse(raw) as PdvOperator) : null);
    } catch { setOperatorState(null); }
  }, [storeId]);

  const setOperator = useCallback((op: PdvOperator | null) => {
    if (!storeId) return;
    if (op) localStorage.setItem(key(storeId), JSON.stringify(op));
    else localStorage.removeItem(key(storeId));
    setOperatorState(op);
  }, [storeId]);

  return { operator, setOperator };
}