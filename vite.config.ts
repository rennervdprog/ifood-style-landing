import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

// BUILD_ID único por build — usado pelo versionWatcher para detectar
// novos deploys sem depender de bump manual de versão.
const BUILD_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const BUILT_AT = new Date().toISOString();

function emitVersionJson(appVersion: string) {
  return {
    name: "emit-version-json",
    apply: "build" as const,
    generateBundle(this: any) {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify(
          { buildId: BUILD_ID, version: appVersion, builtAt: BUILT_AT },
          null,
          2,
        ),
      });
    },
  };
}

function readAppVersion(): string {
  try {
    const src = fs.readFileSync(
      path.resolve(__dirname, "src/lib/appVersion.ts"),
      "utf8",
    );
    const m = src.match(/APP_VERSION\s*=\s*"([^"]+)"/);
    return m?.[1] ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

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

/**
 * Injeta <link rel="modulepreload"> no index.html final para os chunks das
 * rotas iniciais prováveis, com base em VITE_CAPACITOR_APP_MODE. Isso faz
 * o download dos chunks acontecer em paralelo com o parse do main bundle,
 * cortando 800ms-1.5s do cold start no APK Capacitor.
 *
 * Seguro: modulepreload é apenas uma dica ao browser — se o chunk não for
 * usado o app funciona igual, só não ganha o boost.
 */
function preloadInitialRouteChunks(appMode: string) {
  const targetsByMode: Record<string, string[]> = {
    parceiro: ["PartnerLogin", "AdminDashboardV2", "DriverDashboardV2"],
    cliente:  ["StoreDirectory", "ClientHome"],
    // Web: sem preload de rota — a rota inicial varia (home, painel, PDV…) e
    // o preload do StoreDirectory pesava em TODAS as páginas, inclusive no
    // /admin-teste onde a vitrine nem aparece (varredura 2026-11-09).
    "":       [],
  };
  const targets = targetsByMode[appMode] ?? targetsByMode[""];
  return {
    name: "preload-initial-route-chunks",
    apply: "build" as const,
    // Roda após o Vite emitir tudo (index.html + chunks). Lê o dist/index.html,
    // encontra os chunks por facadeModuleId no bundle capturado, e injeta
    // <link rel="modulepreload"> para as rotas iniciais.
    writeBundle(this: any, options: any, bundle: any) {
      try {
        const outDir = options?.dir || path.resolve(__dirname, "dist");
        const htmlPath = path.join(outDir, "index.html");
        if (!fs.existsSync(htmlPath)) return;
        const links: string[] = [];
        for (const [fileName, chunk] of Object.entries<any>(bundle)) {
          if (!chunk || chunk.type !== "chunk") continue;
          const facade = chunk.facadeModuleId || "";
          if (targets.some((t) =>
            facade.endsWith(`/pages/${t}.tsx`) || facade.endsWith(`/pages/${t}.ts`)
          )) {
            links.push(`    <link rel="modulepreload" href="/${fileName}" />`);
          }
        }
        console.log(`[preload-plugin] mode=${appMode || "(none)"} targets=${targets.join(",")} matched=${links.length}`);
        if (!links.length) return;
        let html = fs.readFileSync(htmlPath, "utf8");
        if (html.includes("<!--__PRELOADS__-->")) return;
        html = html.replace(
          "</head>",
          `${links.join("\n")}\n    <!--__PRELOADS__-->\n  </head>`,
        );
        fs.writeFileSync(htmlPath, html);
      } catch (e) {
        console.warn("[preload-plugin] erro:", e);
      }
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
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILT_AT__: JSON.stringify(BUILT_AT),
  },
  plugins: [
    enforceExternalBackendOnly(),
    emitVersionJson(readAppVersion()),
    preloadInitialRouteChunks((process.env.VITE_CAPACITOR_APP_MODE || "").toLowerCase()),
    react(),
    mode === "development" && componentTagger(),
    mode === "production" && visualizer({
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
      template: "treemap",
    }),
    VitePWA({
      // "prompt" com skipWaiting=false: o SW novo fica em "waiting" até o
      // usuário aceitar (o versionWatcher decide o momento seguro, fora de
      // rotas críticas como checkout/PDV/motoboy em rota). Nada de
      // skipWaiting/clientsClaim forçados — com "autoUpdate" o plugin
      // forçava os dois para true no SW gerado e cada deploy recarregava
      // sozinho qualquer aba aberta.
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
        // Precache SÓ da casca do app (varredura de desempenho 2026-11-09,
        // item 2): HTML, entry (app-*.js), CSS global, os chunks iniciais
        // que o index.html pré-carrega, o workbox-window do registro e os
        // ícones (includeAssets). Antes era "**/*" e a 1ª visita baixava
        // ~7,3 MB (429 arquivos) — todas as rotas lazy, as 3 gerações do
        // painel e a pilha de PDF do PDV. Chunk lazy NÃO entra aqui: ele
        // carrega sob demanda pela rede/cache HTTP (assets com hash têm
        // Cache-Control imutável de 1 ano) e pelo runtimeCaching de
        // /assets/* abaixo.
        globPatterns: [
          "index.html",
          "assets/app-*.js",
          "assets/index-*.css",
          "assets/vendor-*.js",
          "assets/supabase-*.js",
          "assets/query-*.js",
          "assets/ui-*.js",
          "assets/capacitor-*.js",
          "assets/workbox-*.js",
          // Placeholder de imagem usado em todo o site. Os ícones da
          // casca (favicon, apple-touch-icon, icon-192/512) entram pelo
          // includeAssets acima — NÃO repetir aqui: URL duplicada no
          // manifesto do precache.
          "placeholder.svg",
        ],
        globIgnores: [
          "**/stats.html",
          // Chunks pesados ficam de fora do precache (servidos sob demanda)
          "**/charts-*.js",
          "**/SuperAdmin*.js",
          "**/leaflet*.js",
          "**/motion-*.js",
        ],
        // Limite alto de propósito: é só uma trava de segurança — quem
        // enxuga o precache é a whitelist acima. Um limite baixo (ex.:
        // 500KB) derrubaria o próprio entry (~533KB) do precache em
        // silêncio.
        maximumFileSizeToCacheInBytes: 3_000_000,
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
            // Assets próprios com hash no nome (imutáveis por 1 ano no
            // HTTP): chunks lazy fora do precache passam a viver neste
            // cache na 1ª vez que a rota é visitada, em vez de serem
            // pré-baixados pra todo visitante (item 2 da varredura).
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
        // Entry com nome próprio ("app" em vez de "index"): dezenas de
        // chunks lazy também se chamam "index-*" (pacotes com módulo
        // index), então sem um nome distinto não dá pra colocar SÓ o
        // entry na whitelist do precache do SW (item 2 da varredura).
        entryFileNames: "assets/app-[hash].js",
        // Forma de FUNÇÃO (não objeto): com objeto, o Rollup captura as
        // dependências compartilhadas do pacote pro chunk manual — o clsx
        // (usado pelo entry via lib/utils) foi parar dentro do chunk
        // "charts" e TODAS as páginas passaram a baixar os 411 KB do
        // recharts no boot só por causa dele (varredura 2026-11-09).
        // Aqui cada chunk recebe SÓ os pacotes nomeados; dependências
        // compartilhadas (clsx, lodash…) caem nos chunks naturais.
        manualChunks(id: string) {
          // O helper virtual do plugin CommonJS é compartilhado por todos
          // os pacotes CJS (react inclusive) — se ele cai no chunk do
          // recharts, o entry importa o chunk inteiro só pelo helper.
          if (id.includes("commonjsHelpers")) return "vendor";
          if (!id.includes("node_modules")) return undefined;
          const inPkg = (pkgs: string[]) =>
            pkgs.some((p) => id.includes(`/node_modules/${p}/`));
          // clsx fica no vendor: ele é dependência compartilhada (entry E
          // recharts usam) e o Rollup o capturava pro chunk do recharts,
          // criando a aresta entry→charts.
          if (inPkg(["react", "react-dom", "react-router-dom", "clsx"]))
            return "vendor";
          if (inPkg(["@tanstack/react-query"])) return "query";
          if (inPkg(["@supabase/supabase-js"])) return "supabase";
          // icons: lucide-react fora de manualChunks para permitir
          // tree-shaking real — chunk único força o bundle inteiro no boot.
          if (inPkg(["recharts"])) return "charts";
          if (
            inPkg([
              "@radix-ui/react-dialog",
              "@radix-ui/react-popover",
              "@radix-ui/react-tabs",
              "@radix-ui/react-select",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-tooltip",
            ])
          )
            return "ui";
          if (inPkg(["react-hook-form", "@hookform/resolvers", "zod"]))
            return "forms";
          if (inPkg(["framer-motion"])) return "motion";
          if (
            inPkg([
              "@capacitor/core",
              "@capacitor/app",
              "@capacitor/preferences",
            ])
          )
            return "capacitor";
          return undefined;
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
