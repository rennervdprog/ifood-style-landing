import { useEffect, useRef, useState } from "react";
import { MapPin, Crosshair, Check, Loader2 } from "lucide-react";
import { reverseGeocode } from "@/lib/location";
import { readGps } from "@/lib/location/gps";
import { toast } from "sonner";

let leafletCSSLoaded = false;
function ensureLeafletCSS() {
  if (leafletCSSLoaded) return;
  leafletCSSLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

interface Props {
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (coords: { lat: number; lng: number }, reverse?: { street?: string | null; number?: string | null; neighborhood?: string | null; postalcode?: string | null } | null) => void;
  onCancel?: () => void;
  height?: number;
}

/**
 * Seletor visual de pino no mapa (Leaflet + OSM).
 * Usado para o usuário confirmar a localização exata do endereço.
 */
const AddressPinPicker = ({ initialLat, initialLng, onConfirm, onCancel, height = 320 }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [L, setL] = useState<any>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  );
  const [loadingGps, setLoadingGps] = useState(false);
  const [reversing, setReversing] = useState(false);

  useEffect(() => {
    ensureLeafletCSS();
    import("leaflet").then((mod) => setL(mod.default ?? mod));
  }, []);

  useEffect(() => {
    if (!L || !mapRef.current || mapInstanceRef.current) return;
    const start: [number, number] = coords ? [coords.lat, coords.lng] : [-23.55, -46.63];
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(start, coords ? 17 : 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    const icon = L.divIcon({
      html: `<div style="width:32px;height:32px;background:linear-gradient(135deg,#ef4444,#b91c1c);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);color:white;font-weight:bold;font-size:14px;">📍</div></div>`,
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
    const marker = L.marker(start, { draggable: true, icon }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      setCoords({ lat: p.lat, lng: p.lng });
    });
    map.on("click", (e: any) => {
      marker.setLatLng(e.latlng);
      setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    mapInstanceRef.current = map;
    markerRef.current = marker;
    if (!coords) {
      // tenta GPS ao abrir
      handleUseGps();
    }
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  const handleUseGps = async () => {
    setLoadingGps(true);
    try {
      const gps = await readGps();
      if (!gps?.coords) {
        toast.error("Não foi possível obter GPS.");
        return;
      }
      const c = { lat: gps.coords.lat, lng: gps.coords.lng };
      setCoords(c);
      if (mapInstanceRef.current && markerRef.current) {
        mapInstanceRef.current.setView([c.lat, c.lng], 18);
        markerRef.current.setLatLng([c.lat, c.lng]);
      }
    } finally {
      setLoadingGps(false);
    }
  };

  const handleConfirm = async () => {
    if (!coords) {
      toast.error("Toque no mapa para escolher o local.");
      return;
    }
    setReversing(true);
    try {
      const rev = await reverseGeocode(coords).catch(() => null);
      onConfirm(coords, rev ? { street: rev.street, number: rev.number, neighborhood: rev.neighborhood, postalcode: rev.postalcode } : null);
    } finally {
      setReversing(false);
    }
  };

  return (
    <div className="space-y-2">
      <div ref={mapRef} style={{ height, width: "100%" }} className="rounded-xl overflow-hidden border border-border bg-muted" />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleUseGps}
          disabled={loadingGps}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border bg-background text-xs font-bold disabled:opacity-50"
        >
          {loadingGps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          Usar GPS
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-bold">
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!coords || reversing}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
        >
          {reversing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Confirmar pino
        </button>
      </div>
      {coords && (
        <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
          <MapPin className="h-3 w-3" />
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} — arraste o pino para ajustar
        </p>
      )}
    </div>
  );
};

export default AddressPinPicker;