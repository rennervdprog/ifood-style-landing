import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Lista taxas cobradas pelo Asaas nos últimos N dias (default 30).
// Usa /financialTransactions e agrupa por tipo.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ASAAS_API_KEY não configurado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const baseUrl = apiKey.startsWith("$aact_prod_")
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") || "30");
  const startDate = new Date(Date.now() - days * 24 * 3600 * 1000)
    .toISOString().slice(0, 10);
  const finishDate = new Date().toISOString().slice(0, 10);

  let offset = 0;
  const limit = 100;
  const byType: Record<string, { count: number; total: number }> = {};
  const negatives: Array<{ date: string; type: string; value: number; description: string }> = [];
  let totalIn = 0, totalOut = 0, totalFees = 0;

  try {
    while (true) {
      const res = await fetch(
        `${baseUrl}/financialTransactions?startDate=${startDate}&finishDate=${finishDate}&limit=${limit}&offset=${offset}`,
        { headers: { access_token: apiKey } }
      );
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Erro Asaas", data }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const items = data.data || [];
      if (items.length === 0) break;
      for (const t of items) {
        const type = t.type || "UNKNOWN";
        const value = Number(t.value || 0);
        byType[type] = byType[type] || { count: 0, total: 0 };
        byType[type].count++;
        byType[type].total += value;
        if (value > 0) totalIn += value;
        else totalOut += value;
        // Considera taxa qualquer valor negativo de tipos FEE/CHARGE
        if (value < 0 && /FEE|CHARGE|COST|SMS|DEBIT/i.test(type)) {
          totalFees += value;
          negatives.push({
            date: t.date, type, value,
            description: t.description || "",
          });
        }
      }
      if (items.length < limit) break;
      offset += limit;
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    period: { startDate, finishDate, days },
    summary: { totalIn, totalOut, totalFees, entries: Object.values(byType).reduce((a, b) => a + b.count, 0) },
    byType,
    feeEntries: negatives.slice(0, 200),
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});