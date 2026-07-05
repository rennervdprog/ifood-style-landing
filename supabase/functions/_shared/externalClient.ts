// Helper compartilhado: cria client Supabase apontando para o backend EXTERNO
// (qkjhguziuchqsbxzruea) usando service_role. Uso exclusivo em edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getExternalSupabase() {
  const url =
    Deno.env.get("EXTERNAL_SUPABASE_URL") ||
    (Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")
      ? `https://${Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")}.supabase.co`
      : "");
  const key =
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
    Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
    "";
  if (!url || !key) {
    throw new Error("External Supabase credentials missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export function normalizePhoneBR(input: string): string | null {
  const digits = String(input || "").replace(/\D/g, "");
  // aceita 10 (fixo) ou 11 (celular) dígitos BR; grava com DDI 55
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length === 12 || digits.length === 13) return digits; // já com DDI
  return null;
}