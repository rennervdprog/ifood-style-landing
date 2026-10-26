// Mapeamento bot -> RPC `create_order_with_items` (Fase 1 do plano guest/bot).
//
// Módulo PURO: sem Deno, sem Supabase, sem imports — o handler
// (`index.ts`) importa daqui e o Vitest testa daqui (`src/lib/__tests__/
// whatsappBotOrderMapping.test.ts`). Nada aqui pode ganhar dependência de
// runtime: é o contrato entre o carrinho do bot e o que a RPC valida.
//
// Regras que este arquivo consolida:
// - Adicional: a RPC lê `create_order_lookup_addon` com as chaves camelCase
//   `groupId`/`groupName`/`id`/`name`. O carrinho do bot guarda `id` (UUID do
//   item do catálogo) desde a escolha — sem ele a RPC cai para busca por nome
//   e nomes de sabor se repetem entre os tamanhos (P1-6).
// - Pagamento: o vocabulário do bot (pix/cash/card) vira o do site antes de
//   chamar a RPC — pix -> pix_machine, cash -> dinheiro, card -> cartao;
//   pix_direto não muda. As mensagens do bot mantêm o vocabulário dele.
// - Mínimo: a pré-checagem antes da confirmação é fail-closed — leitura da
//   loja falhou (mínimo desconhecido) = segurar a sessão e pedir para tentar
//   de novo, nunca assumir mínimo 0 (decideMinimumGate).
// - Preço do cliente vira referência: a RPC recalcula tudo pelo catálogo.

export type BotPaymentMethod = string;

export const BOT_PAYMENT_TO_RPC: Record<string, string> = {
  pix: "pix_machine",
  cash: "dinheiro",
  card: "cartao",
  pix_direto: "pix_direto",
};

/** Vocabulário do bot -> vocabulário do site/RPC. Desconhecido passa direto. */
export function mapPaymentMethodToRpc(botMethod: BotPaymentMethod): string {
  return BOT_PAYMENT_TO_RPC[botMethod] ?? botMethod;
}

export interface BotCartAddon {
  id?: string | null;
  group_id?: string | null;
  groupId?: string | null;
  group_name?: string | null;
  groupName?: string | null;
  name: string;
  price: number;
}

export interface BotCartItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  addons?: BotCartAddon[] | null;
  observations?: string | null;
}

export interface RpcOrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  addons: Array<{
    id: string | null;
    groupId: string | null;
    groupName: string | null;
    name: string;
    price: number;
  }>;
  observations: string | null;
}

/**
 * Carrinho da sessão -> `p_items` no formato que a RPC valida.
 * Sem o `id` do adicional a RPC cai para busca por nome; com ele, resolve
 * pelo UUID dentro do grupo. `null` explícito = "não informado" (a RPC trata
 * como ausente e cai para o nome) — cobre sessões em andamento no deploy.
 */
export function mapCartToRpcItems(cart: BotCartItem[]): RpcOrderItem[] {
  return (cart || []).map((i) => ({
    product_id: i.product_id,
    quantity: i.quantity,
    unit_price: i.unit_price,
    addons: (i.addons || []).map((a) => ({
      id: a.id ?? null,
      groupId: a.groupId ?? a.group_id ?? null,
      groupName: a.groupName ?? a.group_name ?? null,
      name: a.name,
      price: a.price,
    })),
    observations: i.observations || null,
  }));
}

/** Número curto do pedido: prefixo do UUID, igual ao painel (#2A27F312). */
export function shortOrderCode(orderId: string): string {
  return `#${String(orderId || "").slice(0, 8).toUpperCase()}`;
}

/** Link de acompanhamento público do pedido (PIN = últimos 4 do telefone). */
export function buildTrackingLink(orderId: string, phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return `https://www.itasuper.com.br/p/${orderId}?t=${digits.slice(-4)}`;
}

export type RpcErrorKind =
  | "closed"
  | "below_minimum"
  | "price_changed"
  | "unavailable"
  | "unknown";

export function classifyRpcError(message: string): RpcErrorKind {
  const m = String(message || "").toLowerCase();
  if (m.includes("loja fechada")) return "closed";
  if (m.includes("pedido mínimo")) return "below_minimum";
  if (m.includes("divergente") || m.includes("revise o carrinho")) return "price_changed";
  if (
    m.includes("indisponível") ||
    m.includes("indisponivel") ||
    m.includes("não foi encontrado") ||
    m.includes("não pertence") ||
    m.includes("produto do pedido inválido")
  ) {
    return "unavailable";
  }
  return "unknown";
}

/**
 * Exceção da RPC -> mensagem amigável no WhatsApp. A sessão é mantida em
 * todos os casos (o cliente não perde o pedido); preço divergente e item
 * indisponível pedem para cancelar e montar de novo — o carrinho com o
 * preço velho não passa na RPC de novo.
 */
