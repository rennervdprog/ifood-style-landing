import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

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
      storage: localStorage,
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
      // Abort Supabase REST queries after 12s — prevents silent hangs on slow mobile
      fetch: (url, options) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12_000);
        return fetch(url, { ...options, signal: controller.signal }).finally(
          () => clearTimeout(timer)
        );
      },
    },
  }
);