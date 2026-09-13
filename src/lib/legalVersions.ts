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
