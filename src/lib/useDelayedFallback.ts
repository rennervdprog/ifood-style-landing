import { useEffect, useState } from "react";

/**
 * Retorna `true` só depois de `delayMs` montado.
 * Usado para evitar spinners que piscam quando o Suspense resolve em <150ms.
 */
export function useDelayedFallback(delayMs = 150): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return show;
}