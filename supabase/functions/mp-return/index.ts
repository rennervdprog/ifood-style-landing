// This function handles the Mercado Pago redirect back to the app
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "pending";
  const orderId = url.searchParams.get("order_id") || "";

  // Get the app URL - redirect to the preview/published app
  // We use a meta refresh to redirect to the app's pedidos page
  const appBaseUrl = Deno.env.get("APP_URL") || "https://id-preview--e8d28ade-d633-4d74-be21-61c8dbe24765.lovable.app";

  let redirectPath = "/pedidos";
  let message = "";

  switch (status) {
    case "success":
      message = "Pagamento confirmado!";
      redirectPath = `/pedidos?payment=success&order=${orderId}`;
      break;
    case "failure":
      message = "Pagamento não aprovado.";
      redirectPath = `/pedidos?payment=failure&order=${orderId}`;
      break;
    case "pending":
    default:
      message = "Pagamento pendente...";
      redirectPath = `/pedidos?payment=pending&order=${orderId}`;
      break;
  }

  const redirectUrl = `${appBaseUrl}${redirectPath}`;

  // Return HTML that redirects to the app
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <title>${message} - ItaFood</title>
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
    <h2>${message}</h2>
    <p>Redirecionando para o ItaFood...</p>
    <p><a href="${redirectUrl}">Clique aqui se não for redirecionado</a></p>
  </div>
  <script>window.location.href = "${redirectUrl}";</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
