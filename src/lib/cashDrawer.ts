/**
 * Abertura de gaveta ESC/POS via Web Serial.
 *
 * Feature-flag: `store.settings.pdv_drawer_enabled` (Fase 3 item 10).
 * A porta escolhida pelo lojista fica em memória durante a sessão;
 * o navegador guarda a permissão em `navigator.serial.getPorts()`.
 *
 * Ambientes sem Web Serial (Safari, mobile, WebView Android sem flag) fazem
 * no-op silencioso e retornam `false` — nunca lança para não travar a venda.
 */

// ESC p m t1 t2 — pulso no pino 2 (m=0), 25ms on / 250ms off.
const OPEN_DRAWER_BYTES = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);

let cachedPort: any = null;

function serialAvailable(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

async function pickPort(): Promise<any | null> {
  if (!serialAvailable()) return null;
  const nav = navigator as any;
  // 1) porta já autorizada anteriormente
  try {
    const known = await nav.serial.getPorts();
    if (known && known.length > 0) return known[0];
  } catch {}
  // 2) prompt (precisa ser chamado a partir de gesto do usuário)
  try {
    return await nav.serial.requestPort();
  } catch {
    return null;
  }
}

async function writeBytes(port: any, bytes: Uint8Array) {
  if (!port.readable) await port.open({ baudRate: 9600 });
  const writer = port.writable.getWriter();
  try { await writer.write(bytes); } finally { writer.releaseLock(); }
}

/**
 * Envia comando de abertura da gaveta.
 * @returns true se o comando foi enviado; false se sem suporte / sem porta.
 */
export async function openCashDrawer(): Promise<boolean> {
  if (!serialAvailable()) return false;
  try {
    if (!cachedPort) cachedPort = await pickPort();
    if (!cachedPort) return false;
    await writeBytes(cachedPort, OPEN_DRAWER_BYTES);
    return true;
  } catch (e) {
    console.warn("[cashDrawer] falha ao abrir:", e);
    // Porta pode ter sido desconectada — descarta cache p/ próxima tentativa.
    cachedPort = null;
    return false;
  }
}

/** Reseta a porta em cache (usado após trocar de impressora). */
export function resetCashDrawerPort() { cachedPort = null; }

export function isCashDrawerSupported(): boolean {
  return serialAvailable();
}