// ⚠️ FUNÇÃO TEMPORÁRIA - DELETAR APÓS USO ⚠️
// Revela secrets para migração ao cérebro externo

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SECRET_NAMES = [
  'ASAAS_API_KEY',
  'ASAAS_WEBHOOK_TOKEN',
  'ACTIVE_PAYMENT_PROVIDER',
  'APP_URL',
  'MERCADO_PAGO_ACCESS_TOKEN',
  'MERCADO_PAGO_PUBLIC_KEY',
  'MERCADO_PAGO_WEBHOOK_SECRET',
  'EFI_CLIENT_ID',
  'EFI_CLIENT_SECRET',
  'EFI_PIX_KEY',
  'EFI_CERT_PEM',
  'EFI_KEY_PEM',
  'ONESIGNAL_APP_ID',
  'ONESIGNAL_REST_API_KEY',
  'FCM_SERVICE_ACCOUNT_JSON',
  'ZAPI_INSTANCE_ID',
  'ZAPI_TOKEN',
  'ZAPI_CLIENT_TOKEN',
];

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const name of SECRET_NAMES) {
    const value = Deno.env.get(name);
    if (value) {
      result[name] = value;
    } else {
      missing.push(name);
    }
  }

  return new Response(
    JSON.stringify(
      {
        warning: '⚠️ DELETE ESTA FUNÇÃO APÓS COPIAR OS VALORES',
        configured: result,
        missing,
        total_configured: Object.keys(result).length,
        total_missing: missing.length,
      },
      null,
      2
    ),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
});