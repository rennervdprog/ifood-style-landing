import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";
import { haversineDistanceMeters } from "@/lib/addressGeocoding";

export const mapStoresWithHours = (
  stores: any[],
  allHours: any[] | null | undefined,
  userCoords?: { lat: number; lng: number } | null,
  userCity?: string | null,
) => {
  const cityNorm = userCity?.toLowerCase().trim() || null;
  return stores
    .map((store: any) => {
      const hours = (allHours || []).filter((h: any) => h.store_id === store.id) as OpeningHour[];
      const status = getStoreOpenStatus(hours, store.force_closed || false, store.is_open);
      const lat = store.latitude;
      const lng = store.longitude;
      const distanceKm =
        userCoords && typeof lat === "number" && typeof lng === "number"
          ? haversineDistanceMeters(userCoords, { lat, lng }) / 1000
          : null;
      return { ...store, realIsOpen: status.isOpen, statusReason: status.reason, distanceKm };
    })
    .sort((a: any, b: any) => {
      if (a.realIsOpen !== b.realIsOpen) return a.realIsOpen ? -1 : 1;
      if (cityNorm) {
        const aCity = (a.address_city || "").toLowerCase() === cityNorm;
        const bCity = (b.address_city || "").toLowerCase() === cityNorm;
        if (aCity !== bCity) return aCity ? -1 : 1;
      }
      const da = a.distanceKm;
      const db = b.distanceKm;
      if (typeof da === "number" && typeof db === "number") return da - db;
      if (typeof da === "number") return -1;
      if (typeof db === "number") return 1;
      return 0;
    });
};