/**
 * Debug Store Logger
 * ------------------
 * Intercepta chamadas de edge functions (supabase.functions.invoke) e, quando o
 * payload envolve uma loja marcada para depuração, registra a request/response
 * na tabela `debug_store_logs` do Supabase externo + envia breadcrumb pro Sentry
 * com a tag `debug_store`. Também captura erros JS globais dessa mesma loja.
 *
 * Consumido por super admin em Auditoria → Debug Loja.
 */
import { supabase } from "@/integrations/supabase/client";
import * as Sentry from "@sentry/react";

// Lojas monitoradas (adicionar UUIDs aqui para ligar debug intensivo)
export const DEBUG_STORE_IDS: string[] = [
  "e14a110c-f0a1-4b25-8a71-554a9705fefa", // Restaurante Cantinho da Silvia
];

const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function findDebugStoreId(value: unknown, depth = 0): string | null {
  if (depth > 4 || value == null) return null;
  if (typeof value === "string") {
    return looksLikeUuid.test(value) && DEBUG_STORE_IDS.includes(value.toLowerCase())
      ? value
      : null;
  }
  if (Array.isArray(value)) {
    for (const it of value) {
      const hit = findDebugStoreId(it, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Chaves prováveis: store_id, storeId, id, target_id
      if (typeof v === "string" && DEBUG_STORE_IDS.includes(v.toLowerCase())) return v;
      const hit = findDebugStoreId(v, depth + 1);
      if (hit) return hit;
      void k;
    }
  }
  return null;
}

async function persistLog(row: {
  store_id: string | null;
  function_name: string;
  direction: "request" | "response" | "error";
  status?: number | null;
  duration_ms?: number | null;
  payload?: unknown;
  error?: string | null;
}) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    await (supabase as any).from("debug_store_logs").insert({
      store_id: row.store_id,
      user_id: userRes?.user?.id ?? null,
      function_name: row.function_name,
      direction: row.direction,
      status: row.status ?? null,
      duration_ms: row.duration_ms ?? null,
      payload: row.payload == null ? null : safeJson(row.payload),
      error: row.error ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
      route: typeof window !== "undefined" ? window.location.pathname : null,
    });
  } catch {
    // Log de debug nunca deve quebrar a chamada real
  }
}

function safeJson(v: unknown) {
  try {
    // Recorta pra evitar payloads gigantes
    const s = JSON.stringify(v);
    if (!s) return null;
    return JSON.parse(s.length > 8000 ? s.slice(0, 8000) + '..."' : s);
  } catch {
    return null;
  }
}

let installed = false;

export function installDebugStoreLogger() {
  if (installed) return;
  installed = true;

  const fnClient: any = (supabase as any).functions;
  if (!fnClient || typeof fnClient.invoke !== "function") return;

  const originalInvoke = fnClient.invoke.bind(fnClient);

  fnClient.invoke = async (fnName: string, options?: any) => {
    const body = options?.body;
    const storeId = findDebugStoreId(body) || findDebugStoreId(options?.headers);
    const startedAt = performance.now();

    if (storeId) {
      Sentry.addBreadcrumb({
        category: "debug-store",
        message: `invoke:${fnName}`,
        level: "info",
        data: { store_id: storeId, body: safeJson(body) },
      });
      persistLog({
        store_id: storeId,
        function_name: fnName,
        direction: "request",
        payload: body,
      });
    }

    const result = await originalInvoke(fnName, options);
    const duration = Math.round(performance.now() - startedAt);

    if (storeId) {
      const status = (result as any)?.error?.context?.status ?? null;
      if (result?.error) {
        Sentry.captureMessage(`[debug-store] ${fnName} falhou`, {
          level: "error",
          tags: { debug_store: storeId, edge_function: fnName },
          extra: { error: String(result.error?.message || result.error), status },
        });
        persistLog({
          store_id: storeId,
          function_name: fnName,
          direction: "error",
          status,
          duration_ms: duration,
          payload: safeJson(result.data),
          error: String(result.error?.message || result.error),
        });
      } else {
        persistLog({
          store_id: storeId,
          function_name: fnName,
          direction: "response",
          status: 200,
          duration_ms: duration,
          payload: result?.data,
        });
      }
    }

    return result;
  };

  // Captura erros JS globais quando a rota atual mostra uma loja debug
  if (typeof window !== "undefined") {
    window.addEventListener("error", (ev) => {
      try {
        const path = window.location.pathname + window.location.search;
        const hit = DEBUG_STORE_IDS.find((id) => path.includes(id));
        if (!hit) return;
        Sentry.captureException(ev.error || new Error(ev.message), {
          tags: { debug_store: hit },
        });
        persistLog({
          store_id: hit,
          function_name: "window.onerror",
          direction: "error",
          error: String(ev.message || ev.error),
        });
      } catch {}
    });
    window.addEventListener("unhandledrejection", (ev: any) => {
      try {
        const path = window.location.pathname + window.location.search;
        const hit = DEBUG_STORE_IDS.find((id) => path.includes(id));
        if (!hit) return;
        const reason = ev.reason;
        Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)), {
          tags: { debug_store: hit },
        });
        persistLog({
          store_id: hit,
          function_name: "unhandledrejection",
          direction: "error",
          error: String(reason?.message || reason),
        });
      } catch {}
    });
  }
}