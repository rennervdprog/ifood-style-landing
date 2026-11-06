import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isValidCoordinate } from "@/lib/location";
import { fetchOsrmRoute } from "@/lib/osrmRouting";

// Aba "Onde Estão Meus Motoboys": mapa com TODOS os motoboys vinculados à
// loja (store_drivers, status accepted). Quem tem posição fresca (<= 5 min)
// aparece no mapa; em entrega ganha a rota até o cliente; online aguardando
// aparece no ponto atual; offline/sem posição fica só na lista, com a
// última vez visto — posição velha NUNCA vira ponto no mapa (regra da
// prévia aprovada). Sem marcador da loja (regra do Renner, 2026-10-11).
// Leitura: RLS de driver_locations por vínculo (policy "Store owners can
// read locations of linked drivers") + drivers/store_drivers da própria loja.

let leafletCSSLoaded = false;
function ensureLeafletCSS() {
  if (leafletCSSLoaded) return;
  leafletCSSLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

type FleetState = "delivering" | "online" | "offline";

interface FleetDriver {
  userId: string;
  name: string;
  state: FleetState;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  updatedAt: string | null;
  lastSeenAt: string | null;
  orderNumber: number | null;
  orderId: string | null;
  neighborhood: string | null;
  clientLat: number | null;
  clientLng: number | null;
}

const FRESH_MS = 5 * 60_000;

function makeDriverIcon(L: any, color: string) {
  return L.divIcon({
    html: `<div style="
      width:38px;height:38px;
      background:${color};
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 12px rgba(0,0,0,0.35);border:3px solid white;
    "><span style="font-size:19px;">🏍️</span></div>`,
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

function makeHomeIcon(L: any) {
  return L.divIcon({
    html: `<div style="
      width:34px;height:34px;
      background:#18181b;
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 10px rgba(0,0,0,0.45);border:3px solid white;
    "><span style="font-size:16px;">🏠</span></div>`,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function nameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!local) return null;
  return local.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatWhen(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `hoje às ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${time}`;
}

function ageText(iso: string | null, nowMs: number): string {
  if (!iso) return "sem posição";
  const diff = Math.max(0, nowMs - new Date(iso).getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "agora há pouco";
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours}h`;
  return formatWhen(iso);
}

export default function MotoboysMapTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [L, setL] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const homeMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const accuracyRef = useRef<any>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    ensureLeafletCSS();
    import("leaflet").then((leaflet) => setL(leaflet.default || leaflet));
  }, []);

  // 1) Vínculos da loja
  const { data: links } = useQuery({
    queryKey: ["fleet-links", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_drivers")
        .select("driver_user_id, status")
        .eq("store_id", storeId)
        .eq("status", "accepted");
      return (data || []) as Array<{ driver_user_id: string; status: string }>;
    },
    refetchInterval: 60000,
  });
  const driverIds = useMemo(
    () => Array.from(new Set((links || []).map((l) => l.driver_user_id))),
    [links]
  );

  // 2) Cadastro/presença dos motoboys
  const { data: driverRows } = useQuery({
    queryKey: ["fleet-drivers", storeId, driverIds.join(",")],
    queryFn: async () => {
      if (!driverIds.length) return [];
      const { data } = await supabase
        .from("drivers")
        .select("user_id, name, is_online, last_seen_at")
        .in("user_id", driverIds);
      return (data || []) as Array<{ user_id: string; name: string | null; is_online: boolean; last_seen_at: string | null }>;
    },
    enabled: driverIds.length > 0,
    refetchInterval: 30000,
  });

  // 3) Nomes de reserva (profiles) p/ quem está sem nome no cadastro
  const { data: profileRows } = useQuery({
    queryKey: ["fleet-profiles", driverIds.join(",")],
    queryFn: async () => {
      if (!driverIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", driverIds);
      return (data || []) as Array<{ user_id: string; full_name: string | null; email: string | null }>;
    },
    enabled: driverIds.length > 0,
  });

  // 4) Posições atuais (policy nova por vínculo)
  const { data: locationRows } = useQuery({
    queryKey: ["fleet-locations", storeId, driverIds.join(",")],
    queryFn: async () => {
      if (!driverIds.length) return [];
      const { data } = await supabase
        .from("driver_locations")
        .select("driver_user_id, latitude, longitude, accuracy, speed, updated_at, order_id")
        .in("driver_user_id", driverIds);
      return (data || []) as Array<any>;
    },
    enabled: driverIds.length > 0,
    refetchInterval: 20000,
  });

  // 5) Pedidos em entrega da loja (p/ estado "em entrega" + destino)
  const { data: activeOrders } = useQuery({
    queryKey: ["fleet-active-orders", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, driver_id, assigned_driver_id, neighborhood, client_lat, client_lng")
        .eq("store_id", storeId)
        .in("status", ["saiu_entrega", "em_transito"]);
      return (data || []) as Array<any>;
    },
    refetchInterval: 20000,
  });

  // Realtime: posição nova e presença chegam na hora
  useEffect(() => {
    if (!storeId) return;
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase.channel(`fleet-${storeId}-${suffix}`);
    ch.on("postgres_changes" as any, { event: "*", schema: "public", table: "driver_locations" }, () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-locations", storeId] });
    });
    ch.on("postgres_changes" as any, { event: "*", schema: "public", table: "drivers" }, () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-drivers", storeId] });
    });
    ch.on("postgres_changes" as any, { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` }, () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-active-orders", storeId] });
    });
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [storeId, queryClient]);

  const fleet: FleetDriver[] = useMemo(() => {
    const profiles = new Map((profileRows || []).map((p) => [p.user_id, p]));
    const drivers = new Map((driverRows || []).map((d) => [d.user_id, d]));
    const locations = new Map((locationRows || []).map((l) => [l.driver_user_id, l]));
    const ordersByDriver = new Map<string, any>();
    for (const o of activeOrders || []) {
      const did = o.driver_id || o.assigned_driver_id;
      if (did && !ordersByDriver.has(did)) ordersByDriver.set(did, o);
    }
    const list: FleetDriver[] = driverIds.map((userId) => {
      const d = drivers.get(userId);
      const p = profiles.get(userId);
      const loc = locations.get(userId);
      const order = ordersByDriver.get(userId);
      const name =
        (d?.name && d.name.trim()) ||
        (p?.full_name && p.full_name.trim()) ||
        nameFromEmail(p?.email) ||
        "(sem nome no cadastro)";
      const locFresh =
        !!loc && isValidCoordinate(loc.latitude, loc.longitude) &&
        now - new Date(loc.updated_at).getTime() <= FRESH_MS;
      const state: FleetState = order ? "delivering" : d?.is_online || locFresh ? "online" : "offline";
      return {
        userId,
        name,
        state,
        lat: locFresh ? loc.latitude : null,
        lng: locFresh ? loc.longitude : null,
        accuracy: loc && typeof loc.accuracy === "number" ? loc.accuracy : null,
        updatedAt: loc?.updated_at ?? null,
        lastSeenAt: d?.last_seen_at ?? loc?.updated_at ?? null,
        orderNumber: order?.order_number ?? null,
        orderId: order?.id ?? null,
        neighborhood: order?.neighborhood ?? null,
        clientLat: order && isValidCoordinate(order.client_lat, order.client_lng) ? order.client_lat : null,
        clientLng: order && isValidCoordinate(order.client_lat, order.client_lng) ? order.client_lng : null,
      };
    });
    const rank = { delivering: 0, online: 1, offline: 2 } as const;
    return list.sort((a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name));
  }, [driverIds, driverRows, profileRows, locationRows, activeOrders, now]);

  const counts = useMemo(
    () => ({
      delivering: fleet.filter((f) => f.state === "delivering").length,
      online: fleet.filter((f) => f.state === "online").length,
      offline: fleet.filter((f) => f.state === "offline").length,
    }),
    [fleet]
  );

  // Mapa: cria uma vez
  useEffect(() => {
    if (!L || !mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([-22.87, -42.33], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapInstanceRef.current = map;
    setMapReady(true);
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current.clear();
      homeMarkerRef.current = null;
      routeLineRef.current = null;
      accuracyRef.current = null;
      fittedRef.current = false;
      setMapReady(false);
    };
  }, [L]);

  // Mapa: sincroniza marcadores com a frota
  useEffect(() => {
    if (!mapReady || !L || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const seen = new Set<string>();
    const points: [number, number][] = [];

    for (const f of fleet) {
      if (f.lat == null || f.lng == null) continue;
      seen.add(f.userId);
      const pos: [number, number] = [f.lat, f.lng];
      points.push(pos);
      const color = f.state === "delivering" ? "#16A34A" : "#FF6A00";
      const existing = markersRef.current.get(f.userId);
      if (existing) {
        const cur = existing.getLatLng();
        if (Math.abs(cur.lat - pos[0]) > 1e-7 || Math.abs(cur.lng - pos[1]) > 1e-7) {
          existing.setLatLng(pos);
        }
        existing.setIcon(makeDriverIcon(L, color));
      } else {
        const marker = L.marker(pos, { icon: makeDriverIcon(L, color) })
          .addTo(map)
          .bindPopup(`🏍️ ${f.name}`);
        markersRef.current.set(f.userId, marker);
      }
    }
    for (const [userId, marker] of Array.from(markersRef.current.entries())) {
      if (!seen.has(userId)) {
        map.removeLayer(marker);
        markersRef.current.delete(userId);
      }
    }

    // Selecionado em entrega: casa do cliente + rota + círculo de precisão
    const sel = fleet.find((f) => f.userId === selectedId) || null;
    const showRoute = !!(sel && sel.state === "delivering" && sel.lat != null && sel.clientLat != null);
    if (showRoute && sel) {
      const cPos: [number, number] = [sel.clientLat as number, sel.clientLng as number];
      points.push(cPos);
      if (homeMarkerRef.current) homeMarkerRef.current.setLatLng(cPos);
      else homeMarkerRef.current = L.marker(cPos, { icon: makeHomeIcon(L) }).addTo(map).bindPopup("🏠 Cliente");
      const dPos: [number, number] = [sel.lat as number, sel.lng as number];
      const apply = (latlngs: [number, number][]) => {
        if (routeLineRef.current) routeLineRef.current.setLatLngs(latlngs);
        else routeLineRef.current = L.polyline(latlngs, { color: "#FF6A00", weight: 4, opacity: 0.8 }).addTo(map);
      };
      apply([dPos, cPos]);
      fetchOsrmRoute([dPos, cPos]).then((r) => {
        if (r && routeLineRef.current && mapInstanceRef.current) apply(r.geometry);
      });
      const acc = sel.accuracy;
      if (acc && acc > 25) {
        if (accuracyRef.current) {
          accuracyRef.current.setLatLng(dPos);
          accuracyRef.current.setRadius(acc);
        } else {
          accuracyRef.current = L.circle(dPos, {
            radius: acc, color: "#FF6A00", weight: 1, opacity: 0.55, fillColor: "#FF6A00", fillOpacity: 0.12,
          }).addTo(map);
        }
      } else if (accuracyRef.current) {
        map.removeLayer(accuracyRef.current);
        accuracyRef.current = null;
      }
    } else {
      if (homeMarkerRef.current) {
        map.removeLayer(homeMarkerRef.current);
        homeMarkerRef.current = null;
      }
      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
      if (accuracyRef.current) {
        map.removeLayer(accuracyRef.current);
        accuracyRef.current = null;
      }
    }

    if (points.length >= 2 && !fittedRef.current) {
      map.fitBounds(L.latLngBounds(points), { padding: [46, 46], maxZoom: 15 });
      fittedRef.current = true;
    } else if (points.length === 1 && !fittedRef.current) {
      map.setView(points[0], 15);
      fittedRef.current = true;
    }
  }, [fleet, selectedId, mapReady, L]);

  const focusDriver = (f: FleetDriver) => {
    setSelectedId(f.userId);
    if (f.lat != null && f.lng != null && mapInstanceRef.current) {
      mapInstanceRef.current.setView([f.lat, f.lng], 16);
      markersRef.current.get(f.userId)?.openPopup();
    }
  };

  const badge = (state: FleetState) =>
    state === "delivering"
      ? { text: "EM ENTREGA", cls: "bg-green-600 text-white" }
      : state === "online"
        ? { text: "ONLINE", cls: "bg-primary text-primary-foreground" }
        : { text: "OFFLINE", cls: "bg-zinc-500 text-white" };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Onde Estão Meus Motoboys</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Posição de cada motoboy da sua loja, atualizada sozinha conforme o app dele envia.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-green-600" /> {counts.delivering} em entrega
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" /> {counts.online} online aguardando
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> {counts.offline} offline
        </span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card">
          <div ref={mapRef} style={{ height: 460, width: "100%" }} className="bg-muted" />
          <div className="flex items-center justify-between border-t border-border px-3.5 py-2.5 text-xs text-muted-foreground">
            <span>🟢 Em entrega · 🟠 Online aguardando · ⚫ Offline aparece só na lista, sem ponto no mapa</span>
            <span className="ml-3 shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide text-primary-foreground">
              AO VIVO
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2.5 lg:w-[340px] lg:shrink-0">
          {fleet.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Nenhum motoboy vinculado a esta loja ainda. Vincule um motoboy na aba Motoboys para ele aparecer aqui.
            </div>
          )}
          {fleet.map((f) => {
            const b = badge(f.state);
            const isSel = selectedId === f.userId;
            return (
              <button
                key={f.userId}
                type="button"
                onClick={() => focusDriver(f)}
                className={`w-full rounded-xl border bg-card p-3.5 text-left transition ${
                  isSel ? "border-primary shadow-[0_0_0_2px_rgba(255,106,0,0.25)]" : "border-border hover:border-orange-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-100 bg-orange-50 text-[17px]">
                    🛵
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[15px] font-bold ${f.state === "offline" ? "text-muted-foreground" : ""}`}>
                    {f.name}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${b.cls}`}>{b.text}</span>
                </div>
                <div className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {f.state === "delivering" && (
                    <>
                      Pedido <b className="text-foreground">#{f.orderNumber}</b>
                      {f.neighborhood ? ` → ${f.neighborhood}` : ""}
                      <br />
                      Última posição: {ageText(f.updatedAt, now)}
                      {f.accuracy && f.accuracy > 25 ? ` · sinal fraco (±${Math.round(f.accuracy)} m)` : ""}
                    </>
                  )}
                  {f.state === "online" && (
                    <>
                      Online, aguardando pedido
                      <br />
                      {f.updatedAt
                        ? `Última posição: ${ageText(f.updatedAt, now)}`
                        : "Ainda sem posição neste turno"}
                    </>
                  )}
                  {f.state === "offline" && (
                    <>
                      {f.updatedAt
                        ? `Última posição ${formatWhen(f.updatedAt)} — aparece no mapa quando ficar online`
                        : "Nunca enviou posição — aparece quando abrir o app e ficar online"}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-orange-100 bg-orange-50 p-3.5 text-[13px] leading-relaxed text-orange-950">
        <b>Como funciona:</b> o motoboy aparece no mapa enquanto estiver <b>Online</b> no app dele — em
        entrega ou aguardando. Ficou offline, o ponto some do mapa e ele fica só na lista, com a última
        vez que foi visto: posição antiga nunca finge ser posição de agora. Cada loja só enxerga os
        motoboys dela.
      </div>
    </div>
  );
}
