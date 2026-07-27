import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface Coords { lat: number; lng: number }
interface StoreIn { id: string; lat?: number | null; lng?: number | null; cep?: string | null }
interface Body {
  customer: { lat?: number | null; lng?: number | null; cep?: string | null; street?: string | null; number?: string | null; neighborhood?: string | null; city?: string | null; state?: string | null };
  stores: StoreIn[];
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(supabaseUrl, serviceKey);

const UA = 'ItaSuper/1.6 (batch-store-distances)';
const URBAN = 1.3;

function haversineKm(a: Coords, b: Coords) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function routeKey(o: Coords, d: Coords) {
  const r = (n: number) => n.toFixed(5);
  return `route|${r(o.lat)},${r(o.lng)}|${r(d.lat)},${r(d.lng)}`;
}

async function cacheGet(key: string) {
  const { data } = await db.from('geocode_cache').select('*').eq('cache_key', key).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}
async function cacheSet(key: string, payload: Record<string, unknown>) {
  await db.from('geocode_cache').upsert({ cache_key: key, kind: 'route', ...payload }, { onConflict: 'cache_key' });
}

async function osrmRouteKm(o: Coords, d: Coords): Promise<{ km: number; minutes: number } | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=false`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    const route = j?.routes?.[0];
    if (!route) return null;
    return { km: Number(route.distance) / 1000, minutes: Number(route.duration) / 60 };
  } catch { return null; }
}

async function resolveOne(cust: Coords, s: StoreIn) {
  if (typeof s.lat !== 'number' || typeof s.lng !== 'number') {
    return { id: s.id, distanceKm: null as number | null, durationMin: null as number | null, source: 'no_coords' };
  }
  const dest: Coords = { lat: s.lat, lng: s.lng };
  const key = routeKey(cust, dest);
  const cached = await cacheGet(key);
  if (cached?.route_km != null) {
    return { id: s.id, distanceKm: Math.round(cached.route_km * 10) / 10, durationMin: cached.route_minutes ?? null, source: 'osrm_cache' };
  }
  const route = await osrmRouteKm(cust, dest);
  if (route) {
    await cacheSet(key, { route_km: route.km, route_minutes: route.minutes, source: 'osrm' });
    return { id: s.id, distanceKm: Math.round(route.km * 10) / 10, durationMin: Math.round(route.minutes), source: 'osrm' };
  }
  const km = haversineKm(cust, dest) * URBAN;
  return { id: s.id, distanceKm: Math.round(km * 10) / 10, durationMin: null, source: 'haversine' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    const cust = body?.customer;
    if (!cust || typeof cust.lat !== 'number' || typeof cust.lng !== 'number') {
      return new Response(JSON.stringify({ error: 'customer coords required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const stores = Array.isArray(body.stores) ? body.stores.slice(0, 60) : [];
    // Executa em lotes de 8 para não estourar rate limit do OSRM público.
    const results: any[] = [];
    const CHUNK = 8;
    for (let i = 0; i < stores.length; i += CHUNK) {
      const chunk = stores.slice(i, i + CHUNK);
      const r = await Promise.all(chunk.map((s) => resolveOne({ lat: cust.lat as number, lng: cust.lng as number }, s)));
      results.push(...r);
    }
    return new Response(JSON.stringify({ ok: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});