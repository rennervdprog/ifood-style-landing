import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Bike, Store, Navigation } from "lucide-react";

// Leaflet CSS is loaded dynamically
let leafletCSSLoaded = false;
function ensureLeafletCSS() {
  if (leafletCSSLoaded) return;
  leafletCSSLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

interface LiveTrackingMapProps {
  orderId: string;
  driverId: string | null;
  storeId: string;
  clientAddress: string;
}

const LiveTrackingMap = ({ orderId, driverId, storeId, clientAddress }: LiveTrackingMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [L, setL] = useState<any>(null);

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

  // Fetch store location
  const { data: storeData } = useQuery({
    queryKey: ["store-location", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("name, address_street, address_neighborhood, address_city, address_cep")
        .eq("id", storeId)
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });

  // Load Leaflet dynamically
  useEffect(() => {
    ensureLeafletCSS();
    import("leaflet").then((leaflet) => {
      setL(leaflet.default || leaflet);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!L || !mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([-23.25, -48.65], 14); // Default center (Itatinga area)

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      driverMarkerRef.current = null;
      setMapReady(false);
    };
  }, [L]);

  // Update driver marker
  useEffect(() => {
    if (!mapReady || !L || !mapInstanceRef.current || !driverLocation) return;

    const map = mapInstanceRef.current;
    const lat = driverLocation.latitude;
    const lng = driverLocation.longitude;

    // Custom driver icon
    const driverIcon = L.divIcon({
      html: `<div style="
        width: 40px; height: 40px; 
        background: linear-gradient(135deg, #3b82f6, #1d4ed8); 
        border-radius: 50%; 
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 12px rgba(59,130,246,0.5);
        border: 3px solid white;
        animation: pulse-ring 2s ease-out infinite;
      ">
        <span style="font-size: 20px;">🏍️</span>
      </div>
      <style>
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
          70% { box-shadow: 0 0 0 15px rgba(59,130,246,0); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
        }
      </style>`,
      className: "",
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([lat, lng]);
    } else {
      driverMarkerRef.current = L.marker([lat, lng], { icon: driverIcon })
        .addTo(map)
        .bindPopup("🏍️ Motoboy");
      map.setView([lat, lng], 16);
    }
  }, [driverLocation, mapReady, L]);

  // Time since last update
  const lastUpdate = driverLocation?.updated_at
    ? Math.round((Date.now() - new Date(driverLocation.updated_at).getTime()) / 1000)
    : null;

  const speedKmh = driverLocation?.speed
    ? Math.round((driverLocation.speed * 3.6))
    : null;

  if (!driverId) {
    return (
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-500 animate-pulse" />
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
            Aguardando motoboy aceitar o pedido...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card">
      {/* Map header */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bike className="h-4 w-4 text-white" />
          <span className="text-xs font-bold text-white">
            Rastreamento ao vivo
          </span>
        </div>
        {lastUpdate !== null && (
          <span className="text-[10px] text-white/80">
            {lastUpdate < 10 ? "🟢 Agora" : lastUpdate < 60 ? `${lastUpdate}s atrás` : `${Math.round(lastUpdate / 60)}min atrás`}
          </span>
        )}
      </div>

      {/* Map container */}
      <div ref={mapRef} style={{ height: 220, width: "100%" }} className="bg-muted" />

      {/* Info bar */}
      {driverLocation && (
        <div className="px-3 py-2 flex items-center justify-between bg-muted/50 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" />
              <span className="text-[10px] text-muted-foreground">
                {driverLocation.latitude.toFixed(4)}, {driverLocation.longitude.toFixed(4)}
              </span>
            </div>
            {speedKmh !== null && speedKmh > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-foreground">
                  🚀 {speedKmh} km/h
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-green-600 dark:text-green-400">AO VIVO</span>
          </div>
        </div>
      )}

      {!driverLocation && (
        <div className="px-3 py-3 text-center">
          <span className="text-xs text-muted-foreground">
            📡 Aguardando localização do motoboy...
          </span>
        </div>
      )}
    </div>
  );
};

export default LiveTrackingMap;
