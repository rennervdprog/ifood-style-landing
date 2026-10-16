import { useCallback, useEffect, useState } from "react";

export interface PdvOperator {
  id: string;
  name: string;
  loggedAt: number;
}

const key = (storeId?: string | null) => `pdv:operator:${storeId ?? "none"}`;

/**
 * Sessão do operador expira após 8 horas (Fase 3).
 * Ao expirar, o próximo acesso exige novo login com PIN.
 */
export const PDV_OPERATOR_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * Persistência simples do operador ativo no PDV (por loja).
 * Guardamos apenas id + nome + timestamp. O PIN nunca é armazenado.
 * A sessão expira após 8h ou quando o caixa é fechado (PdvPage limpa
 * o operador em handleFecharCaixa).
 */
export function usePdvOperator(storeId?: string | null) {
  const [operator, setOperatorState] = useState<PdvOperator | null>(null);

  useEffect(() => {
    if (!storeId) { setOperatorState(null); return; }
    try {
      const raw = localStorage.getItem(key(storeId));
      if (!raw) { setOperatorState(null); return; }
      const op = JSON.parse(raw) as PdvOperator;
      // Fase 3: expira a sessão após 8 horas do login.
      if (!op.loggedAt || Date.now() - op.loggedAt > PDV_OPERATOR_SESSION_TTL_MS) {
        localStorage.removeItem(key(storeId));
        setOperatorState(null);
        return;
      }
      setOperatorState(op);
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
