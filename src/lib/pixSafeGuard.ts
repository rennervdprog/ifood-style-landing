/**
 * PIX Safe Guard — client-side rate limiting and 429 safety mode
 */

const PIX_ATTEMPT_KEY = "pix_attempts";
const PIX_COOLDOWN_KEY = "pix_cooldown_until";
const PIX_SAFETY_MODE_KEY = "pix_safety_mode_until";

const MAX_ATTEMPTS = 3;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const SAFETY_MODE_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
}

function getAttemptRecord(contextKey: string): AttemptRecord {
  try {
    const raw = localStorage.getItem(`${PIX_ATTEMPT_KEY}_${contextKey}`);
    if (!raw) return { count: 0, firstAttemptAt: 0 };
    return JSON.parse(raw);
  } catch {
    return { count: 0, firstAttemptAt: 0 };
  }
}

function setAttemptRecord(contextKey: string, record: AttemptRecord) {
  localStorage.setItem(`${PIX_ATTEMPT_KEY}_${contextKey}`, JSON.stringify(record));
}

export function recordPixAttempt(contextKey: string): void {
  const record = getAttemptRecord(contextKey);
  // Reset if window has passed
  if (Date.now() - record.firstAttemptAt > COOLDOWN_MS) {
    setAttemptRecord(contextKey, { count: 1, firstAttemptAt: Date.now() });
  } else {
    setAttemptRecord(contextKey, { count: record.count + 1, firstAttemptAt: record.firstAttemptAt });
  }
}

export function resetPixAttempts(contextKey: string): void {
  localStorage.removeItem(`${PIX_ATTEMPT_KEY}_${contextKey}`);
}

export function isPixCooldownActive(contextKey: string): boolean {
  // Check explicit cooldown
  const cooldownUntil = Number(localStorage.getItem(`${PIX_COOLDOWN_KEY}_${contextKey}`) || 0);
  if (cooldownUntil > Date.now()) return true;

  // Check attempt-based cooldown
  const record = getAttemptRecord(contextKey);
  if (record.count >= MAX_ATTEMPTS && Date.now() - record.firstAttemptAt < COOLDOWN_MS) {
    return true;
  }

  return false;
}

export function getPixCooldownRemainingMs(contextKey: string): number {
  const cooldownUntil = Number(localStorage.getItem(`${PIX_COOLDOWN_KEY}_${contextKey}`) || 0);
  const record = getAttemptRecord(contextKey);

  let remaining = 0;
  if (cooldownUntil > Date.now()) {
    remaining = Math.max(remaining, cooldownUntil - Date.now());
  }
  if (record.count >= MAX_ATTEMPTS) {
    const windowEnd = record.firstAttemptAt + COOLDOWN_MS;
    if (windowEnd > Date.now()) {
      remaining = Math.max(remaining, windowEnd - Date.now());
    }
  }
  return remaining;
}

export function activatePixCooldown(contextKey: string): void {
  localStorage.setItem(`${PIX_COOLDOWN_KEY}_${contextKey}`, String(Date.now() + COOLDOWN_MS));
}

// Safety mode (429 handling)
export function activateSafetyMode(): void {
  localStorage.setItem(PIX_SAFETY_MODE_KEY, String(Date.now() + SAFETY_MODE_MS));
}

export function isSafetyModeActive(): boolean {
  const until = Number(localStorage.getItem(PIX_SAFETY_MODE_KEY) || 0);
  if (until > Date.now()) return true;
  if (until > 0) localStorage.removeItem(PIX_SAFETY_MODE_KEY);
  return false;
}

export function getSafetyModeRemainingMs(): number {
  const until = Number(localStorage.getItem(PIX_SAFETY_MODE_KEY) || 0);
  return Math.max(0, until - Date.now());
}

export function formatCooldownTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
