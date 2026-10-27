/**
 * Carregamento preguiçoso com UMA tentativa de recarga — nunca loop infinito.
 *
 * Contexto (27/10/2026): só as duas páginas do super-admin usavam
 * `.catch(() => window.location.reload())` no lazy import. Com o shell
 * antigo do PWA em cache após um deploy, o chunk da página 404ava,
 * o catch recarregava, o shell antigo voltava, o chunk 404ava de novo —
 * loop infinito sem saída: o aviso "Nova versão disponível" nunca
 * aparecia porque a página não ficava no ar 60 s para o watcher rodar.
 *
 * Regra agora: na 1ª falha, recarrega uma vez (o caso comum — o deploy
 * acabou de sair e o chunk novo resolve). Se falhar de novo, mostra a
 * tela de erro com um botão "Atualizar a página" e NÃO recarrega sozinho.
 * A marca "já tentei" vive no sessionStorage por rota e é limpa quando o
 * carregamento dá certo — cada incidente ganha a sua única recarga.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

function flagKey(routeKey: string) {
  return `lazy-reload:${routeKey}`;
}

function alreadyRetried(routeKey: string): boolean {
  try {
    return sessionStorage.getItem(flagKey(routeKey)) === "1";
  } catch {
    return false;
  }
}

function markRetried(routeKey: string): void {
  try {
    sessionStorage.setItem(flagKey(routeKey), "1");
  } catch {
    // Sem storage: a recarga única abaixo ainda vale por tentativa.
  }
}

function clearRetried(routeKey: string): void {
  try {
    sessionStorage.removeItem(flagKey(routeKey));
  } catch {
    // ignore
  }
}

/**
 * Tela mostrada quando o pedaço da página falha 2x seguidas.
 * O botão limpa a marca e recarrega — é o usuário quem decide.
 */
export function ChunkLoadError({ routeKey }: { routeKey: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-3">
        <h2 className="text-lg font-black text-foreground">Não foi possível carregar esta tela</h2>
        <p className="text-sm text-muted-foreground">
          A versão do site pode ter mudado. Toque em Atualizar para carregar a versão nova.
        </p>
        <button
          type="button"
          onClick={() => {
            clearRetried(routeKey);
            window.location.reload();
          }}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-95"
        >
          Atualizar a página
        </button>
        <p className="text-xs text-muted-foreground">
          Se continuar, feche a aba e abra o site de novo — ou limpe os dados do site no navegador.
        </p>
      </div>
    </div>
  );
}

export function loadLazyOnce<T extends ComponentType<Record<string, never>>>(
  routeKey: string,
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    importer()
      .then((m) => {
        clearRetried(routeKey);
        return m;
      })
      .catch(() => {
        if (alreadyRetried(routeKey)) {
          const Fallback = () => <ChunkLoadError routeKey={routeKey} />;
          return { default: Fallback as unknown as T };
        }
        markRetried(routeKey);
        window.location.reload();
        return { default: (() => null) as unknown as T };
      }),
  );
}
