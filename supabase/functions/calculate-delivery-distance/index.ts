import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface Coords { lat: number; lng: number }

interface Body {
  store: { lat?: number | null; lng?: number | null; cep?: string | null };
  customer: {
    lat?: number | null; lng?: number | null;
    cep?: string | null; street?: string | null; number?: string | null;
    neighborhood?: string | null; city?: string | null; state?: string | null;
  };
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(supabaseUrl, serviceKey);

const UA = 'ItaSuper/1.6 (delivery-distance)';

async function cacheGet(key: string) {
  const { data } = await db.from('geocode_cache').select('*').eq('cache_key', key).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}
async function cacheSet(key: string, kind: 'geocode' | 'route', payload: Record<string, unknown>) {
  await db.from('geocode_cache').upsert({ cache_key: key, kind, ...payload }, { onConflict: 'cache_key' });
}

async function geocodeNominatim(addr: Body['customer']): Promise<{ coords: Coords; source: string } | null> {
  const parts: string[] = [];
  if (addr.street) parts.push(addr.number ? `${addr.street}, ${addr.number}` : addr.street);
  if (addr.neighborhood) parts.push(addr.neighborhood);
  if (addr.city) parts.push(addr.city);
  if (addr.state) parts.push(addr.state);
  if (addr.cep) parts.push(addr.cep);
  parts.push('Brasil');
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
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { coords: { lat, lng }, source: addr.street ? 'address' : 'cep' };
  } catch { return null; }
}

function haversineKm(a: Coords, b: Coords) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function osrmRouteKm(origin: Coords, dest: Coords): Promise<{ km: number; minutes: number } | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    const route = j?.routes?.[0];
    if (!route) return null;
    return { km: Number(route.distance) / 1000, minutes: Number(route.duration) / 60 };
  } catch { return null; }
}

function geoKey(a: Body['customer']) {
  const norm = (s?: string | null) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `geo|${norm(a.cep)}|${norm(a.street)}|${norm(a.number)}|${norm(a.neighborhood)}|${norm(a.city)}`;
}
function routeKey(o: Coords, d: Coords) {
  const r = (n: number) => n.toFixed(5);
  return `route|${r(o.lat)},${r(o.lng)}|${r(d.lat)},${r(d.lng)}`;
}

async function resolveCoords(c: Body['customer']): Promise<{ coords: Coords | null; source: string }> {
  if (typeof c.lat === 'number' && typeof c.lng === 'number' && isFinite(c.lat) && isFinite(c.lng)) {
    return { coords: { lat: c.lat, lng: c.lng }, source: 'gps' };
  }
  const key = geoKey(c);
  const cached = await cacheGet(key);
  if (cached && cached.lat != null && cached.lng != null) {
    return { coords: { lat: cached.lat, lng: cached.lng }, source: cached.source || 'cache' };
  }
  const res = await geocodeNominatim(c);
  if (res) {
    await cacheSet(key, 'geocode', { lat: res.coords.lat, lng: res.coords.lng, source: res.source });
    return res;
  }
  return { coords: null, source: 'unknown' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.store || !body?.customer) {
      return new Response(JSON.stringify({ error: 'invalid body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store coords: prefer lat/lng provided; else geocode by CEP
    let storeCoords: Coords | null = null;
    if (typeof body.store.lat === 'number' && typeof body.store.lng === 'number') {
      storeCoords = { lat: body.store.lat, lng: body.store.lng };
    } else if (body.store.cep) {
      const sRes = await resolveCoords({ cep: body.store.cep });
      storeCoords = sRes.coords;
    }

    const cust = await resolveCoords(body.customer);
    if (!storeCoords || !cust.coords) {
      return new Response(JSON.stringify({
        ok: false, distanceKm: null, durationMin: null, accuracy: cust.source, reason: 'coords_unavailable',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Cross-check GPS vs CEP if both available
    let warning: string | null = null;
    if (cust.source === 'gps' && body.customer.cep) {
      const cepRes = await resolveCoords({ cep: body.customer.cep });
      if (cepRes.coords) {
        const divergence = haversineKm(cust.coords, cepRes.coords);
        if (divergence > 2) warning = `gps_cep_diverge_${divergence.toFixed(1)}km`;
      }
    }

    // Route via OSRM with cache
    const rKey = routeKey(storeCoords, cust.coords);
    const cachedRoute = await cacheGet(rKey);
    let km: number | null = null;
    let minutes: number | null = null;
    let routeSource = 'haversine';
    if (cachedRoute?.route_km != null) {
      km = cachedRoute.route_km;
      minutes = cachedRoute.route_minutes;
      routeSource = 'osrm_cache';
    } else {
      const route = await osrmRouteKm(storeCoords, cust.coords);
      if (route) {
        km = route.km; minutes = route.minutes; routeSource = 'osrm';
        await cacheSet(rKey, 'route', { route_km: route.km, route_minutes: route.minutes, source: 'osrm' });
      } else {
        // Fallback: haversine x 1.3 (urban factor) so we don't underestimate
        km = haversineKm(storeCoords, cust.coords) * 1.3;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      distanceKm: km == null ? null : Math.round(km * 10) / 10,
      durationMin: minutes == null ? null : Math.round(minutes),
      accuracy: cust.source, // 'gps' | 'address' | 'cep' | 'cache'
      routeSource,           // 'osrm' | 'osrm_cache' | 'haversine'
      warning,
      storeCoords, customerCoords: cust.coords,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});