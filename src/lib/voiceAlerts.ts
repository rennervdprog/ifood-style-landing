// Avisos por voz do painel do lojista (Web Speech API / speechSynthesis).
//
// A voz é a do próprio aparelho: Windows, Android e Chrome têm vozes em
// português instaladas. Sem custo e sem servidor — a fala é gerada no
// dispositivo do lojista, com o painel aberto.
//
// Configuração por loja (stores.settings):
//   voice_alerts_orders    — fala quando chega pedido novo de fora
//   voice_alerts_attendant — fala quando um cliente pede atendente no WhatsApp
// Os dois começam desligados; o lojista liga nas Configurações → Notificações.

export function isVoiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickPtBrVoice(): SpeechSynthesisVoice | null {
  if (!isVoiceSupported()) return null;
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null; // ainda carregando; tenta de novo na próxima
  const pt = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("pt"));
  cachedVoice =
    pt.find((v) => v.lang.toLowerCase().replace("_", "-") === "pt-br") || pt[0] || null;
  return cachedVoice;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  // As vozes carregam de forma assíncrona em alguns navegadores.
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    cachedVoice = undefined;
  });
}

/**
 * Fala o texto em voz alta (pt-BR). Retorna false quando o aparelho não
 * suporta ou a fala falhou. As falas entram na fila do navegador: uma
 * não interrompe a outra.
 */
export function speakText(text: string): boolean {
  if (!isVoiceSupported() || !text || !text.trim()) return false;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    const voice = pickPtBrVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/** 45.9 -> "45 reais e 90 centavos"; 45 -> "45 reais"; 0.9 -> "90 centavos". */
export function moneyToSpeech(value: number): string {
  const totalCents = Math.round((Number(value) || 0) * 100);
  const reais = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  const reaisPart = reais === 1 ? "1 real" : `${reais} reais`;
  const centsPart = cents === 1 ? "1 centavo" : `${cents} centavos`;
  if (reais > 0 && cents > 0) return `${reaisPart} e ${centsPart}`;
  if (reais > 0) return reaisPart;
  if (cents > 0) return centsPart;
  return "0 reais";
}

/** Frase do aviso de pedido novo, com número e total quando disponíveis. */
export function newOrderSpeech(
  orderNumber?: number | null,
  total?: number | null,
): string {
  const parts = ["Novo pedido!"];
  if (orderNumber != null && Number.isFinite(Number(orderNumber))) {
    parts.push(`Pedido número ${Number(orderNumber)}.`);
  }
  if (total != null && Number.isFinite(Number(total))) {
    parts.push(`Total de ${moneyToSpeech(Number(total))}.`);
  }
  return parts.join(" ");
}

/** Frase do aviso de cliente pedindo atendente humano no WhatsApp. */
export function attendantSpeech(): string {
  return "Cliente solicitando atendimento no WhatsApp.";
}
