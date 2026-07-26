/**
 * Native back button handler registry (LIFO).
 * Modals/sheets register a handler; the top of the stack consumes the
 * Android back press first. If it returns true the event is handled and
 * nav-stack logic is skipped.
 */

type BackFn = () => boolean | void;

const stack: BackFn[] = [];

export function pushBackHandler(fn: BackFn) {
  stack.push(fn);
  return () => {
    const i = stack.lastIndexOf(fn);
    if (i >= 0) stack.splice(i, 1);
  };
}

export function runTopBackHandler(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    try {
      const handled = stack[i]();
      if (handled) return true;
    } catch (e) {
      console.warn("[backHandler] error", e);
    }
  }
  return false;
}

/** React hook: register a back handler while `enabled` is true. */
import { useEffect } from "react";
export function useBackHandler(fn: BackFn, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    return pushBackHandler(fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fn]);
}