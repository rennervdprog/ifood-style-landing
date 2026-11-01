// Link de avaliação do Google da loja — guardado em
// stores.settings.google_review_url pelo painel (aba Loja das
// configurações). Usado em dois lugares:
//  - OrderRating (web): botão "Avaliar no Google" após a avaliação interna.
//  - order-status-whatsapp (servidor): convite na conclusão do pedido —
//    a função valida o mesmo formato antes de montar a mensagem.

/** Aceita os formatos que o Perfil da Empresa do Google gera:
 *  g.page/r/..., search.google.com/local/writereview?placeid=...,
 *  maps.app.goo.gl/... e páginas do Maps em domínio google. */
export function isValidGoogleReviewUrl(raw: string): boolean {
  const value = (raw || "").trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host === "g.page" ||
      host === "maps.app.goo.gl" ||
      host.endsWith("google.com") ||
      host.endsWith("google.com.br")
    );
  } catch {
    return false;
  }
}

/** Extrai o link válido das settings da loja; "" quando ausente/inválido. */
export function googleReviewUrlFromSettings(settings: unknown): string {
  const url =
    settings && typeof settings === "object"
      ? (settings as { google_review_url?: unknown }).google_review_url
      : undefined;
  const value = typeof url === "string" ? url.trim() : "";
  return isValidGoogleReviewUrl(value) ? value : "";
}
