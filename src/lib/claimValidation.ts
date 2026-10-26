// Fase 6D Opção A — "Reivindicar minha conta" na página de acompanhamento.
//
// Espelho das validações da edge claim-guest-account, com testes em
// Vitest. A edge é autocontida e NÃO importa este lib (o deploy não sobe
// subdiretórios) — o código lá dentro repete estas mesmas regras. Se mudar
// uma regra aqui, mudar na edge também (e vice-versa).
export const CLAIM_MIN_PASSWORD_LENGTH = 6;
export const CLAIM_GUEST_EMAIL_RE = /^guest\+(\d+)@guest\.itasuper\.app$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E-mail com formato válido (mesmo padrão do cadastro). */
export function isValidClaimEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Senha mínima de 6 caracteres (mesmo padrão do cadastro/login). */
export function isValidClaimPassword(password: string): boolean {
  return password.length >= CLAIM_MIN_PASSWORD_LENGTH;
}

/** O e-mail é o sintético de guest (guest+<telefone>@guest.itasuper.app)? */
export function isGuestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return CLAIM_GUEST_EMAIL_RE.test(email.trim());
}

export type ClaimFormError = "invalid_email" | "weak_password" | "password_mismatch" | null;

/**
 * Validação do formulário de reivindicação. Devolve a chave do erro ou
 * null quando está tudo certo. Ordem: e-mail → senha → confirmação.
 */
export function validateClaimForm(email: string, password: string, confirmPassword: string): ClaimFormError {
  if (!isValidClaimEmail(email)) return "invalid_email";
  if (!isValidClaimPassword(password)) return "weak_password";
  if (password !== confirmPassword) return "password_mismatch";
  return null;
}
