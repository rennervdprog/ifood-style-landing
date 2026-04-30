import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        // Precache only the critical app shell; lazy chunks are fetched on demand and
        // cached via runtimeCaching. This avoids downloading admin/charts code on first visit.
        globPatterns: ["index.html", "manifest.webmanifest", "icon-*.png", "robots.txt"],
        // Keep total precache budget tight
        maximumFileSizeToCacheInBytes: 3_000_000,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Hashed JS/CSS/font assets — safe to cache for a year (filenames change on deploy)
            urlPattern: /\/assets\/.*\.(?:js|css|woff2?|ttf|otf)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Images
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp|avif|gif|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkOnly",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 0, maxAgeSeconds: 0 },
            },
          },
        ],
      },
      includeAssets: ["icon-192x192.png", "icon-512x512.png"],
      manifest: {
        name: "ItaSuper - O delivery oficial de Itatinga",
        short_name: "ItaSuper",
        description: "Peça comida dos melhores restaurantes de Itatinga/SP",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#FF6B00",
        orientation: "portrait",
        categories: ["food", "shopping", "lifestyle"],
        lang: "pt-BR",
        dir: "ltr",
        scope: "/",
        icons: [
          { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          {
            name: "Fazer Pedido",
            short_name: "Pedir",
            description: "Abrir lista de restaurantes",
            url: "/",
            icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Meus Pedidos",
            short_name: "Pedidos",
            description: "Ver meus pedidos",
            url: "/pedidos",
            icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Cadastrar Loja",
            short_name: "Loja",
            description: "Cadastrar minha loja",
            url: "/cadastro-lojista",
            icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
          },
        ],
      },
    }),
  ].filter(Boolean),
  build: {
    cssCodeSplit: true,
    minify: "esbuild",
    target: "es2020",
    reportCompressedSize: false,
    // Em produção, esbuild remove console.log/info/warn (mantém console.error)
    // e debugger statements. Reduz bundle e mantém DevTools limpo no APK.
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          supabase: ["@supabase/supabase-js"],
          charts: ["recharts"],
          icons: ["lucide-react"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
            "@radix-ui/react-select",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tooltip",
          ],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
  esbuild: {
    pure: mode === "production" ? ["console.log", "console.info", "console.warn", "console.debug"] : [],
    drop: mode === "production" ? ["debugger"] : [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
