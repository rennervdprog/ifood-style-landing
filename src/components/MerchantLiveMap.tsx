import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { haversineMeters, isValidCoordinate } from "@/lib/location";
import { fetchOsrmRoute } from "@/lib/osrmRouting";

// Mapa ao vivo do lojista: mostra o motoboy da loja a caminho do cliente,
// SOMENTE enquanto o pedido está em entrega (saiu_entrega/em_transito).
// Sem marcador da loja (regra do Renner, 2026-10-11). A posição vem de
// driver_locations (1 linha por motoboy) via Realtime; o lojista só lê as
// linhas dos pedidos da própria loja (RLS "Store owners can read...").

let leafletCSSLoaded = false;
function ensureLeafletCSS() {
  if (leafletCSSLoaded) return;
  leafletCSSLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

function makeDriverIcon(L: any) {
  return L.divIcon({
    html: `<div style="
      width:40px;height:40px;
      background:#FF6A00;
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 12px rgba(255,106,0,0.5);border:3px solid white;
    "><span style="font-size:20px;">🏍️</span></div>`,
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function makeHomeIcon(L: any) {
  return L.divIcon({
    html: `<div style="
      width:36px;height:36px;
      background:#18181b;
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 10px rgba(0,0,0,0.45);border:3px solid white;
    "><span style="font-size:17px;">🏠</span></div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

interface MerchantLiveMapProps {
  orderId: string;
  driverId: string | null;
  driverName: string;
  clientLat?: number | null;
  clientLng?: number | null;
}

export default function MerchantLiveMap({ orderId, driverId, driverName, clientLat, clientLng }: MerchantLiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const clientMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const animRef = useRef<number | null>(null);
  const [L, setL] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const { data: driverLocation } = useQuery({
    queryKey: ["merchant-driver-location", driverId],
    queryFn: async () => {
      if (!driverId) return null;
      const { data } = await supabase
        .from("driver_locations")
        .select("latitude, longitude, accuracy, speed, updated_at")
        .eq("driver_user_id", driverId)
        .maybeSingle();
      if (!isValidCoordinate(data?.latitude, data?.longitude)) return null;
      return data as any;
    },
    enabled: !!driverId,
    refetchInterval: 30000,
  });

  // Realtime: posição nova chega na hora, sem polling.
  useEffect(() => {
    if (!driverId) return;
    const channelName = `merchant-driver-${driverId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(channelName);
    channel.on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "driver_locations", filter: `driver_user_id=eq.${driverId}` },
      (payload: any) => {
        const n = payload.new as any;
        if (n && isValidCoordinate(n.latitude, n.longitude)) {
          queryClient.setQueryData(["merchant-driver-location", driverId], {
            latitude: n.latitude,
            longitude: n.longitude,
            accuracy: n.accuracy,
            speed: n.speed,
            updated_at: n.updated_at,
          });
        }
      }
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, queryClient]);

  useEffect(() => {
    ensureLeafletCSS();
    import("leaflet").then((leaflet) => setL(leaflet.default || leaflet));
  }, []);

  useEffect(() => {
    if (!L || !mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([-22.86, -42.33], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapInstanceRef.current = map;
    setMapReady(true);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      map.remove();
      mapInstanceRef.current = null;
      driverMarkerRef.current = null;
      clientMarkerRef.current = null;
      accuracyCircleRef.current = null;
      routeLineRef.current = null;
      setMapReady(false);
    };
  }, [L]);

  const isRecent = driverLocation?.updated_at
    ? now - new Date(driverLocation.updated_at).getTime() <= 120_000
    : false;

  useEffect(() => {
    if (!mapReady || !L || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const points: [number, number][] = [];
    const clientOk = isValidCoordinate(clientLat, clientLng);
    const cPos: [number, number] | null = clientOk ? [clientLat as number, clientLng as number] : null;

    if (cPos) {
      points.push(cPos);
      if (clientMarkerRef.current) clientMarkerRef.current.setLatLng(cPos);
      else clientMarkerRef.current = L.marker(cPos, { icon: makeHomeIcon(L) }).addTo(map).bindPopup("🏠 Cliente");
    }

    if (driverLocation && isRecent) {
      const dPos: [number, number] = [driverLocation.latitude, driverLocation.longitude];
      points.push(dPos);
      if (driverMarkerRef.current) {
        // Desliza o marcador até a posição nova (sem pulo).
        if (animRef.current) cancelAnimationFrame(animRef.current);
        const from = driverMarkerRef.current.getLatLng();
        const start = performance.now();
        const dur = 4000;
        const stepFn = (tNow: number) => {
          const t = Math.min(1, (tNow - start) / dur);
          driverMarkerRef.current?.setLatLng([
            from.lat + (dPos[0] - from.lat) * t,
            from.lng + (dPos[1] - from.lng) * t,
          ]);
          if (t < 1) animRef.current = requestAnimationFrame(stepFn);
        };
        animRef.current = requestAnimationFrame(stepFn);
      } else {
        driverMarkerRef.current = L.marker(dPos, { icon: makeDriverIcon(L) }).addTo(map).bindPopup(`🏍️ ${driverName}`);
      }
      // Círculo de precisão: aparece quando o sinal está fraco (> 25 m).
      const acc = typeof driverLocation.accuracy === "number" ? driverLocation.accuracy : null;
      if (acc && acc > 25) {
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng(dPos);
          accuracyCircleRef.current.setRadius(acc);
        } else {
          accuracyCircleRef.current = L.circle(dPos, {
            radius: acc,
            color: "#FF6A00",
            weight: 1,
            opacity: 0.55,
            fillColor: "#FF6A00",
            fillOpacity: 0.12,
          }).addTo(map);
        }
      } else if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
      // Rota pelas ruas (OSRM) motoboy → cliente; cai p/ linha reta se falhar.
      if (cPos) {
        const apply = (latlngs: [number, number][]) => {
          if (routeLineRef.current) routeLineRef.current.setLatLngs(latlngs);
          else routeLineRef.current = L.polyline(latlngs, { color: "#FF6A00", weight: 4, opacity: 0.75 }).addTo(map);
        };
        apply([dPos, cPos]);
        fetchOsrmRoute([dPos, cPos]).then((r) => {
          if (r && routeLineRef.current && mapInstanceRef.current) apply(r.geometry);
        });
      }
    } else {
      if (driverMarkerRef.current) {
        map.removeLayer(driverMarkerRef.current);
        driverMarkerRef.current = null;
      }
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
    }

    if (points.length >= 2) map.fitBounds(L.latLngBounds(points), { padding: [42, 42], maxZoom: 16 });
    else if (points.length === 1) map.setView(points[0], 16);
  }, [driverLocation, isRecent, clientLat, clientLng, mapReady, L, driverName]);

  const lastUpdateSec = driverLocation?.updated_at
    ? Math.round((now - new Date(driverLocation.updated_at).getTime()) / 1000)
    : null;
  const distanceKm =
    driverLocation && isRecent && isValidCoordinate(clientLat, clientLng)
      ? Math.round((haversineMeters(
          { lat: driverLocation.latitude, lng: driverLocation.longitude },
          { lat: clientLat as number, lng: clientLng as number }
        ) / 1000) * 10) / 10
      : null;
  const speedKmh = driverLocation?.speed ? Math.round(driverLocation.speed * 3.6) : null;
  const etaMinutes =
    distanceKm && speedKmh && speedKmh >= 5
      ? Math.round((distanceKm / speedKmh) * 60)
      : null;
  const weakSignal = !!(driverLocation && typeof driverLocation.accuracy === "number" && driverLocation.accuracy > 25);

  return (
    <div className="mx-3 mb-2 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between bg-primary px-3 py-2">
        <span className="text-xs font-bold text-primary-foreground">🛵 {driverName} — ao vivo</span>
        <span className="flex items-center gap-2">
          {etaMinutes ? (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-primary-foreground">~{etaMinutes} min</span>
          ) : null}
          {lastUpdateSec !== null && isRecent ? (
            <span className="text-[10px] text-primary-foreground/85">{lastUpdateSec < 10 ? "agora" : `há ${lastUpdateSec}s`}</span>
          ) : null}
        </span>
      </div>
      <div ref={mapRef} style={{ height: 230, width: "100%" }} className="bg-muted" />
      <div className="flex items-center gap-3 border-t border-border bg-muted/30 px-3 py-2">
        <span className="text-[10px] text-muted-foreground">🏍️ Motoboy</span>
        <span className="text-[10px] text-muted-foreground">🏠 Cliente</span>
        {driverLocation && isRecent ? (
          <span className="ml-auto flex items-center gap-2">
            {distanceKm !== null ? <span className="text-[10px] font-bold text-foreground">📍 {distanceKm} km</span> : null}
            {weakSignal ? <span className="text-[10px] font-bold text-foreground">📡 sinal fraco</span> : null}
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-[10px] font-bold text-green-600 dark:text-green-400">AO VIVO</span>
            </span>
          </span>
        ) : (
          <span className="ml-auto text-[10px] text-muted-foreground">📡 Aguardando localização…</span>
        )}
      </div>
    </div>
  );
}