export function translateRpcError(message: string): { kind: RpcErrorKind; text: string } {
  const kind = classifyRpcError(message);
  switch (kind) {
    case "closed":
      return {
        kind,
        text: "🌙 A loja está fechada no momento — não consegui confirmar seu pedido.\n\nQuando abrir, é só mandar *MENU* que te atendo. 💚",
      };
    case "below_minimum": {
      const min = String(message || "").match(/R\$ ?[\d.,]+/);
      return {
        kind,
        text: `⚠️ O pedido mínimo desta loja é ${min ? min[0] : "maior que o subtotal"} — seu carrinho ficou abaixo dele.\n\nAdicione mais itens e tente de novo, ou responda *2* para cancelar. 🙂`,
      };
    }
    case "price_changed":
      return {
        kind,
        text: "⚠️ O preço de um item mudou enquanto você montava o pedido — não consegui confirmar com o valor antigo.\n\nResponda *2* para cancelar e montar o pedido de novo com os preços atualizados.",
      };
    case "unavailable":
      return {
        kind,
        text: "⚠️ Um item do seu pedido ficou indisponível — não consegui confirmar.\n\nResponda *2* para cancelar e montar o pedido de novo.",
      };
    default:
      return {
        kind,
        text: "❌ Não consegui confirmar seu pedido agora. Um atendente já vai te chamar — seu carrinho continua aqui. 🙂",
      };
  }
}

export type MinimumGateDecision =
  | { action: "show_confirmation" }
  | { action: "below_minimum"; missing: number }
  | { action: "minimum_unknown" };

/**
 * Pré-checagem do pedido mínimo antes da confirmação (Fase 1, decisão c).
 * `minimumOrderValue === null` = a leitura da loja falhou (ou a loja não
 * existe): o mínimo é DESCONHECIDO e a decisão é fail-closed — nunca
 * assumir mínimo 0 e mostrar a confirmação. O chamador segura a sessão
 * (sem avançar o passo, sem gerar idempotency_key) e pede para tentar de
 * novo; a próxima mensagem do cliente relê a loja. Mínimo 0 (ou ausente
 * na loja carregada) = sem mínimo, confirma normal. A RPC continua sendo
 * a trava final em todos os casos.
 */
export function decideMinimumGate(
  subtotal: number,
  minimumOrderValue: number | null | undefined,
): MinimumGateDecision {
  if (
    minimumOrderValue === null ||
    minimumOrderValue === undefined ||
    !Number.isFinite(minimumOrderValue)
  ) {
    return { action: "minimum_unknown" };
  }
  const minimum = Number(minimumOrderValue);
  if (minimum > 0 && subtotal < minimum) {
    return {
      action: "below_minimum",
      missing: Math.round((minimum - subtotal) * 100) / 100,
    };
  }
  return { action: "show_confirmation" };
}

export interface DeliveryQuoteSnapshot {
  policy_version: number;
  distance_km: number;
  distance_source: string;
  max_delivery_km: number | null;
  destination_precision: string;
  store_delivery_base: number;
  platform_fee_customer: number;
  platform_fee_store_absorbed: number;
  delivery_fee: number;
  vip_override_applied: unknown;
  split_mode: unknown;
  plan_type: unknown;
}

/**
 * Snapshot da cotação no formato que a RPC grava em `metadata.delivery_quote`
 * — o mesmo que a edge guest-checkout monta. A RPC não aceita o quote cheio.
 */
export function buildDeliveryQuoteSnapshot(
  quote: any,
  deliveryFee: number,
  precisionFallback = "cep",
): DeliveryQuoteSnapshot | null {
  if (!quote) return null;
  return {
    policy_version: quote.policy_version || 1,
    distance_km: Number(quote.distance?.km || 0),
    distance_source: quote.distance?.source || "haversine",
    max_delivery_km: quote.distance?.max_km ?? null,
    destination_precision: quote.destination?.precision || precisionFallback,
    store_delivery_base: Number(quote.pricing?.store_delivery_base || 0),
    platform_fee_customer: Number(quote.pricing?.platform_fee_customer || 0),
    platform_fee_store_absorbed: Number(quote.pricing?.platform_fee_store_absorbed || 0),
    delivery_fee: deliveryFee,
    vip_override_applied: quote.pricing?.vip_override_applied ?? null,
    split_mode: quote.pricing?.split_mode ?? null,
    plan_type: quote.pricing?.plan_type ?? null,
  };
}

/**
 * Campos que o bot acrescenta ao `metadata` do pedido depois da RPC.
 * A RPC monta o metadata só a partir do delivery_quote (e vasilhames) — o
 * resto do que o painel/debug lê hoje volta aqui, por cima do que a RPC
 * gravou (o merge é feito no handler, sem apagar o delivery_quote).
 */
export function buildBotMetadataPatch(
  context: {
    customer_name?: string | null;
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    reference?: string | null;
  },
  phone: string,
): Record<string, unknown> {
  return {
    source: "whatsapp_bot",
    customer_phone: phone,
    customer_name: context.customer_name || null,
    address_street: context.street || null,
    address_number: context.number || null,
    address_neighborhood: context.neighborhood || null,
    address_reference: context.reference || null,
  };
}

/**
 * Envio best-effort: um envio que pode falhar (instância desconectada,
 * teto atingido) nunca pode abortar a transição do fluxo — a sessão já
 * foi (ou vai ser) gravada pelo passo seguinte. Devolve false quando o
 * envio falhou, sem lançar. Usado nos envios que antecedem uma transição
 * (saudações "Perfeito"/"Prazer", descrição do produto, aviso de mínimo).
 */
export async function sendBestEffort(
  send: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await send();
    return true;
  } catch (e) {
    console.error(
      "[bot] sendBestEffort failed (flow continues)",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}
