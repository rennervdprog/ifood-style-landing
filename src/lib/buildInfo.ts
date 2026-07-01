/**
 * Build metadata injected by Vite (`define`) at build time.
 * BUILD_ID muda em cada build (timestamp), então o versionWatcher pode
 * detectar novos deploys sem precisar bumpar APP_VERSION manualmente.
 */
declare const __BUILD_ID__: string;
declare const __BUILT_AT__: string;

export const BUILD_ID: string =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
export const BUILT_AT: string =
  typeof __BUILT_AT__ !== "undefined" ? __BUILT_AT__ : "dev";