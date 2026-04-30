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
  }
);