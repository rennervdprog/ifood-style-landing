const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('EXTERNAL_SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY') || Deno.env.get('EXTERNAL_SERVICE_ROLE_KEY')!;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing external Supabase credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Create bucket via storage API (idempotent)
    const createBucket = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 'app-releases',
        name: 'app-releases',
        public: true,
      }),
    });

    const bucketResult = await createBucket.text();
    const bucketStatus = createBucket.status;

    // 2) Test upload to confirm policy works
    const testUpload = await fetch(
      `${SUPABASE_URL}/storage/v1/object/app-releases/setup-test.txt`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'text/plain',
          'x-upsert': 'true',
        },
        body: `Bucket configurado em ${new Date().toISOString()}`,
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        bucket: { status: bucketStatus, response: bucketResult },
        upload_test: { status: testUpload.status, response: await testUpload.text() },
        public_url: `${SUPABASE_URL}/storage/v1/object/public/app-releases/setup-test.txt`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});