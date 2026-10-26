// Fix do rastreio guest — a edge guest-order-status montava o objeto `store`
// com um select que pedia `whatsapp_number` em `stores`, coluna que NÃO
// existe (o PostgREST devolve 400/42703, o select inteiro falha e o objeto
// volta null — a página de rastreio mostrava "Loja" como nome e a seção
// Pix vazia).
//
// O número de WhatsApp da loja vive em `store_whatsapp_config.phone_number`
// (o número conectado como WhatsApp da loja — o mesmo que o bot e os avisos
// usam). A edge é autocontida e NÃO importa este lib (o deploy não sobe
// subdiretórios) — o código lá dentro repete esta mesma composição. Se mudar
// aqui, mudar na edge também (e vice-versa).
export const TRACKING_STORE_COLUMNS =
  "name, slug, pix_direto_enabled, pix_direto_key, pix_direto_key_type, pix_direto_beneficiary, pix_direto_instructions";

export type TrackingStoreRow = {
  name: string | null;
  slug: string | null;
  pix_direto_enabled: boolean | null;
  pix_direto_key: string | null;
  pix_direto_key_type: string | null;
  pix_direto_beneficiary: string | null;
  pix_direto_instructions: string | null;
};

export type TrackingWhatsappRow = { phone_number: string | null };

/**
 * Monta o objeto `store` da resposta do rastreio: os dados da loja mais o
 * número de WhatsApp conectado (ou null, quando a loja não tem WhatsApp
 * conectado — o front só mostra o botão "Falar com a loja" quando há número;
 * nome e Pix continuam vindo normais).
 */
export function composeTrackingStore(
  storeRow: TrackingStoreRow | null,
  whatsappRow: TrackingWhatsappRow | null,
): (TrackingStoreRow & { whatsapp_number: string | null }) | null {
  if (!storeRow) return null;
  return { ...storeRow, whatsapp_number: whatsappRow?.phone_number ?? null };
}
