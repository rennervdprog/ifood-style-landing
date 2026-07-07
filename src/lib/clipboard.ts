/**
 * Copy texto para a área de transferência com fallback para WebView/Android
 * antigo onde navigator.clipboard não existe ou falha silenciosamente.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1) Tenta a Clipboard API moderna (precisa de HTTPS + contexto seguro)
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* cai no fallback */
  }

  // 2) Fallback com textarea + execCommand("copy")
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}