/**
 * Tipos unificados do módulo @/lib/location.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface AddressContext {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalcode?: string | null;
  country?: string | null;
  complement?: string | null;
}

export type LocationSource = "gps" | "address" | "cep" | "reverse" | "cache" | "manual";
export type LocationAccuracy = "high" | "medium" | "low" | "unknown";

export interface ResolvedLocation {
  coords: Coordinates | null;
  address: AddressContext | null;
  source: LocationSource;
  accuracy: LocationAccuracy;
  warnings: string[];
}

export type PermissionState = "granted" | "denied" | "prompt" | "unsupported" | "services_off";

export interface PermissionResult {
  state: PermissionState;
  /** mensagem amigável pra UI */
  message?: string;
  /** se possível, ação direta pra resolver (abrir config nativo) */
  openSettings?: () => Promise<void>;
}
