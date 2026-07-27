import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Oneshot: percorre `stores` e `saved_addresses` sem lat/lng e geocoda via Nominatim,
// respeitando ~1 req/s. Retorna resumo. Pode ser reexecutado com segurança (idempotente).

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(supabaseUrl, serviceKey);

const UA = 'ItaSuper/1.6 (backfill-coords)';
const SLEEP_MS = 1100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocode(parts: Array<string | null | undefined>): Promise<{ lat: number; lng: number } | null> {
  const q = parts.filter(Boolean).join(', ');
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } });
    if (!r.ok) return null;
    const arr = await r.json();
    const hit = Array.isArray(arr) ? arr[0] : null;
    if (!hit) return null;
    const lat = Number(hit.lat), lng = Number(hit.lon);
    return isFinite(lat) && isFinite(lng) ? { lat, lng } : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
    const target = url.searchParams.get('target') ?? 'both'; // 'stores' | 'addresses' | 'both'

    let storesOk = 0, storesFail = 0, addrOk = 0, addrFail = 0;

    if (target === 'stores' || target === 'both') {
      const { data: rows } = await db
        .from('stores')
        .select('id, address_street, address_number, address_neighborhood, address_city, address_state, address_cep')
        .is('latitude', null)
        .limit(limit);
      for (const s of rows ?? []) {
        const coords = await geocode([
          s.address_street && s.address_number ? `${s.address_street}, ${s.address_number}` : s.address_street,
          s.address_neighborhood, s.address_city, s.address_state, s.address_cep, 'Brasil',
        ]);
        if (coords) {
          await db.from('stores').update({ latitude: coords.lat, longitude: coords.lng }).eq('id', s.id);
          storesOk++;
        } else storesFail++;
        await sleep(SLEEP_MS);
      }
    }

    if (target === 'addresses' || target === 'both') {
      const { data: rows } = await db
        .from('saved_addresses')
        .select('id, street, number, neighborhood, cep')
        .is('latitude', null)
        .limit(limit);
      for (const a of rows ?? []) {
        const coords = await geocode([
          a.street && a.number ? `${a.street}, ${a.number}` : a.street,
          a.neighborhood, a.cep, 'Brasil',
        ]);
        if (coords) {
          await db.from('saved_addresses').update({ latitude: coords.lat, longitude: coords.lng, pin_confirmed: false }).eq('id', a.id);
          addrOk++;
        } else addrFail++;
        await sleep(SLEEP_MS);
      }
    }

    return new Response(JSON.stringify({ ok: true, storesOk, storesFail, addrOk, addrFail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});