import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Navigation } from "lucide-react";
import { geocodeAddressPrecise, haversineDistanceMeters, isValidCoordinate, resolveAddressContext } from "@/lib/addressGeocoding";

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

  const isRecentDriverLocation = useMemo(() => {
    if (!driverLocation?.updated_at) return false;
    return now - new Date(driverLocation.updated_at).getTime() <= 60_000;
  }, [driverLocation?.updated_at, now]);

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
        .eq("order_id", orderId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!isValidCoordinate(data?.latitude, data?.longitude)) return null;
      return data;
    },
    enabled: !!driverId,
    refetchInterval: 5000,
  });

  // Fetch store coordinates - prefer stored lat/lng, fallback to structured geocoding
  const { data: storeData } = useQuery({
    queryKey: ["store-geo", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("name, latitude, longitude, address_street, address_number, address_neighborhood, address_city, address_state, address_cep")
        .eq("id", storeId)
        .maybeSingle();
      if (!data) return null;

      // Use stored coordinates if available
      if (isValidCoordinate(data.latitude, data.longitude)) {
        return { name: data.name, lat: data.latitude, lng: data.longitude };
      }

      const context = await resolveAddressContext({
        street: [data.address_street, data.address_number].filter(Boolean).join(" "),
        neighborhood: data.address_neighborhood || undefined,
        city: data.address_city || undefined,
        state: data.address_state || undefined,
        postalcode: data.address_cep || undefined,
      });
      const geo = await geocodeAddressPrecise(context);

      if (geo) {
        // Save coordinates for future use (fire-and-forget)
        supabase
          .from("stores")
          .update({ latitude: geo.lat, longitude: geo.lng } as any)
          .eq("id", storeId)
          .then();
        return { name: data.name, lat: geo.lat, lng: geo.lng };
      }

      return { name: data.name, lat: null as number | null, lng: null as number | null };
    },
    staleTime: 1000 * 60 * 60,
  });

  // Client coordinates - prefer stored lat/lng from order, fallback to structured geocoding
  const { data: clientGeo } = useQuery({
    queryKey: ["client-geo", orderId, clientLat, clientLng, clientAddress],
    queryFn: async () => {
      // Use coordinates passed from order record
      if (clientLat && clientLng) return { lat: clientLat, lng: clientLng };

      // Try to get stored coords from order
      const { data: orderData } = await supabase
        .from("orders")
        .select("client_lat, client_lng, neighborhood, address_details")
        .eq("id", orderId)
        .maybeSingle();

        if (isValidCoordinate((orderData as any)?.client_lat, (orderData as any)?.client_lng)) {
        return { lat: (orderData as any).client_lat, lng: (orderData as any).client_lng };
      }

       if (!clientAddress && !orderData?.address_details) return null;

       const context = await resolveAddressContext({
         street: (clientAddress || orderData?.address_details || "").split(",").slice(0, 2).join(",").trim(),
         neighborhood: orderData?.neighborhood || undefined,
         postalcode: undefined,
       });
       const geo = await geocodeAddressPrecise(context);

      if (geo) {
        // Save to order for future (fire-and-forget)
        supabase
          .from("orders")
          .update({ client_lat: geo.lat, client_lng: geo.lng } as any)
          .eq("id", orderId)
          .then();
        return geo;
      }

      return null;
    },
    staleTime: 1000 * 60 * 60,
    enabled: !!(clientAddress || clientLat || orderId),
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
    if (driverLocation && isRecentDriverLocation) {
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
      if (storeMarkerRef.current) {
        storeMarkerRef.current.setLatLng(sPos);
      } else {
        storeMarkerRef.current = L.marker(sPos, { icon: makeDivIcon(L, "🏪", "#f59e0b", "#d97706") })
          .addTo(map)
          .bindPopup(`🏪 ${storeData.name || "Loja"}`);
      }
    }

    // Client marker
    if (clientGeo) {
      const cPos: [number, number] = [clientGeo.lat, clientGeo.lng];
      points.push(cPos);
      if (clientMarkerRef.current) {
        clientMarkerRef.current.setLatLng(cPos);
      } else {
        clientMarkerRef.current = L.marker(cPos, { icon: makeDivIcon(L, "🏠", "#10b981", "#059669") })
          .addTo(map)
          .bindPopup("🏠 Seu endereço");
      }
    }

    // Draw route line (store → driver → client)
    if (driverLocation && clientGeo && isRecentDriverLocation) {
      const routePoints: [number, number][] = [];
      if (storeData?.lat && storeData?.lng) {
        routePoints.push([storeData.lat, storeData.lng]);
      }
      routePoints.push([driverLocation.latitude, driverLocation.longitude]);
      routePoints.push([clientGeo.lat, clientGeo.lng]);

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
    } else if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    // Fit bounds to show all points
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 16);
    }
  }, [driverLocation, storeData, clientGeo, mapReady, L, isRecentDriverLocation]);

  // Computed values
  const lastUpdateSec = useMemo(() => {
    if (!driverLocation?.updated_at) return null;
    return Math.round((now - new Date(driverLocation.updated_at).getTime()) / 1000);
  }, [driverLocation?.updated_at, now]);

  const speedKmh = driverLocation?.speed ? Math.round(driverLocation.speed * 3.6) : null;

  const routeDistanceKm = useMemo(() => {
    if (!isRecentDriverLocation || !driverLocation || !clientGeo) return null;
    const meters = haversineDistanceMeters(
      { lat: driverLocation.latitude, lng: driverLocation.longitude },
      { lat: clientGeo.lat, lng: clientGeo.lng },
    );
    return Math.round((meters / 1000) * 10) / 10;
  }, [driverLocation, clientGeo, isRecentDriverLocation]);

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
        {driverLocation && isRecentDriverLocation && (
          <div className="ml-auto flex items-center gap-2">
            {speedKmh !== null && speedKmh > 0 && (
              <span className="text-[10px] font-bold text-foreground">🚀 {speedKmh} km/h</span>
            )}
            {routeDistanceKm !== null && (
              <span className="text-[10px] font-bold text-foreground">📍 {routeDistanceKm} km</span>
            )}
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-green-600 dark:text-green-400">AO VIVO</span>
            </div>
          </div>
        )}
      </div>

      {(!driverLocation || !isRecentDriverLocation) && (
        <div className="px-3 py-3 text-center">
          <span className="text-xs text-muted-foreground">📡 Aguardando localização real e atualizada do motoboy...</span>
        </div>
      )}
    </div>
  );
};

export default LiveTrackingMap;
