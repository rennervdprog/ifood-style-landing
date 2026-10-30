/**
 * Fase 6D Opção A2 — "Reivindicar no cadastro": cliente que já pediu como
 * guest cria a conta com o mesmo WhatsApp e converte o cadastro existente
 * (mesmo user_id) em vez de criar outro.
 *
 * As 3 edges são anônimas (service_role) e devolvem JSON com o status no
 * corpo mesmo em 4xx — por isso o front chama via fetch direto (como
 * PublicOrderTracking faz com guest-order-status) em vez de
 * supabase.functions.invoke, que esconde o corpo do erro.
 */
import { externalFunctionUrl } from "@/lib/externalBackend";
import { SUPABASE_ANON_KEY } from "@/integrations/supabase/client";

export type ClaimStatus = "guest" | "real" | "new";

export interface ClaimCheckResult {
  status: ClaimStatus;
  guest_user_id?: string;
  last_store_id?: string | null;
  last_store_name?: string | null;
  last_order_id?: string | null;
  error?: string;
}

export interface ClaimSendOtpResult {
  ok?: boolean;
  expires_at?: string;
  resend_after_seconds?: number;
  error?: string;
  fallback?: string;
  retry_after_seconds?: number;
}

export interface ClaimVerifyOtpResult {
  ok?: boolean;
  user_id?: string;
  error?: string;
  attempts_remaining?: number;
}

export interface ClaimAddressInput {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  reference_point: string;
}

export interface ClaimConvertInput {
  phone: string;
  guest_user_id: string;
  code: string;
  email: string;
  password: string;
  full_name: string;
  address: ClaimAddressInput;
  delivery_pin: string;
  terms_version: string;
  privacy_version: string;
  user_agent: string;
}

interface ClaimCallResult<T> {
  status: number;
  data: T;
}

/** Chama uma edge claim-* e devolve status HTTP + JSON (mesmo em erro). */
export async function callClaimFunction<T>(
  slug: string,
  body: Record<string, unknown>,
): Promise<ClaimCallResult<T>> {
  const res = await fetch(externalFunctionUrl(slug), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

/** Normaliza o WhatsApp digitado para o formato das edges (só dígitos, 55). */
export function normalizeClaimPhone(whatsapp: string): string | null {
  const d = whatsapp.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length === 12 || d.length === 13) return d;
  return null;
}
