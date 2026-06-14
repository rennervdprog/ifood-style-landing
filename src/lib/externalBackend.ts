import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

export const EXTERNAL_BACKEND_URL = SUPABASE_URL;
export const EXTERNAL_BACKEND_ANON_KEY = SUPABASE_ANON_KEY;

export function externalFunctionUrl(slug: string) {
  return `${EXTERNAL_BACKEND_URL}/functions/v1/${slug}`;
}

export function assertExternalBackend() {
  if (!EXTERNAL_BACKEND_URL.includes("qkjhguziuchqsbxzruea.supabase.co")) {
    throw new Error("ItaSuper deve usar o backend externo, não o Lovable Cloud.");
  }
}