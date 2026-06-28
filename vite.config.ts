import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

function enforceExternalBackendOnly() {
  return {
    name: "enforce-external-backend-only",
    buildStart() {
      const forbidden = /VITE_SUPABASE_(URL|PUBLISHABLE_KEY|ANON_KEY)/;
      const scan = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) scan(fullPath);
          if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
            const content = fs.readFileSync(fullPath, "utf8");
            if (forbidden.test(content)) {
              throw new Error(`Use @/integrations/supabase/client para o backend externo: ${fullPath}`);
            }
          }
        }
      };
      scan(path.resolve(__dirname, "src"));
    },
  };
}

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
    enforceExternalBackendOnly(),
    react(),
    mode === "development" && componentTagger(),
    mode === "production" && visualizer({
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
      template: "treemap",
    }),
    VitePWA({
      // "prompt" em vez de "autoUpdate" para NÃO recarregar a página sozinho
      // quando há nova versão (evita perder o que o cliente está montando num
      // modal de produto / checkout). A atualização é aplicada no próximo
      // refresh natural do usuário.
      registerType: "prompt",
      injectRegister: null,
      filename: "sw.js",
      devOptions: { enabled: false },
      includeAssets: [
        "favicon.ico",
        "favicon.png",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
      ],
      manifest: false, // já existe manifest manual no projeto
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        globIgnores: ["**/stats.html"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/api\//,
          /^\/functions\//,
        ],
        cleanupOutdatedCaches: true,
        // Não pular o waiting nem reivindicar clientes: o SW novo só assume
        // após o usuário fechar/abrir a aba (ou aceitar o prompt manual),
        // evitando reload no meio de um pedido.
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: [
          {
            // Cardápio bootstrap servido pela Edge da Vercel
            urlPattern: ({ url }) => url.pathname.startsWith("/api/store/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "store-bootstrap",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 10 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Imagens de produto do Unsplash
            urlPattern: ({ url }) =>
              url.hostname === "images.unsplash.com" ||
              url.hostname === "i.unsplash.com",
            handler: "CacheFirst",
            options: {
              cacheName: "unsplash-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Imagens do Supabase Storage
            urlPattern: ({ url }) => url.pathname.includes("/storage/v1/object/"),
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
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
          vendor:   ["react", "react-dom", "react-router-dom"],
          query:    ["@tanstack/react-query"],
          supabase: ["@supabase/supabase-js"],
          icons:    ["lucide-react"],
          charts:   ["recharts"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
            "@radix-ui/react-select",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tooltip",
          ],
          forms: [
            "react-hook-form",
            "@hookform/resolvers",
            "zod",
          ],
          motion: ["framer-motion"],
          capacitor: [
            "@capacitor/core",
            "@capacitor/app",
            "@capacitor/preferences",
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
