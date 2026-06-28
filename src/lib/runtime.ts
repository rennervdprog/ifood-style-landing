/**
 * Runtime info unificado — fonte única para "estou no app nativo?"
 * e "qual é o modo (parceiro/cliente)?".
 *
 * Substitui chamadas espalhadas de `isCapacitorNative()` + `getCapacitorAppMode()`.
 */
import { useEffect, useState } from "react";
import { isCapacitorNative } from "@/lib/capacitorNative";
import { getCapacitorAppMode, type CapacitorAppMode } from "@/lib/capacitorAppMode";

export type Runtime = {
  /** Rodando dentro do APK/IPA Capacitor */
  isNative: boolean;
  /** APK Parceiro */
  isPartnerNative: boolean;
  /** APK Cliente */
  isClientNative: boolean;
  /** "android" | "ios" | "web" */
  platform: "android" | "ios" | "web";
  appMode: CapacitorAppMode | null;
};

function readRuntime(): Runtime {
  const native = isCapacitorNative();
  const mode = native ? getCapacitorAppMode() : null;
  let platform: Runtime["platform"] = "web";
  if (native) {
    try {
      // Importa de forma síncrona — Capacitor já está carregado se isNative=true.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Capacitor } = require("@capacitor/core");
      const p = Capacitor.getPlatform();
      platform = p === "ios" ? "ios" : "android";
    } catch {
      platform = "android";
    }
  }
  return {
    isNative: native,
    isPartnerNative: native && mode === "partner",
    isClientNative: native && mode === "client",
    platform,
    appMode: mode,
  };
}

let cached: Runtime | null = null;

export function getRuntime(): Runtime {
  if (!cached) cached = readRuntime();
  return cached;
}

/** Hook reativo (re-renderiza se o modo for resolvido depois) */
export function useRuntime(): Runtime {
  const [rt, setRt] = useState<Runtime>(() => getRuntime());
  useEffect(() => {
    // Re-checa após mount caso o appMode tenha sido resolvido assincronamente
    // (App.getInfo()).
    const id = window.setTimeout(() => {
      cached = null;
      const next = getRuntime();
      setRt((prev) =>
        prev.appMode === next.appMode && prev.isNative === next.isNative ? prev : next,
      );
    }, 250);
    return () => window.clearTimeout(id);
  }, []);
  return rt;
}