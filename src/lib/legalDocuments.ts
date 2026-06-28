/**
 * Helpers para o sistema de documentos legais com diff automático.
 * Lê de `legal_documents` + `legal_document_changes` no Supabase EXTERNO.
 *
 * O modal de aceite só exibe as mudanças entre a versão que o usuário aceitou
 * pela última vez e a versão atual — nada de hard-code.
 */
import { supabase } from "@/integrations/supabase/client";

export type LegalKind = "terms" | "privacy";
export type LegalChangeType = "added" | "modified" | "removed" | "fix";

export interface LegalChange {
  version: string;
  effective_date: string;
  section: string;
  change_type: LegalChangeType;
  summary: string;
  legal_basis: string | null;
}

export interface PendingLegalChanges {
  needs_terms: boolean;
  needs_privacy: boolean;
  current_terms_version: string | null;
  current_privacy_version: string | null;
  terms_changes: LegalChange[];
  privacy_changes: LegalChange[];
}

export async function fetchPendingLegalChanges(
  termsAccepted: string | null,
  privacyAccepted: string | null
): Promise<PendingLegalChanges | null> {
  const { data, error } = await supabase.rpc("get_pending_legal_changes" as any, {
    _terms_accepted: termsAccepted || "0",
    _privacy_accepted: privacyAccepted || "0",
  });
  if (error) {
    console.warn("[legal] rpc error:", error);
    return null;
  }
  return data as PendingLegalChanges;
}

export async function recordLegalAcceptance(
  userId: string,
  termsVersion: string,
  privacyVersion: string
) {
  await supabase.from("terms_acceptance" as any).insert({
    user_id: userId,
    terms_version: termsVersion,
    privacy_version: privacyVersion,
    user_agent: navigator.userAgent.slice(0, 200),
    accepted_at: new Date().toISOString(),
  });
  const { error } = await supabase
    .from("profiles")
    .update({
      terms_version_accepted: termsVersion,
      privacy_version_accepted: privacyVersion,
    } as any)
    .eq("user_id", userId);
  if (error) throw error;
}