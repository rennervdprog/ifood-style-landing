/**
 * Biometric login helper — Capacitor only.
 *
 * Stores the user's email/password securely (Keychain/Keystore) after a
 * successful login, then lets the user re-authenticate with fingerprint/face
 * the next time they open the app.
 *
 * Web/PWA: all functions are no-ops returning false.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";

const SERVER_NAME = "itasuper.app";
const ENABLED_KEY = "itasuper_biometric_enabled";
const PROMPT_DISMISSED_KEY = "itasuper_biometric_prompt_dismissed";

type BiometricModule = typeof import("capacitor-native-biometric");

let cachedModule: BiometricModule | null = null;

async function getModule(): Promise<BiometricModule | null> {
  if (!isCapacitorNative()) return null;
  if (cachedModule) return cachedModule;
  try {
    cachedModule = await import("capacitor-native-biometric");
    return cachedModule;
  } catch (e) {
    console.warn("[Biometric] failed to load plugin:", e);
    return null;
  }
}

/** Is the device able to use biometrics? */
export async function isBiometricAvailable(): Promise<boolean> {
  const mod = await getModule();
  if (!mod) return false;
  try {
    const res = await mod.NativeBiometric.isAvailable();
    return !!res?.isAvailable;
  } catch {
    return false;
  }
}

/** Has the user opted in to biometric login? */
export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markBiometricPromptDismissed() {
  try { localStorage.setItem(PROMPT_DISMISSED_KEY, "1"); } catch {}
}

export function wasBiometricPromptDismissed(): boolean {
  try { return localStorage.getItem(PROMPT_DISMISSED_KEY) === "1"; } catch { return false; }
}

/**
 * Prompts user to authenticate with biometrics, then returns the saved
 * credentials. Returns null if cancelled or unavailable.
 */
export async function loginWithBiometrics(): Promise<{ email: string; password: string } | null> {
  const mod = await getModule();
  if (!mod) return null;
  try {
    await mod.NativeBiometric.verifyIdentity({
      reason: "Acesse sua conta com biometria",
      title: "Login ItaSuper",
      subtitle: "Use sua digital ou Face ID",
      description: "Autentique-se para continuar",
    });
    const creds = await mod.NativeBiometric.getCredentials({ server: SERVER_NAME });
    if (!creds?.username || !creds?.password) return null;
    return { email: creds.username, password: creds.password };
  } catch (e) {
    console.warn("[Biometric] verify/get failed:", e);
    return null;
  }
}

/** Save credentials so future logins can use biometrics. */
export async function enableBiometricLogin(email: string, password: string): Promise<boolean> {
  const mod = await getModule();
  if (!mod) return false;
  try {
    await mod.NativeBiometric.setCredentials({
      username: email,
      password,
      server: SERVER_NAME,
    });
    try { localStorage.setItem(ENABLED_KEY, "1"); } catch {}
    try { localStorage.removeItem(PROMPT_DISMISSED_KEY); } catch {}
    return true;
  } catch (e) {
    console.warn("[Biometric] setCredentials failed:", e);
    return false;
  }
}

/** Remove stored credentials and disable biometric login. */
export async function disableBiometricLogin(): Promise<void> {
  const mod = await getModule();
  try { localStorage.removeItem(ENABLED_KEY); } catch {}
  try { localStorage.removeItem(PROMPT_DISMISSED_KEY); } catch {}
  if (!mod) return;
  try {
    await mod.NativeBiometric.deleteCredentials({ server: SERVER_NAME });
  } catch {}
}
