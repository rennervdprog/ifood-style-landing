/**
 * Fonte única de verdade da versão dos documentos legais servidos pelo app.
 *
 * Estas constantes precisam bater com o markdown importado por
 * `src/pages/TermosDeUso.tsx` e `src/pages/PoliticaPrivacidade.tsx` e com a
 * linha `is_current = true` de `legal_documents` no banco. Ao publicar uma
 * versão nova: trocar o import do markdown, bumpar aqui e criar a migration
 * de publicação (ver `20260913120000_publish_legal_v6_6.sql`).
 *
 * Não repetir o número da versão em telas de cadastro — importar daqui.
 * Gravar uma versão desatualizada em `terms_acceptance` faz o usuário nascer
 * já pendente de reaceite e registra aceite de um texto que ele não leu.
 */
export const CURRENT_TERMS_VERSION = "6.6";
export const CURRENT_PRIVACY_VERSION = "6.6";

/**
 * Compara duas versões legais no formato "maior.menor".
 *
 * Nunca comparar essas strings com `>=` direto: em ordem lexicográfica
 * `"10.0" >= "4.2"` é `false`, e o bug só aparece na v10 — muito depois de
 * quem escreveu ter esquecido. Retorna negativo se `a < b`, zero se iguais,
 * positivo se `a > b`.
 */
export function compareLegalVersions(a: string | null | undefined, b: string | null | undefined): number {
  const parse = (v: string | null | undefined) =>
    String(v ?? "0").split(".").map((p) => Number.parseInt(p, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** `true` quando `accepted` é igual ou mais nova que `required`. */
export function isLegalVersionAtLeast(
  accepted: string | null | undefined,
  required: string
): boolean {
  return compareLegalVersions(accepted, required) >= 0;
}
