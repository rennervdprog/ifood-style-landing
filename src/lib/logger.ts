/**
 * 🪵 Logger condicional
 *
 * Substituto do console.log/console.warn/console.error que respeita o ambiente.
 * Em produção, apenas erros são logados (e enviados ao Sentry quando configurado).
 * Em desenvolvimento, todos os níveis aparecem no console.
 *
 * Uso:
 *   import { logger } from "@/lib/logger";
 *   logger.log("Carrinho atualizado", items);
 *   logger.warn("Conexão lenta detectada");
 *   logger.error("Falha no checkout", err);
 *
 * Para forçar log em produção (debug pontual), use logger.force.log(...)
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === "development";

type LogArgs = readonly unknown[];

const noop = () => {};

export const logger = {
  log: isDev ? (...args: LogArgs) => console.log(...args) : noop,
  info: isDev ? (...args: LogArgs) => console.info(...args) : noop,
  warn: isDev ? (...args: LogArgs) => console.warn(...args) : noop,
  // Erros sempre passam — Sentry captura
  error: (...args: LogArgs) => console.error(...args),
  debug: isDev ? (...args: LogArgs) => console.debug(...args) : noop,

  /**
   * Força log mesmo em produção.
   * Use apenas para debug pontual e remova depois.
   */
  force: {
    log: (...args: LogArgs) => console.log(...args),
    warn: (...args: LogArgs) => console.warn(...args),
    error: (...args: LogArgs) => console.error(...args),
  },
};
