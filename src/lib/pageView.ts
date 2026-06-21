import { supabase } from "@/integrations/supabase/client";

/**
 * Tracking de visitas — Fase 1+2 do plano de analytics.
 * - visitor_hash estável (localStorage)
 * - bots filtrados no servidor por user-agent
 * - dedupe 1h por (page, ip_hash) no servidor (burlar localStorage não infla)
 * - dedupe local 30min por (page, store_id) só pra economizar request
 * - captura referrer, UTM, device
 */

function getVisitorHash(): string {
  try {
    let h = localStorage.getItem("visitor_hash");
    if (!h) {
      h = crypto.randomUUID();
      localStorage.setItem("visitor_hash", h);
    }
    return h;
  } catch {
    return crypto.randomUUID();
  }
}

function getDevice(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function getUtm() {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get("utm_source") || undefined,
      utm_medium: p.get("utm_medium") || undefined,
      utm_campaign: p.get("utm_campaign") || undefined,
    };
  } catch {
    return {};
  }
}

export async function trackPageView(
  page: string,
  opts: { storeId?: string | null } = {}
) {
  if (typeof window === "undefined") return;
  const dedupeKey = `pv_${page}_${opts.storeId || ""}_at`;
  try {
    const last = Number(sessionStorage.getItem(dedupeKey) || 0);
    if (Date.now() - last < 30 * 60 * 1000) return;
  } catch { /* ignore */ }

  const utm = getUtm();
  const args: Record<string, unknown> = {
    _page: page,
    _visitor_hash: getVisitorHash(),
    _user_agent: navigator.userAgent?.slice(0, 500),
    _referrer: document.referrer?.slice(0, 500) || null,
    _utm_source: utm.utm_source,
    _utm_medium: utm.utm_medium,
    _utm_campaign: utm.utm_campaign,
    _device: getDevice(),
    _store_id: opts.storeId || null,
  };

  const { error } = await supabase.rpc("record_page_view" as never, args as never);
  if (!error) {
    try { sessionStorage.setItem(dedupeKey, String(Date.now())); } catch { /* ignore */ }
  }
}