// One-shot: aplica REVOKE/GRANT no Supabase EXTERNO via Management API.
const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
const PROJECT_REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";

const SQL = `
REVOKE ALL ON public.stores FROM anon;

GRANT SELECT (
  id, name, category, image_url, is_open, rating, created_at, owner_id, status,
  force_closed, slug, address_street, address_number, address_complement,
  address_neighborhood, address_reference, address_city, address_state, address_cep,
  delivery_mode, own_delivery_fee, settings, commission_rate, app_enabled,
  app_subscribed, latitude, longitude, is_test, categories, delivery_fee_type,
  delivery_base_km, delivery_fee_base, delivery_fee_per_km, delivery_enabled,
  delivery_fee, delivery_radius, minimum_order_value, estimated_delivery_time
) ON public.stores TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
`;

Deno.serve(async () => {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: SQL }),
    },
  );
  const text = await r.text();
  return new Response(
    JSON.stringify({ status: r.status, body: text }, null, 2),
    { headers: { "Content-Type": "application/json" } },
  );
});