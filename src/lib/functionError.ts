/**
 * Extrai a mensagem real de erro de uma chamada a Edge Function.
 *
 * O supabase-js transforma qualquer resposta não-2xx num erro genérico
 * ("Edge Function returned a non-2xx status code") e o corpo JSON da
 * função — onde mora o motivo de verdade, ex.: { "error": "Sessão
 * inválida." } — fica acessível em `error.context` (a Response).
 * Sem isto, o lojista vê sempre a mesma mensagem em inglês, qualquer
 * que seja o problema (sessão expirada, sem permissão, loja não
 * encontrada, erro interno), e o suporte não tem como distinguir.
 */
export async function getFunctionErrorMessage(
  error: unknown,
  fallback = "Algo deu errado. Tente de novo.",
): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).clone === "function") {
    try {
      const body: unknown = await (context as Response).clone().json();
      const message = (body as { error?: unknown } | null)?.error;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      // Corpo não-JSON ou já consumido — cai pras opções abaixo.
    }
  }
  const message = (error as { message?: unknown } | null)?.message;
  if (
    typeof message === "string" &&
    message.trim() &&
    message !== "Edge Function returned a non-2xx status code"
  ) {
    return message;
  }
  return fallback;
}
