/**
 * Storage adapter para a sessão do Supabase.
 *
 * - Web: usa localStorage (padrão).
 * - Capacitor (Android/iOS): usa @capacitor/preferences, que sobrevive a
 *   limpeza de cache do WebView e atualizações do APK. Faz double-write no
 *   localStorage para retro-compatibilidade e migra sessões antigas na 1ª leitura.
 *
 * Também limpa tokens órfãos de projetos Supabase antigos (Lovable Cloud),
 * eliminando os erros `bad_jwt: token signature is invalid` que
 * hoje deslogam clientes silenciosamente.
 */
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const isNative = () => {
  try {
    return Capacitor.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

const CURRENT_PROJECT_REF = "qkjhguziuchqsbxzruea";

/** Remove chaves `sb-<ref>-auth-token` de projetos Supabase antigos. */
export const purgeOrphanSupabaseTokens = () => {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("sb-") && k.endsWith("-auth-token") && !k.includes(CURRENT_PROJECT_REF)) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      localStorage.removeItem(k);
      console.log("[AuthStorage] 🧹 Removed orphan token:", k);
    }
  } catch (e) {
    console.warn("[AuthStorage] purgeOrphanSupabaseTokens failed:", e);
  }
};

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!isNative()) {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    try {
      const { value } = await Preferences.get({ key });
      if (value) return value;
      // Migração: se existia no localStorage antes de migrarmos para Preferences,
      // devolve e persiste no Preferences para próximas leituras.
      try {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          await Preferences.set({ key, value: legacy });
          return legacy;
        }
      } catch {}
      return null;
    } catch {
      try { return localStorage.getItem(key); } catch { return null; }
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try { localStorage.setItem(key, value); } catch {}
    if (isNative()) {
      try { await Preferences.set({ key, value }); } catch {}
    }
  },
  async removeItem(key: string): Promise<void> {
    try { localStorage.removeItem(key); } catch {}
    if (isNative()) {
      try { await Preferences.remove({ key }); } catch {}
    }
  },
};