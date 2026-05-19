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
