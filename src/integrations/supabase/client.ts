import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { authStorage, purgeOrphanSupabaseTokens } from "./authStorage";

// Limpa tokens de projetos Supabase antigos que causavam `bad_jwt` silencioso
// e forçavam clientes a re-logar. Executa uma vez no boot do módulo.
purgeOrphanSupabaseTokens();

// 🔁 Cérebro apontado para o Supabase EXTERNO (não Lovable Cloud)
// Projeto externo: qkjhguziuchqsbxzruea (necessário para integração com Vercel)
export const SUPABASE_URL = "https://qkjhguziuchqsbxzruea.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFramhndXppdWNocXNieHpydWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDg4NTUsImV4cCI6MjA5MDYyNDg1NX0.2sTeKchqAEN2gCqnH1_Zn9cJmUSmZgryt05A66tgm2Y";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      // Heartbeat every 25s (default 30s) — keeps WebSocket alive through
      // aggressive NAT timeouts common on mobile networks (3G/4G)
      heartbeatIntervalMs: 25_000,
      // Reconnect with exponential backoff — avoids hammering server on flaky connections
      reconnectAfterMs: (tries) => Math.min(500 * 2 ** tries, 10_000),
      // Timeout for each channel join attempt — fail fast, retry instead of hanging
      timeout: 10_000,
    },
    global: {
      // Abort Supabase REST queries after 25s — evita travas silenciosas em rede ruim
      // sem cancelar prematuramente fluxos legítimos (geocoding, upload, etc).
      // Importante: respeita o signal já vindo do caller (React Query, etc) encadeando-os,
      // assim não perdemos o cancelamento natural quando a query é desmontada.
      fetch: (url, options) => {
        const timeoutCtrl = new AbortController();
        const timer = setTimeout(
          () => timeoutCtrl.abort(new DOMException("Supabase fetch timeout (25s)", "TimeoutError")),
          25_000
        );

        const callerSignal = (options as any)?.signal as AbortSignal | undefined;
        let signal: AbortSignal = timeoutCtrl.signal;

        if (callerSignal) {
          // Encadeia: aborta se qualquer um abortar
          if (callerSignal.aborted) {
            timeoutCtrl.abort(callerSignal.reason);
          } else {
            const onCallerAbort = () => timeoutCtrl.abort(callerSignal.reason);
            callerSignal.addEventListener("abort", onCallerAbort, { once: true });
          }
        }

        return fetch(url, { ...options, signal }).finally(() => clearTimeout(timer));
      },
    },
  }
);