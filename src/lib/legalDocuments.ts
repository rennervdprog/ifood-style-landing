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

/**
 * Os tipos gerados do Supabase não cobrem a sobrecarga de três argumentos da
 * RPC, a tabela `terms_acceptance` nem as colunas de versão em `profiles`.
 * Em vez de espalhar `as any` por cada chamada, o acesso frouxo fica isolado
 * aqui, com a forma mínima que este arquivo realmente usa.
 */
type LooseError = { code?: string; message?: string } | null;
type LooseDb = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: LooseError }>;
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: LooseError }>;
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: LooseError }>;
    };
  };
};
const db = supabase as unknown as LooseDb;

export interface LegalChange {
  version: string;
  effective_date: string;
  section: string;
  change_type: LegalChangeType;
  summary: string;
  legal_basis: string | null;
}

/**
 * `binding` — a versão já entrou em vigor, o app bloqueia até aceitar.
 * `notice`  — foi publicada com vigência futura; é aviso prévio, não bloqueia.
 *
 * Os Termos v6.6 prometem 30 dias corridos de aviso antes de qualquer mudança
 * comercial (cláusulas 6.2 e 6.3), com saída sem multa nesse intervalo. O modo
 * `notice` é o que faz o software cumprir essa promessa em vez de contradizê-la.
 */
export type LegalPendingMode = "binding" | "notice";

/** Público de cada mudança — usado para não mostrar preço de plano a motoboy. */
export type LegalAudience = "all" | "cliente" | "lojista" | "motoboy";

export interface PendingLegalChanges {
  needs_terms: boolean;
  needs_privacy: boolean;
  current_terms_version: string | null;
  current_privacy_version: string | null;
  terms_changes: LegalChange[];
  privacy_changes: LegalChange[];
  /** Ausente em banco anterior à migration de aviso prévio — assume `binding`. */
  mode?: LegalPendingMode;
  terms_effective_date?: string | null;
  privacy_effective_date?: string | null;
  days_until_effective?: number;
}

export async function fetchPendingLegalChanges(
  termsAccepted: string | null,
  privacyAccepted: string | null,
  audience: LegalAudience = "all"
): Promise<PendingLegalChanges | null> {
  const args = {
    _terms_accepted: termsAccepted || "0",
    _privacy_accepted: privacyAccepted || "0",
  };

  // A sobrecarga de três argumentos só existe depois de
  // `20260913150000_legal_notice_period_and_audience.sql`. Enquanto a migration
  // não roda, o Postgres devolve "function does not exist" (42883) e caímos na
  // assinatura antiga, que mostra tudo para todo mundo — o comportamento de
  // antes, degradado mas correto.
  const withAudience = await db.rpc("get_pending_legal_changes", {
    ...args,
    _audience: audience,
  });

  const { data, error } = withAudience.error?.code === "42883"
    ? await db.rpc("get_pending_legal_changes", args)
    : withAudience;

  if (error) {
    console.warn("[legal] rpc error:", error);
    return null;
  }
  return normalizePending(data as PendingLegalChanges);
}

/** Banco sem a migration não devolve `mode` — tratar como já vigente. */
function normalizePending(raw: PendingLegalChanges): PendingLegalChanges {
  return { ...raw, mode: raw?.mode === "notice" ? "notice" : "binding" };
}

/**
 * Mapeia o papel resolvido por `useUserRouting` para o público das mudanças.
 * Quem administra a plataforma vê tudo.
 */
export function audienceForRole(role: string | null | undefined): LegalAudience {
  switch (role) {
    case "motoboy":
      return "motoboy";
    case "lojista":
    case "lojista_matriz":
    case "lojista_unidade":
      return "lojista";
    case "cliente":
      return "cliente";
    default:
      return "all";
  }
}

/**
 * Registra o aceite.
 *
 * A ordem importa: `terms_acceptance` é a **prova** (quem aceitou, qual versão,
 * quando, de qual navegador) e `profiles` é só o cache que o gate lê para
 * decidir se mostra o modal. Se o insert da prova falhar e o perfil for
 * atualizado mesmo assim, o usuário passa a constar como tendo aceito um texto
 * sem nenhum registro que sustente isso — exatamente o oposto do que a LGPD
 * (art. 8º, §1º) exige de quem alega consentimento. Por isso o insert vem
 * primeiro, com o erro checado, e o update só acontece depois.
 */
export async function recordLegalAcceptance(
  userId: string,
  termsVersion: string,
  privacyVersion: string,
  mode: LegalPendingMode = "binding"
) {
  const proof = {
    user_id: userId,
    terms_version: termsVersion,
    privacy_version: privacyVersion,
    user_agent: navigator.userAgent.slice(0, 200),
    accepted_at: new Date().toISOString(),
  };

  // `acceptance_mode` só existe depois da migration de aviso prévio. Se o banco
  // ainda não tem a coluna, grava sem ela — a prova do aceite não pode falhar
  // por causa de um campo acessório.
  let proofError = (await db
    .from("terms_acceptance")
    .insert({ ...proof, acceptance_mode: mode })).error;

  if (proofError && (proofError.code === "42703" || proofError.code === "PGRST204")) {
    proofError = (await db.from("terms_acceptance").insert(proof)).error;
  }
  if (proofError) throw proofError;

  const { error } = await db
    .from("profiles")
    .update({
      terms_version_accepted: termsVersion,
      privacy_version_accepted: privacyVersion,
    })
    .eq("user_id", userId);
  if (error) throw error;
}