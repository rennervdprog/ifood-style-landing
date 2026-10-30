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

/** Evento disparado quando o operador muda — sincroniza as instâncias do hook. */
const OPERATOR_CHANGED_EVENT = "pdv-operator-changed";

function readStoredOperator(storeId?: string | null): PdvOperator | null {
  if (!storeId) return null;
  try {
    const raw = localStorage.getItem(key(storeId));
    if (!raw) return null;
    const op = JSON.parse(raw) as PdvOperator;
    // Fase 3: expira a sessão após 8 horas do login.
    if (!op.loggedAt || Date.now() - op.loggedAt > PDV_OPERATOR_SESSION_TTL_MS) {
      localStorage.removeItem(key(storeId));
      return null;
    }
    return op;
  } catch { return null; }
}

/**
 * Persistência simples do operador ativo no PDV (por loja).
 * Guardamos apenas id + nome + timestamp. O PIN nunca é armazenado.
 * A sessão expira após 8h ou quando o caixa é fechado (PdvPage limpa
 * o operador em handleFecharCaixa).
 *
 * Cada tela usa sua própria instância deste hook (abertura, página do
 * caixa, etc.). Para o login feito numa tela aparecer nas outras SEM
 * recarregar a página, setOperator avisa as demais instâncias com um
 * evento — antes, a página principal só lia o operador na montagem e o
 * topo continuava mostrando o nome da conta mesmo após o login com PIN.
 */
export function usePdvOperator(storeId?: string | null) {
  const [operator, setOperatorState] = useState<PdvOperator | null>(null);

  useEffect(() => {
    if (!storeId) { setOperatorState(null); return; }
    const reread = () => setOperatorState(readStoredOperator(storeId));
    reread();
    window.addEventListener(OPERATOR_CHANGED_EVENT, reread);
    window.addEventListener("storage", reread);
    return () => {
      window.removeEventListener(OPERATOR_CHANGED_EVENT, reread);
      window.removeEventListener("storage", reread);
    };
  }, [storeId]);

  const setOperator = useCallback((op: PdvOperator | null) => {
    if (!storeId) return;
    if (op) localStorage.setItem(key(storeId), JSON.stringify(op));
    else localStorage.removeItem(key(storeId));
    setOperatorState(op);
    // Avisa as outras instâncias do hook (outras telas/componentes).
    try { window.dispatchEvent(new Event(OPERATOR_CHANGED_EVENT)); } catch {}
  }, [storeId]);

  return { operator, setOperator };
}
