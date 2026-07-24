/**
 * Shared TanStack Query client singleton.
 *
 * Extracted from `src/App.tsx` so that non-React modules (e.g. route resolvers,
 * legacy helpers) can read/invalidate the same cache the app uses.
 */
import { QueryClient } from "@tanstack/react-query";

const isNativeApp = typeof window !== "undefined" &&
  (window as any).Capacitor?.isNativePlatform?.() === true;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 15,
      refetchOnWindowFocus: !isNativeApp,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: 1,
    },
  },
});