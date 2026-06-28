/**
 * @deprecated Use `@/lib/location` (`fetchCep`, `formatCep`).
 */
export { fetchCep, formatCep } from "@/lib/location";
export type { CepResult } from "@/lib/location";
export const clearCepCache = () => {
  // no-op shim; cache real fica em @/lib/location.
};