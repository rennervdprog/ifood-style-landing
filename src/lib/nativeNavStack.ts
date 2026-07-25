/**
 * App-owned navigation stack for the native shell.
 *
 * The browser's window.history is unreliable inside Capacitor (deep-links,
 * OTA reloads, replace navs, modal query params). We keep our own linear
 * stack of paths so the Android back button always pops the last real
 * navigation the user made.
 */

import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const stack: string[] = [];

function currentPath(loc: { pathname: string; search: string }) {
  return (loc.pathname || "/") + (loc.search || "");
}

/** Read-only snapshot of the stack (for debug). */
export function getNavStack() {
  return stack.slice();
}

export function stackSize() {
  return stack.length;
}

/** Pop the top and return the previous path (or null if only home is left). */
export function popNavStack(): string | null {
  if (stack.length <= 1) return null;
  stack.pop();
  return stack[stack.length - 1] ?? null;
}

/** Reset the stack, used on hard resets or logout. */
export function resetNavStack(initial?: string) {
  stack.length = 0;
  if (initial) stack.push(initial);
}

/**
 * Mount once at the app root. Mirrors router transitions into our stack:
 *  - PUSH  → push
 *  - REPLACE → replace top
 *  - POP   → pop (browser/Android back already happened)
 */
export function useNativeNavStackTracker() {
  const loc = useLocation();
  const type = useNavigationType();

  useEffect(() => {
    const p = currentPath(loc);
    if (stack.length === 0) {
      stack.push(p);
      return;
    }
    const top = stack[stack.length - 1];
    if (top === p) return;

    if (type === "POP") {
      // Try to align: if the previous entry matches p, pop; else replace top.
      if (stack.length >= 2 && stack[stack.length - 2] === p) {
        stack.pop();
      } else {
        stack[stack.length - 1] = p;
      }
    } else if (type === "REPLACE") {
      stack[stack.length - 1] = p;
    } else {
      // PUSH
      stack.push(p);
      // Guard against unbounded growth
      if (stack.length > 50) stack.splice(0, stack.length - 50);
    }
  }, [loc.pathname, loc.search, type]);
}