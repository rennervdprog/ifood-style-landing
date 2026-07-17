/**
 * Leitor da balança Toledo Prix 3/4 via Web Serial (Fase 3 item 11).
 *
 * Protocolo Prix (modo Continuous ou Enquiry):
 *  - Envia ENQ (0x05) e recebe frame ASCII terminado em CR/LF com o peso em kg.
 *  - Formato típico: STX P P P P P P CR ETX (7 dígitos, 3 casas decimais).
 *
 * Este módulo é opt-in via `store.settings.pdv_scale_enabled` e nunca lança —
 * retorna null quando não há suporte ou leitura estável, mantendo entrada manual.
 */

const ENQ = new Uint8Array([0x05]);
let cachedPort: any = null;

function serialAvailable(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

async function ensurePort(): Promise<any | null> {
  if (!serialAvailable()) return null;
  if (cachedPort) return cachedPort;
  const nav = navigator as any;
  try {
    const known = await nav.serial.getPorts();
    if (known && known.length > 0) { cachedPort = known[0]; return cachedPort; }
  } catch {}
  try {
    cachedPort = await nav.serial.requestPort();
    return cachedPort;
  } catch {
    return null;
  }
}

function parseWeightGrams(raw: string): number | null {
  // Remove control chars, mantém dígitos e sinal.
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  // Prix Toledo devolve 6-7 dígitos, 3 casas decimais implícitas se não houver ponto.
  let kg: number;
  if (cleaned.includes(".")) {
    kg = Number(cleaned);
  } else {
    kg = Number(cleaned) / 1000;
  }
  if (!Number.isFinite(kg) || kg <= 0 || kg > 500) return null;
  return Math.round(kg * 1000); // gramas
}

/**
 * Solicita leitura pontual da balança. Retorna gramas ou null.
 */
export async function readScaleGrams(timeoutMs = 1500): Promise<number | null> {
  const port = await ensurePort();
  if (!port) return null;
  try {
    if (!port.readable) await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none" });

    const writer = port.writable.getWriter();
    try { await writer.write(ENQ); } finally { writer.releaseLock(); }

    const reader = port.readable.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    const deadline = Date.now() + timeoutMs;
    try {
      while (Date.now() < deadline) {
        const readPromise = reader.read();
        const timeoutPromise = new Promise<{ value?: Uint8Array; done: boolean }>((resolve) =>
          setTimeout(() => resolve({ done: true }), Math.max(50, deadline - Date.now())),
        );
        const { value, done } = (await Promise.race([readPromise, timeoutPromise])) as any;
        if (done) break;
        if (value) buf += decoder.decode(value);
        // Frame Prix termina em CR (0x0D) — tenta parse assim que aparecer.
        if (buf.includes("\r") || buf.length >= 12) {
          const g = parseWeightGrams(buf);
          if (g != null) return g;
        }
      }
    } finally {
      try { reader.releaseLock(); } catch {}
    }
    return parseWeightGrams(buf);
  } catch (e) {
    console.warn("[toledoScale] falha na leitura:", e);
    cachedPort = null;
    return null;
  }
}

export function isScaleSupported(): boolean {
  return serialAvailable();
}

export function resetScalePort() { cachedPort = null; }