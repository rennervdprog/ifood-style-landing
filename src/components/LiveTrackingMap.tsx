import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Bike, Navigation, Home, Store } from "lucide-react";

let leafletCSSLoaded = false;
function ensureLeafletCSS() {
  if (leafletCSSLoaded) return;
  leafletCSSLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

function makeDivIcon(L: any, emoji: string, color: string, shadow: string) {
  return L.divIcon({
    html: `<div style="
      width:36px;height:36px;
      background:linear-gradient(135deg,${color},${shadow});
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 10px ${color}80;border:3px solid white;
    "><span style="font-size:18px;">${emoji}</span></div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function makeDriverIcon(L: any) {
  return L.divIcon({
    html: `<div style="
      width:40px;height:40px;
      background:linear-gradient(135deg,#3b82f6,#1d4ed8);
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 12px rgba(59,130,246,0.5);border:3px solid white;
      animation:pulse-driver 2s ease-out infinite;
    "><span style="font-size:20px;">🏍️</span></div>
    <style>
      @keyframes pulse-driver {
        0%{box-shadow:0 0 0 0 rgba(59,130,246,0.4);}
        70%{box-shadow:0 0 0 15px rgba(59,130,246,0);}
        100%{box-shadow:0 0 0 0 rgba(59,130,246,0);}
      }
    </style>`,
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

interface LiveTrackingMapProps {
  orderId: string;
  driverId: string | null;
  storeId: string;
  clientAddress: string;
  clientLat?: number;
  clientLng?: number;
}

const LiveTrackingMap = ({ orderId, driverId, storeId, clientAddress, clientLat, clientLng }: LiveTrackingMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const clientMarkerRef = useRef<any>(null);
  const storeMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [L, setL] = useState<any>(null);
  const [now, setNow] = useState(Date.now());

  // Tick every 5s for live time display
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // Fetch driver location (poll every 5s)
  const { data: driverLocation } = useQuery({
    queryKey: ["driver-location", orderId, driverId],
    queryFn: async () => {
      if (!driverId) return null;
      const { data } = await supabase
        .from("driver_locations")
        .select("latitude, longitude, speed, heading, updated_at")
        .eq("driver_user_id", driverId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!driverId,
    refetchInterval: 5000,
  });

  // Fetch store coordinates via geocoding (address → lat/lng)
  const { data: storeData } = useQuery({
    queryKey: ["store-geo", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("name, address_street, address_number, address_neighborhood, address_city, address_cep")
        .eq("id", storeId)
        .maybeSingle();
      if (!data) return null;
      // Try to geocode
      const q = `${data.address_street || ""} ${data.address_number || ""}, ${data.address_neighborhood || ""}, ${data.address_city || ""}, Brazil`;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
        const results = await res.json();
        if (results?.[0]) {
          return { name: data.name, lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
        }
      } catch { /* fallback */ }
      return { name: data.name, lat: null as number | null, lng: null as number | null };
    },
    staleTime: 1000 * 60 * 60,
  });

  // Geocode client address
  const { data: clientGeo } = useQuery({
    queryKey: ["client-geo", clientAddress, clientLat, clientLng],
    queryFn: async () => {
      if (clientLat && clientLng) return { lat: clientLat, lng: clientLng };
      if (!clientAddress) return null;
      try {
        const q = `${clientAddress}, Brazil`;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
        const results = await res.json();
        if (results?.[0]) {
          return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
        }
      } catch { /* fallback */ }
      return null;
    },
    staleTime: 1000 * 60 * 60,
    enabled: !!(clientAddress || (clientLat && clientLng)),
  });

  // Load Leaflet
  useEffect(() => {
    ensureLeafletCSS();
    import("leaflet").then((leaflet) => setL(leaflet.default || leaflet));
  }, []);

  // Initialize map
  useEffect(() => {
    if (!L || !mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([-23.25, -48.65], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      driverMarkerRef.current = null;
      clientMarkerRef.current = null;
      storeMarkerRef.current = null;
      routeLineRef.current = null;
      setMapReady(false);
    };
  }, [L]);

  // Update markers and route
  useEffect(() => {
    if (!mapReady || !L || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const points: [number, number][] = [];

    // Driver marker
    if (driverLocation) {
      const dPos: [number, number] = [driverLocation.latitude, driverLocation.longitude];
      points.push(dPos);
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng(dPos);
      } else {
        driverMarkerRef.current = L.marker(dPos, { icon: makeDriverIcon(L) })
          .addTo(map)
          .bindPopup("🏍️ Motoboy a caminho");
      }
    }

    // Store marker
    if (storeData?.lat && storeData?.lng) {
      const sPos: [number, number] = [storeData.lat, storeData.lng];
      points.push(sPos);
      if (!storeMarkerRef.current) {
        storeMarkerRef.current = L.marker(sPos, { icon: makeDivIcon(L, "🏪", "#f59e0b", "#d97706") })
          .addTo(map)
          .bindPopup(`🏪 ${storeData.name || "Loja"}`);
      }
    }

    // Client marker
    if (clientGeo) {
      const cPos: [number, number] = [clientGeo.lat, clientGeo.lng];
      points.push(cPos);
      if (!clientMarkerRef.current) {
        clientMarkerRef.current = L.marker(cPos, { icon: makeDivIcon(L, "🏠", "#10b981", "#059669") })
          .addTo(map)
          .bindPopup("🏠 Seu endereço");
      }
    }

    // Draw route line (driver → client)
    if (driverLocation && clientGeo) {
      const routePoints: [number, number][] = [
        [driverLocation.latitude, driverLocation.longitude],
        [clientGeo.lat, clientGeo.lng],
      ];
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(routePoints);
      } else {
        routeLineRef.current = L.polyline(routePoints, {
          color: "#3b82f6",
          weight: 4,
          opacity: 0.7,
          dashArray: "10, 8",
        }).addTo(map);
      }
    }

    // Fit bounds to show all points
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 16);
    }
  }, [driverLocation, storeData, clientGeo, mapReady, L]);

  // Computed values
  const lastUpdateSec = useMemo(() => {
    if (!driverLocation?.updated_at) return null;
    return Math.round((now - new Date(driverLocation.updated_at).getTime()) / 1000);
  }, [driverLocation?.updated_at, now]);

  const speedKmh = driverLocation?.speed ? Math.round(driverLocation.speed * 3.6) : null;

  const lastUpdateLabel = useMemo(() => {
    if (lastUpdateSec === null) return "";
    if (lastUpdateSec < 10) return "🟢 Agora";
    if (lastUpdateSec < 60) return `${lastUpdateSec}s atrás`;
    return `${Math.round(lastUpdateSec / 60)}min atrás`;
  }, [lastUpdateSec]);

  if (!driverId) {
    return (
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-bold text-primary">
            Aguardando motoboy aceitar o pedido...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/70 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bike className="h-4 w-4 text-primary-foreground" />
          <span className="text-xs font-bold text-primary-foreground">Rastreamento ao vivo</span>
        </div>
        {lastUpdateLabel && (
          <span className="text-[10px] text-primary-foreground/80">{lastUpdateLabel}</span>
        )}
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ height: 250, width: "100%" }} className="bg-muted" />

      {/* Legend */}
      <div className="px-3 py-2 flex items-center gap-4 bg-muted/30 border-t border-border">
        <div className="flex items-center gap-1">
          <span className="text-xs">🏍️</span>
          <span className="text-[10px] text-muted-foreground">Motoboy</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs">🏪</span>
          <span className="text-[10px] text-muted-foreground">Loja</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs">🏠</span>
          <span className="text-[10px] text-muted-foreground">Você</span>
        </div>
        {driverLocation && (
          <div className="ml-auto flex items-center gap-2">
            {speedKmh !== null && speedKmh > 0 && (
              <span className="text-[10px] font-bold text-foreground">🚀 {speedKmh} km/h</span>
            )}
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-green-600 dark:text-green-400">AO VIVO</span>
            </div>
          </div>
        )}
      </div>

      {!driverLocation && (
        <div className="px-3 py-3 text-center">
          <span className="text-xs text-muted-foreground">📡 Aguardando localização do motoboy...</span>
        </div>
      )}
    </div>
  );
};

export default LiveTrackingMap;
