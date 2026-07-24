import fs from "node:fs/promises";
import path from "node:path";

/**
 * Playwright global setup for the external Supabase backend.
 *
 * Calls the `e2e-mint-session` edge function to obtain a real session for a
 * fixed test user and writes it into `.auth/pdv-user.json` as a Playwright
 * storageState (localStorage entry the Supabase JS client reads on boot).
 *
 * Required env vars (set in shell / CI):
 *   E2E_SETUP_TOKEN   shared secret matching the edge function
 *   E2E_BASE_URL      optional, defaults to http://localhost:8080
 *
 * The external Supabase URL/anon key are hardcoded to match src/integrations/supabase/client.ts.
 */
const SUPABASE_URL = "https://qkjhguziuchqsbxzruea.supabase.co";
const STORAGE_KEY = "sb-qkjhguziuchqsbxzruea-auth-token";
const AUTH_FILE = path.resolve(".auth/pdv-user.json");

async function writeStorageState(baseURL: string, session?: unknown) {
  const origin = new URL(baseURL).origin;
  const localStorage = session
    ? [{ name: STORAGE_KEY, value: JSON.stringify(session) }]
    : [];

  await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });
  await fs.writeFile(
    AUTH_FILE,
    JSON.stringify({ cookies: [], origins: [{ origin, localStorage }] }, null, 2)
  );
}

export default async function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL || "http://localhost:8080";
  const token = process.env.E2E_SETUP_TOKEN;
  if (!token) {
    console.warn("[e2e] E2E_SETUP_TOKEN not set — skipping session mint (tests requiring auth will land on /auth).");
    await writeStorageState(baseURL);
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/e2e-mint-session`, {
    method: "POST",
    headers: { "x-e2e-token": token, "content-type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    throw new Error(`[e2e] mint-session failed: ${res.status} ${await res.text()}`);
  }
  const session = await res.json();

  await writeStorageState(baseURL, session);
  console.log(`[e2e] session written to ${AUTH_FILE} (user=${session?.user?.email ?? "?"})`);
}