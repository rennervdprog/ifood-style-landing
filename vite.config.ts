import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

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
    mode === "production" && visualizer({
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
      template: "treemap",
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
        manualChunks(id) {
          // Vendor core
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/react-router-dom/")) return "vendor";
          // Supabase SDK
          if (id.includes("node_modules/@supabase/")) return "supabase";
          // React Query
          if (id.includes("node_modules/@tanstack/")) return "query";
          // Ícones — isolado pois é grande
          if (id.includes("node_modules/lucide-react/")) return "icons";
          // Radix UI
          if (id.includes("node_modules/@radix-ui/")) return "ui";
          // Charts — só carregado em FinanceTab
          if (id.includes("node_modules/recharts/") || id.includes("node_modules/d3-")) return "charts";
          // Mapa + leaflet — só em LiveTracking
          if (id.includes("node_modules/leaflet/") || id.includes("LiveTracking")) return "map";
          // PDV — chunk isolado (só lojistas com PDV)
          if (id.includes("/pages/PdvPage") || id.includes("/components/Pdv")) return "pdv";
          // Super Admin — raramente carregado
          if (id.includes("/pages/SuperAdmin")) return "super-admin";
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
