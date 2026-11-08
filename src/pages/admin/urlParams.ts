/**
 * Identificação da tela na URL (pedido do Renner, 2026-11-08): cada tela do
 * painel grava onde está num parâmetro da URL (tab, secao, fin, rel), sem
 * recarregar a página — assim, se o lojista recarregar (F5/atualizar), ele
 * volta exatamente pra tela onde estava, e o link pode ser compartilhado.
 *
 * A escrita usa history.replaceState de propósito: NÃO cria entrada no
 * histórico (o botão Voltar do navegador continua saindo do painel, como
 * hoje) e NÃO dispara o roteador — só atualiza a barra de endereços,
 * preservando os demais parâmetros (ex.: storeId).
 */

export function readUrlParam(key: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(key);
  } catch {
    return null;
  }
}

export function writeUrlParam(key: string, value: string | null) {
  try {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
    );
  } catch {
    /* URL é conveniência de navegação — nunca pode quebrar a tela. */
  }
}
