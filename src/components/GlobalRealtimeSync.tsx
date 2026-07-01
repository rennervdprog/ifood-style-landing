import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SUPABASE_ANON_KEY, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cleanupChannel, subscribeWithRejoin } from "@/lib/realtimeChannel";

type PgPayload = {
  eventType?: "INSERT" | "UPDATE" | "DELETE";
  new?: Record<string, any> | null;
  old?: Record<string, any> | null;
};

const getStoreId = (payload: PgPayload) =>
  (payload.new?.store_id || payload.old?.store_id || null) as string | null;

const getStoreRowId = (payload: PgPayload) =>
  (payload.new?.id || payload.old?.id || null) as string | null;

const getClientId = (payload: PgPayload) =>
  (payload.new?.client_id || payload.old?.client_id || null) as string | null;

const getDriverId = (payload: PgPayload) =>
  (payload.new?.driver_id || payload.old?.driver_id || null) as string | null;

const getSessionId = (payload: PgPayload) =>
  (payload.new?.session_id || payload.old?.session_id || payload.new?.id || payload.old?.id || null) as string | null;

/**
 * Sincronização Realtime global.
 *
 * Objetivo: qualquer mudança feita pelo lojista/super-admin/PDV refletir sem
 * depender do usuário sair e voltar da tela. Mantemos os canais existentes de
 * páginas críticas (alertas sonoros, patch instantâneo de pedido), mas este
 * componente cobre o restante da aplicação invalidando o cache certo do React Query.
 */
