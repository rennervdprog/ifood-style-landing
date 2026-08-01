// Helper AbacatePay — PIX QR Code para cobranças da plataforma (mensalidade/comissão).
// Mais barato que o Asaas por transação PIX. Não faz split (não é mais necessário
// desde que o repasse ao lojista passou a ser via Pix Direto).

export interface AbacatePixResult {
  id: string;
  brCode: string | null;
  brCodeBase64: string | null;
}

export function abacatepayEnabled(): boolean {
  return !!Deno.env.get("ABACATEPAY_API_KEY");
}

export async function createAbacatePix(params: {
  amount: number; // em reais
  description: string;
  externalId: string;
  customer?: { name?: string; email?: string; taxId?: string; cellphone?: string };
  expiresInSeconds?: number;
}): Promise<AbacatePixResult> {
  const key = Deno.env.get("ABACATEPAY_API_KEY");
  if (!key) throw new Error("ABACATEPAY_API_KEY não configurada");

  const body: Record<string, unknown> = {
    amount: Math.round(params.amount * 100), // centavos
    expiresIn: params.expiresInSeconds ?? 60 * 60 * 24, // 24h
    description: String(params.description).substring(0, 140),
    metadata: { externalId: params.externalId },
  };

  const c = params.customer;
  const taxId = String(c?.taxId || "").replace(/\D/g, "");
  if (c && (c.name || c.email)) {
    body.customer = {
      name: c.name || "Lojista",
      email: c.email || `lojista-${params.externalId}@itasuper.com`,
      cellphone: c.cellphone || "(22) 99999-9999",
      taxId: taxId.length >= 11 ? taxId : "529.982.247-25",
    };
  }

  const res = await fetch("https://api.abacatepay.com/v1/pixQrCode/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.error) {
    console.error("[abacatepay] create error", res.status, JSON.stringify(payload));
    throw new Error(payload?.error?.message || payload?.error || "Erro AbacatePay");
  }

  const data = payload?.data || payload;
  return {
    id: String(data?.id || ""),
    brCode: data?.brCode || null,
    brCodeBase64: (data?.brCodeBase64 || "").replace(/^data:image\/\w+;base64,/, "") || null,
  };
}
