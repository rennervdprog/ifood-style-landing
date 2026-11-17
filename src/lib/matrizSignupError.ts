/**
 * Mensagem de erro segura para a falha do `register_as_matriz` no cadastro.
 *
 * A RPC devolve o motivo real em `error.message` (ex.: a exceção levantada
 * pela função), mas nem todo motivo pode ir para a tela: erros do Postgres
 * vazam detalhe interno (nome de constraint, SQL) e erros de transporte vêm
 * em inglês. Só passam as mensagens já escritas em português simples pela
 * própria RPC/trigger — copiadas verbatim das definições vivas lidas em
 * 17/11/2026 (`register_as_matriz` e o trigger `guard_matriz_flag`). Todo o
 * resto cai na mensagem genérica: o lojista entende que falhou e tenta de
 * novo, sem jargão e sem vazar nada interno. Nenhuma mensagem de backend é
 * inventada aqui — ou é uma das verificadas, ou é a genérica.
 */

// Mensagens verificadas verbatim nas definições vivas (17/11/2026).
// 'Não autenticado.' e 'Usuário não encontrado.' também existem na RPC, mas
// são curtas demais para o lojista entender sozinho — caem na genérica.
const KNOWN_MATRIZ_ERRORS = new Set([
  "Você só pode criar uma rede para você mesmo.",
  "Sessão expirada. Entre novamente para criar a rede.",
  "A loja-matriz escolhida não pertence a este usuário ou já está em outra rede.",
  "Não é possível transformar em matriz uma loja que já possui pedidos ou produtos.",
]);

export const MATRIZ_SIGNUP_GENERIC_ERROR =
  "Não foi possível criar sua rede. Tente novamente em alguns instantes.";

export function matrizSignupErrorMessage(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === "string") {
    const trimmed = message.trim();
    if (KNOWN_MATRIZ_ERRORS.has(trimmed)) return trimmed;
  }
  return MATRIZ_SIGNUP_GENERIC_ERROR;
}
