const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const id = "b97f3a1a-d558-41e5-b8a2-ebd65b5381b4";

  // Busca dados atuais
  const cur = await fetch(`${url}/rest/v1/stores?id=eq.${id}&select=name,address_cep,address_street,address_number,address_neighborhood,address_city,address_state,latitude,longitude`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  }).then((r) => r.json());
  const s = cur?.[0];
  if (!s) return new Response(JSON.stringify({ error: "store_not_found" }), { status: 404, headers: cors });

  const parts = [
    s.address_street && s.address_number ? `${s.address_street}, ${s.address_number}` : s.address_street,
    s.address_neighborhood, s.address_city, s.address_state, s.address_cep, "Brasil",
  ].filter(Boolean).join(", ");

  const tryGeocode = async (q: string) => {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "ItaSuper/1.0 (oneshot-fix)", "Accept-Language": "pt-BR" },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    const hit = Array.isArray(arr) ? arr[0] : null;
    if (!hit) return null;
    return { lat: Number(hit.lat), lng: Number(hit.lon) };
  };

  let hit = await tryGeocode(parts);
  if (!hit && s.address_cep) hit = await tryGeocode(`${s.address_cep}, Armação dos Búzios, RJ, Brasil`);
  if (!hit) return new Response(JSON.stringify({ error: "geocode_failed", tried: parts, store: s }), { status: 422, headers: { ...cors, "Content-Type": "application/json" } });

  const upd = await fetch(`${url}/rest/v1/stores?id=eq.${id}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ latitude: hit.lat, longitude: hit.lng }),
  }).then((r) => r.json());

  return new Response(JSON.stringify({ ok: true, before: { lat: s.latitude, lng: s.longitude }, after: hit, address: parts, updated: upd }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});