const GlobalRealtimeSync = () => {
  const queryClient = useQueryClient();
  const { user, session } = useAuth();
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    try {
      (supabase.realtime as any).setAuth?.(session?.access_token ?? SUPABASE_ANON_KEY);
    } catch {}
  }, [session?.access_token]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const schedule = (key: string, fn: () => void, delay = 250) => {
    const timers = timersRef.current;
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        fn();
      }, delay),
    );
  };

  const invalidatePrefix = (prefix: string) => {
    queryClient.invalidateQueries({ queryKey: [prefix] });
  };

  const invalidateScoped = (prefix: string, storeId?: string | null) => {
    queryClient.invalidateQueries({ queryKey: storeId ? [prefix, storeId] : [prefix] });
  };

  const invalidateStoreCatalog = (storeId?: string | null) => {
    schedule(`catalog:${storeId || "all"}`, () => {
      [
        "products",
        "menu-sections",
        "store-hours",
        "opening-hours",
        "opening-hours-all",
        "store-promo-collections",
        "pdv-products",
        "pdv-sections",
        "store-products",
        "store-products-for-addons",
        "menu-product-count",
        "promo-products",
        "promo-collections",
        "store-hours-check",
        "store-hours-checkout",
        "store-preorder",
        "cart-store-status",
        "store-checkout",
      ].forEach((prefix) => invalidateScoped(prefix, storeId));

      // Bootstrap e store por slug/id guardam cópia de cardápio/loja; invalidar
      // o prefixo inteiro evita página de loja presa em cache antigo.
      invalidatePrefix("store-bootstrap");
      invalidatePrefix("store");
      invalidatePrefix("stores");
      invalidatePrefix("stores-client");
      invalidatePrefix("available-stores");
      invalidatePrefix("client-store-search");
      invalidatePrefix("all-products-search");
      invalidatePrefix("network-units");
      invalidatePrefix("network-units-hours");
      invalidatePrefix("client-recent-orders");
      invalidatePrefix("recent-orders-reorder");
    });
  };

  const invalidateAddons = (payload: PgPayload) => {
    const storeId = getStoreId(payload);
    const productId = (payload.new?.product_id || payload.old?.product_id || null) as string | null;
    schedule(`addons:${storeId || productId || "all"}`, () => {
      if (productId) invalidateScoped("addon-all", productId);
      else invalidatePrefix("addon-all");

      invalidateScoped("store-addon-groups", storeId);
      invalidatePrefix("addon-group-links");
      invalidateScoped("store-order-addon-groups", storeId);
      invalidateScoped("store-order-addon-links", storeId);
      invalidateStoreCatalog(storeId);
    });
  };

  const invalidateStoreSettings = (storeId?: string | null) => {
    schedule(`store:${storeId || "all"}`, () => {
      [
        "store-plan",
        "store-pdv-plan",
        "store-pdv-pending",
        "store-asaas",
        "asaas-activation-status",
        "asaas-activation-status-center",
        "store-settings-for-category",
        "store-online-drivers",
      ].forEach((prefix) => invalidateScoped(prefix, storeId));

      invalidatePrefix("my-store");
      invalidatePrefix("own-store");
      invalidatePrefix("admin-all-stores");
      invalidatePrefix("admin-store-plans");
      invalidateStoreCatalog(storeId);
    });
  };

  const invalidateFinancial = (storeId?: string | null) => {
    schedule(`finance:${storeId || "all"}`, () => {
      [
        "store-balance",
        "store-balance-split",
        "store-balance-alert",
        "store-balance-avisos",
        "store-finance-basic",
        "store-finance-basic-prev",
        "store-finance-orders",
        "store-finance-prev-orders",
        "store-finance-center",
        "store-financial-transactions",
        "store-pdv-plan",
        "store-pdv-pending",
        "store-balance-repasse",
        "valor-a-pagar",
        "store-billing-history",
        "fixed-plan-billing-history",
        "repasse-history",
        "recebido-mes",
        "oldest-pending-commission",
        "pending-plan-charge",
        "pending-subscription-payment",
      ].forEach((prefix) => invalidateScoped(prefix, storeId));

      invalidatePrefix("store-balances");
      invalidatePrefix("finance-orders");
      invalidatePrefix("admin-fixed-plan-receivables");
      invalidatePrefix("admin-store-plans");
      invalidatePrefix("admin-all-stores");
    });
  };

  const invalidateOrders = (payload: PgPayload) => {
    const storeId = getStoreId(payload);
    const clientId = getClientId(payload);
    const driverId = getDriverId(payload);
    schedule(`orders:${storeId || clientId || driverId || "all"}`, () => {
      if (clientId) {
        invalidateScoped("orders", clientId);
        invalidateScoped("client-recent-orders", clientId);
        invalidateScoped("recent-orders-reorder", clientId);
        invalidateScoped("user-has-orders", clientId);
        invalidateScoped("my-order-count", clientId);
      } else {
        ["orders", "client-recent-orders", "recent-orders-reorder", "user-has-orders", "my-order-count"].forEach(invalidatePrefix);
      }

      [
        "store-orders",
        "store-all-orders",
        "store-orders-lojista",
        "store-finance-orders",
        "store-finance-prev-orders",
        "store-finance-basic",
        "store-finance-basic-prev",
        "store-report",
        "reorder-products",
        "popular-products",
      ].forEach((prefix) => invalidateScoped(prefix, storeId));

      if (driverId) {
        invalidateScoped("driver-ride-history-orders", driverId);
      }

      invalidatePrefix("admin-all-orders");
      invalidatePrefix("admin-orders");
      invalidatePrefix("finance-orders");
      invalidatePrefix("orders-failed-splits");
      invalidatePrefix("pdv-relatorio-orders");
      invalidateFinancial(storeId);
    }, 400);
  };

  const invalidatePdv = (payload: PgPayload) => {
    const storeId = getStoreId(payload);
    const sessionId = getSessionId(payload);
    schedule(`pdv:${storeId || sessionId || "all"}`, () => {
      if (sessionId) {
        invalidateScoped("pdv-movements", sessionId);
        invalidateScoped("pdv-session-mov", sessionId);
        invalidateScoped("pdv-session-orders", sessionId);
        invalidateScoped("pdv-weight-summary", sessionId);
      } else {
        ["pdv-movements", "pdv-session-mov", "pdv-session-orders", "pdv-weight-summary"].forEach(invalidatePrefix);
      }
      invalidateScoped("pdv-historico", storeId);
      invalidateScoped("pdv-sessions-list", storeId);
      invalidateScoped("pdv-relatorio-orders", storeId);
      invalidateScoped("pdv-relatorio-movements", storeId);
      invalidateScoped("pdv-movements-chart", storeId);
      invalidateScoped("store-report", storeId);
      invalidateFinancial(storeId);
    }, 400);
  };

  useEffect(() => {
    const channel = supabase
      .channel("global-public-catalog-sync")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "stores" }, (payload: PgPayload) =>
        invalidateStoreSettings(getStoreRowId(payload)),
      )
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "products" }, (payload: PgPayload) =>
        invalidateStoreCatalog(getStoreId(payload)),
      )
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "menu_sections" }, (payload: PgPayload) =>
        invalidateStoreCatalog(getStoreId(payload)),
      )
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "opening_hours" }, (payload: PgPayload) =>
        invalidateStoreCatalog(getStoreId(payload)),
      )
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "promo_collections" }, (payload: PgPayload) =>
        invalidateStoreCatalog(getStoreId(payload)),
      )
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "pizza_borders" }, (payload: PgPayload) => {
        const storeId = getStoreId(payload);
        schedule(`pizza-borders:${storeId || "all"}`, () => invalidateScoped("pizza-borders", storeId));
      })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "pastel_borders" }, (payload: PgPayload) => {
        const storeId = getStoreId(payload);
        schedule(`pastel-borders:${storeId || "all"}`, () => invalidateScoped("pastel-borders", storeId));
      })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "addon_groups" }, invalidateAddons)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "addon_items" }, invalidateAddons)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "product_addon_groups" }, invalidateAddons);

    subscribeWithRejoin(channel, (status) => {
      if (status === "SUBSCRIBED") {
        console.log("[Realtime] ✅ Catálogo global sincronizado");
      }
    });

    return () => cleanupChannel(channel);
    // Intencional: helpers usam queryClient estável; reabrir canal só se o client mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`global-private-sync-${user.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "orders" }, invalidateOrders)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "order_items" }, invalidateOrders)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "store_balances" }, (payload: PgPayload) =>
        invalidateFinancial(getStoreId(payload)),
      )
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "store_plans" }, (payload: PgPayload) =>
        invalidateStoreSettings(getStoreId(payload)),
      )
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "pdv_movements" }, invalidatePdv)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "pdv_sessions" }, invalidatePdv)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "drivers" }, () => {
        invalidatePrefix("online-drivers-count");
        invalidatePrefix("store-online-drivers");
        invalidatePrefix("driver-profiles");
      })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "store_drivers" }, () => {
        invalidatePrefix("store-drivers-list");
        invalidatePrefix("own-store-pedidos");
      })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "profiles" }, () => {
        invalidatePrefix("user-role");
        invalidatePrefix("my-profile-approval");
        invalidatePrefix("bottom-nav-profile");
        invalidatePrefix("client-profiles");
        invalidatePrefix("driver-profiles");
        invalidatePrefix("admin-pending-profiles");
      });

    subscribeWithRejoin(channel, (status) => {
      if (status === "SUBSCRIBED") {
        console.log("[Realtime] ✅ Dados privados sincronizados");
      }
    });

    return () => cleanupChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, user?.id]);

  return null;
};

export default GlobalRealtimeSync;