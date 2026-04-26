// ⚠️ FUNÇÃO TEMPORÁRIA - DELETAR APÓS USO ⚠️
// Testa o webhook do Asaas no cérebro externo usando o token da secret

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const EXTERNAL_WEBHOOK_URL = 'https://qkjhguziuchqsbxzruea.supabase.co/functions/v1/asaas-webhook';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const token = Deno.env.get('ASAAS_WEBHOOK_TOKEN');
  const apiKey = Deno.env.get('ASAAS_API_KEY');
  const expectedToken = token || apiKey;

  const results: any = {
    secret_check: {
      ASAAS_WEBHOOK_TOKEN_configured: !!token,
      ASAAS_API_KEY_configured: !!apiKey,
      token_being_used: token ? 'ASAAS_WEBHOOK_TOKEN' : (apiKey ? 'ASAAS_API_KEY (fallback)' : 'NONE'),
      token_length: expectedToken?.length || 0,
      token_preview: expectedToken
        ? `${expectedToken.substring(0, 4)}...${expectedToken.substring(expectedToken.length - 4)}`
        : null,
    },
    tests: [],
  };

  if (!expectedToken) {
    return new Response(
      JSON.stringify({ ...results, error: 'Nenhum token configurado no Lovable' }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  // TESTE A: Token correto + payload válido
  try {
    const fakePayload = {
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_lovable_test_' + Date.now(),
        status: 'RECEIVED',
        value: 0.01,
        externalReference: 'TEST-LOVABLE-' + Date.now(),
        billingType: 'PIX',
      },
    };

    const startTime = Date.now();
    const res = await fetch(EXTERNAL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'asaas-access-token': expectedToken,
      },
      body: JSON.stringify(fakePayload),
    });
    const elapsed = Date.now() - startTime;
    const body = await res.text();

    results.tests.push({
      name: 'A) Token CORRETO + payload válido',
      expected: '200 OK com {received: true}',
      status: res.status,
      latency_ms: elapsed,
      body: tryParseJson(body),
      passed: res.status === 200,
    });
  } catch (err) {
    results.tests.push({
      name: 'A) Token CORRETO + payload válido',
      error: String(err),
      passed: false,
    });
  }

  // TESTE B: Token errado (deve rejeitar)
  try {
    const res = await fetch(EXTERNAL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'asaas-access-token': 'token_propositalmente_errado_xyz',
      },
      body: JSON.stringify({
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'x', status: 'RECEIVED' },
      }),
    });
    const body = await res.text();

    results.tests.push({
      name: 'B) Token ERRADO (deve rejeitar)',
      expected: '401 Unauthorized',
      status: res.status,
      body: tryParseJson(body),
      passed: res.status === 401,
    });
  } catch (err) {
    results.tests.push({
      name: 'B) Token ERRADO',
      error: String(err),
      passed: false,
    });
  }

  // TESTE C: Sem token (deve rejeitar)
  try {
    const res = await fetch(EXTERNAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'x', status: 'RECEIVED' },
      }),
    });
    const body = await res.text();

    results.tests.push({
      name: 'C) SEM token (deve rejeitar)',
      expected: '401 Unauthorized',
      status: res.status,
      body: tryParseJson(body),
      passed: res.status === 401,
    });
  } catch (err) {
    results.tests.push({
      name: 'C) SEM token',
      error: String(err),
      passed: false,
    });
  }

  // Resumo final
  const allPassed = results.tests.every((t: any) => t.passed);
  results.summary = {
    all_passed: allPassed,
    passed_count: results.tests.filter((t: any) => t.passed).length,
    total_count: results.tests.length,
    verdict: allPassed
      ? '✅ TUDO OK! O cérebro externo está validando o token corretamente.'
      : '❌ FALHA: o token salvo aqui é diferente do salvo no cérebro externo, ou a função externa tem outro problema.',
  };

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});

function tryParseJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}