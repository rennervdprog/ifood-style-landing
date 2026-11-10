/**
 * Cartão Novidade da Visão Geral (Fase 4 dos tutoriais, 2026-11-10).
 *
 * Cada lançamento do painel ganha UMA entrada nesta lista: o cartão
 * aparece na Visão Geral até o lojista tocar em "Entendi" (a dispensa
 * fica salva por loja neste aparelho). Lançamento novo = 1 item novo
 * no TOPO da lista; os antigos dispensados nunca voltam.
 */
export interface Novidade {
  id: string;
  titulo: string;
  texto: string;
  ctaLabel?: string;
  /** dashboardTab de destino do botão principal. */
  ctaTab?: string;
}

export const NOVIDADES: Novidade[] = [
  {
    id: "avisos-por-voz-2026-11",
    titulo: "O painel agora fala com você",
    texto:
      "Ative os avisos por voz e o painel anuncia em voz alta quando chega um pedido novo ou um cliente chama um atendente — sem precisar ficar olhando pra tela. Fica em Configurações → Notificações e vem desligado por padrão.",
    ctaLabel: "Ativar nas Configurações",
    ctaTab: "settings",
  },
];

/** Chave da dispensa salva, por loja e por novidade. */
export function novidadeStorageKey(storeId: string, novidadeId: string): string {
  return `novidade_dispensada_${storeId}_${novidadeId}`;
}

/** A primeira novidade ainda não dispensada, ou null se não há nada novo. */
export function novidadeVisivel(dispensadas: ReadonlySet<string>): Novidade | null {
  return NOVIDADES.find((n) => !dispensadas.has(n.id)) ?? null;
}
