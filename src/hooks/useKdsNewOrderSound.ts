import { useCallback, useEffect, useRef, useState } from "react";
import { ALERT_SOUND_URL } from "@/pages/admin/constants";

/**
 * Item 4 do plano do KDS (17/11/2026) — som de pedido novo nas duas telas
 * do KDS (link e PDV).
 *
 * Reaproveita o som padrão de pedido novo do projeto (`ALERT_SOUND_URL`, o
 * mesmo sino do painel do admin e dos alertas do PDV) e o mesmo portão de
 * autoplay: o som só toca depois que o usuário toca em "Ativar som" — o
 * gesto destrava o áudio no navegador. Sem o gesto, nenhum som toca.
 *
 * Comportamento:
 * - A primeira lista recebida é marcada como vista, sem tocar (os pedidos
 *   que já estavam na tela quando ela abriu não apitam).
 * - A cada atualização, se algum id novo aparecer na lista, o sino toca
 *   uma vez. Atualizações sem pedido novo não tocam nada.
 * - Se o navegador bloquear o `play()`, o aviso "toque para ativar o som"
 *   volta a aparecer.
 *
 * A parte opcional do item 4 (som distinto/repetição ao cruzar o limiar de
 * atraso) NÃO está aqui — decisão pendente, fora deste conserto.
 */
export function useKdsNewOrderSound(orderIds: readonly string[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seenIdsRef = useRef<Set<string> | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  // Espelho em ref para o `playAlert` não depender do estado (evita
  // re-disparar o efeito de detecção quando o usuário muta/desmuta).
  const gateRef = useRef({ enabled: false, muted: false });
  gateRef.current = { enabled: soundEnabled, muted: soundMuted };

  const playAlert = useCallback(() => {
    if (!gateRef.current.enabled || gateRef.current.muted) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(ALERT_SOUND_URL);
        audioRef.current.volume = 1.0;
      }
      // O sino tem ~4,5s; sem voltar ao início, um segundo pedido novo
      // dentro da janela não re-dispararia o som.
      audioRef.current.currentTime = 0;
      const p = audioRef.current.play();
      // Bloqueio do navegador: o som volta a exigir um gesto do usuário
      // (o aviso "toque para ativar o som" reaparece).
      if (p) p.catch(() => { setSoundBlocked(true); setSoundEnabled(false); });
    } catch {
      setSoundBlocked(true);
      setSoundEnabled(false);
    }
  }, []);

  // Chamado por gesto do usuário (clique no botão): é o que destrava o
  // autoplay. Toca o sino uma vez como confirmação audível.
  const activateSound = useCallback(() => {
    const audio = new Audio(ALERT_SOUND_URL);
    audio.volume = 1.0;
    try {
      const p = audio.play();
      if (p) {
        p.then(() => {
          audioRef.current = audio;
          setSoundEnabled(true);
          setSoundBlocked(false);
        }).catch(() => setSoundBlocked(true));
      } else {
        audioRef.current = audio;
        setSoundEnabled(true);
        setSoundBlocked(false);
      }
    } catch {
      setSoundBlocked(true);
    }
  }, []);

  const toggleMuted = useCallback(() => setSoundMuted((m) => !m), []);

  useEffect(() => {
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(orderIds);
      return;
    }
    const seen = seenIdsRef.current;
    const hasNew = orderIds.some((id) => !seen.has(id));
    seenIdsRef.current = new Set(orderIds);
    if (hasNew) playAlert();
  }, [orderIds, playAlert]);

  return { soundEnabled, soundMuted, soundBlocked, activateSound, toggleMuted };
}
