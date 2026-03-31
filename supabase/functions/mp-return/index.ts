// This function handles the Mercado Pago redirect back to the app
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_STATUSES = new Set(["success", "failure", "pending"]);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const rawStatus = url.searchParams.get("status") || "pending";
  const rawOrderId = url.searchParams.get("order_id") || "";

  // Validate status against allowlist
  const status = ALLOWED_STATUSES.has(rawStatus) ? rawStatus : "pending";

  // Validate order_id: only allow UUID characters
  const orderId = /^[a-zA-Z0-9\-]{0,64}$/.test(rawOrderId) ? rawOrderId : "";

  const appBaseUrl = Deno.env.get("APP_URL") || "https://id-preview--e8d28ade-d633-4d74-be21-61c8dbe24765.lovable.app";

  let redirectPath = "/pedidos";
  let message = "";

  switch (status) {
    case "success":
      message = "Pagamento confirmado!";
      redirectPath = `/pedidos?payment=success&order=${encodeURIComponent(orderId)}`;
      break;
    case "failure":
      message = "Pagamento não aprovado.";
      redirectPath = `/pedidos?payment=failure&order=${encodeURIComponent(orderId)}`;
      break;
    case "pending":
    default:
      message = "Pagamento pendente...";
      redirectPath = `/pedidos?payment=pending&order=${encodeURIComponent(orderId)}`;
      break;
  }

  const redirectUrl = `${appBaseUrl}${redirectPath}`;
  const safeRedirectUrl = escapeHtml(redirectUrl);
  const safeMessage = escapeHtml(message);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${safeRedirectUrl}">
  <title>${safeMessage} - FoodIta</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { text-align: center; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h2 { color: #333; }
    p { color: #666; }
    a { color: #ef4444; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${safeMessage}</h2>
    <p>Redirecionando para o FoodIta...</p>
    <p><a href="${safeRedirectUrl}">Clique aqui se não for redirecionado</a></p>
  </div>
  <script>window.location.href = ${JSON.stringify(redirectUrl)};</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
