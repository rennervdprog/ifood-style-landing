# Licenças de terceiros — dependências open source (item 29, parte docs)

**Data do levantamento:** 23/11/2026
**Base:** `package.json` da `origin/main` no commit
`333126d11c5eb16d00bcb12f267ef3d8162749e8`
**Fonte das licenças:** registro público do npm
(`registry.npmjs.org/<pacote>/latest`, campo `license`), consultado
em 23/11/2026. Licença verificada = o campo `license` declarado pelo
pacote no registro. **Nenhum pacote ficou como não-verificado.**

> Atenção: a licença listada é a da versão mais recente publicada no
> registro em 23/11/2026, não necessariamente a da versão travada no
> `package-lock.json`. Se uma versão travada divergir, vale a licença
> da versão instalada — conferir no `package-lock.json` antes de
> qualquer uso fora do previsto. As licenças permissivas abaixo (MIT,
> Apache-2.0, BSD, ISC) permitem uso comercial com atribuição conforme
> cada texto; as copyleft fracas (MPL-2.0) e as licenças de conteúdo
> (CC-BY-4.0, Hippocratic-2.1) têm condições próprias — ler o texto da
> licença antes de redistribuir ou modificar o componente.

## Licenças que pedem atenção

| Pacote | Licença | Por que olhar |
|---|---|---|
| `leaflet` | BSD-2-Clause | Mapas. Exige o crédito do OpenStreetMap no mapa — o item 29, parte 1 (código), troca `attributionControl: false` por `true` nos 3 mapas. Os dados de mapa do OpenStreetMap são © contribuidores do OpenStreetMap, sob ODbL. |
| `react-leaflet` | Hippocratic-2.1 | Licença ética (cláusula de não-violação de direitos humanos). Ler o texto antes de redistribuir. |
| `@capgo/capacitor-updater` | MPL-2.0 | Copyleft fraco: modificações no arquivo coberto devem ser publicadas sob MPL-2.0. Uso sem modificação não impõe nada ao resto do app. |
| `@iconify-json/solar` | CC-BY-4.0 | Pacote de **dados de ícones** (não código): exige atribuição ao usar os ícones Solar. |
| `lucide-react`, `canvas-confetti` | ISC | Permissiva, equivalente prática à MIT. |
| `firebase`, `typescript`, `fuse.js`, `@capacitor-firebase/analytics`, `class-variance-authority`, `@vercel/speed-insights`, `web-vitals`, `react-helmet-async`, `@playwright/test` | Apache-2.0 | Permissiva; exige aviso de alteração quando o código for modificado e redistribuído. |

## Dependências de produção (`dependencies`)

| Pacote | Versão (`package.json`) | Licença |
|---|---|---|
| `@capacitor-community/background-geolocation` | ^1.2.26 | MIT |
| `@capacitor-community/safe-area` | ^8.0.1 | MIT |
| `@capacitor-firebase/analytics` | ^8.3.0 | Apache-2.0 |
| `@capacitor/android` | ^8.3.0 | MIT |
| `@capacitor/app` | ^8.1.0 | MIT |
| `@capacitor/background-runner` | ^3.0.0 | MIT |
| `@capacitor/browser` | ^8.0.3 | MIT |
| `@capacitor/cli` | ^8.3.0 | MIT |
| `@capacitor/clipboard` | ^8.0.1 | MIT |
| `@capacitor/core` | ^8.3.0 | MIT |
| `@capacitor/device` | ^8.0.2 | MIT |
| `@capacitor/filesystem` | ^8.1.2 | MIT |
| `@capacitor/geolocation` | ^8 | MIT |
| `@capacitor/haptics` | ^8.0.2 | MIT |
| `@capacitor/ios` | ^8.3.0 | MIT |
| `@capacitor/keyboard` | ^8.0.3 | MIT |
| `@capacitor/local-notifications` | ^8.1.0 | MIT |
| `@capacitor/network` | ^8 | MIT |
| `@capacitor/preferences` | ^8 | MIT |
| `@capacitor/push-notifications` | ^8.0.3 | MIT |
| `@capacitor/screen-orientation` | ^8.0.1 | MIT |
| `@capacitor/share` | ^8.0.1 | MIT |
| `@capacitor/splash-screen` | ^8.0.1 | MIT |
| `@capacitor/status-bar` | ^8.0.2 | MIT |
| `@capgo/capacitor-updater` | ^8.50.1 | MPL-2.0 |
| `@dnd-kit/core` | ^6.3.1 | MIT |
| `@dnd-kit/sortable` | ^10.0.0 | MIT |
| `@dnd-kit/utilities` | ^3.2.2 | MIT |
| `@hookform/resolvers` | ^3.10.0 | MIT |
| `@iconify-json/solar` | ^1.2.5 | CC-BY-4.0 |
| `@iconify/react` | ^6.0.2 | MIT |
| `@radix-ui/react-accordion` | ^1.2.11 | MIT |
| `@radix-ui/react-alert-dialog` | ^1.1.14 | MIT |
| `@radix-ui/react-aspect-ratio` | ^1.1.7 | MIT |
| `@radix-ui/react-avatar` | ^1.1.10 | MIT |
| `@radix-ui/react-checkbox` | ^1.3.2 | MIT |
| `@radix-ui/react-collapsible` | ^1.1.11 | MIT |
| `@radix-ui/react-context-menu` | ^2.2.15 | MIT |
| `@radix-ui/react-dialog` | ^1.1.14 | MIT |
| `@radix-ui/react-dropdown-menu` | ^2.1.15 | MIT |
| `@radix-ui/react-hover-card` | ^1.1.14 | MIT |
| `@radix-ui/react-label` | ^2.1.7 | MIT |
| `@radix-ui/react-menubar` | ^1.1.15 | MIT |
| `@radix-ui/react-navigation-menu` | ^1.2.13 | MIT |
| `@radix-ui/react-popover` | ^1.1.14 | MIT |
| `@radix-ui/react-progress` | ^1.1.7 | MIT |
| `@radix-ui/react-radio-group` | ^1.3.7 | MIT |
| `@radix-ui/react-scroll-area` | ^1.2.9 | MIT |
| `@radix-ui/react-select` | ^2.2.5 | MIT |
| `@radix-ui/react-separator` | ^1.1.7 | MIT |
| `@radix-ui/react-slider` | ^1.3.5 | MIT |
| `@radix-ui/react-slot` | ^1.2.3 | MIT |
| `@radix-ui/react-switch` | ^1.2.5 | MIT |
| `@radix-ui/react-tabs` | ^1.1.12 | MIT |
| `@radix-ui/react-toast` | ^1.2.14 | MIT |
| `@radix-ui/react-toggle` | ^1.1.9 | MIT |
| `@radix-ui/react-toggle-group` | ^1.1.10 | MIT |
| `@radix-ui/react-tooltip` | ^1.2.14 | MIT |
| `@sentry/capacitor` | ^4.2.0 | MIT |
| `@sentry/react` | 10.60.0 | MIT |
| `@supabase/supabase-js` | ^2.101.0 | MIT |
| `@tanstack/react-query` | ^5.83.0 | MIT |
| `@types/leaflet` | ^1.9.21 | MIT |
| `@types/papaparse` | ^5.5.2 | MIT |
| `@vercel/analytics` | ^2.0.1 | MIT |
| `@vercel/speed-insights` | ^2.0.0 | Apache-2.0 |
| `canvas-confetti` | ^1.9.3 | ISC |
| `capacitor-native-biometric` | ^4.2.2 | MIT |
| `capacitor-native-settings` | ^8.1.0 | MIT |
| `class-variance-authority` | ^0.7.1 | Apache-2.0 |
| `clsx` | ^2.1.1 | MIT |
| `cmdk` | ^1.1.1 | MIT |
| `date-fns` | ^3.6.0 | MIT |
| `embla-carousel-react` | ^8.6.0 | MIT |
| `firebase` | ^12.11.0 | Apache-2.0 |
| `framer-motion` | ^11 | MIT |
| `fuse.js` | ^7.4.2 | Apache-2.0 |
| `input-otp` | ^1.4.2 | MIT |
| `jsbarcode` | 3.12.3 | MIT |
| `jspdf` | ^4.2.1 | MIT |
| `jspdf-autotable` | ^5.0.9 | MIT |
| `leaflet` | ^1.9.4 | BSD-2-Clause |
| `lucide-react` | ^0.462.0 | ISC |
| `next-themes` | ^0.3.0 | MIT |
| `papaparse` | ^5.5.3 | MIT |
| `qrcode` | ^1.5.4 | MIT |
| `react` | ^18.3.1 | MIT |
| `react-day-picker` | ^8.10.1 | MIT |
| `react-dom` | ^18.3.1 | MIT |
| `react-helmet-async` | ^3.0.0 | Apache-2.0 |
| `react-hook-form` | ^7.61.1 | MIT |
| `react-leaflet` | 4.2.1 | Hippocratic-2.1 |
| `react-markdown` | ^10.1.0 | MIT |
| `react-resizable-panels` | ^2.1.9 | MIT |
| `react-router-dom` | ^6.30.1 | MIT |
| `recharts` | ^2.15.4 | MIT |
| `rehype-slug` | ^6.0.0 | MIT |
| `remark-gfm` | ^4.0.1 | MIT |
| `sonner` | ^1.7.4 | MIT |
| `tailwind-merge` | ^2.6.0 | MIT |
| `tailwindcss-animate` | ^1.0.7 | MIT |
| `vaul` | ^0.9.9 | MIT |
| `vite-plugin-pwa` | ^1.3.0 | MIT |
| `web-vitals` | ^4.2.4 | Apache-2.0 |
| `zod` | ^3.25.76 | MIT |

## Dependências de desenvolvimento (`devDependencies`)

| Pacote | Versão (`package.json`) | Licença |
|---|---|---|
| `@eslint/js` | ^9.32.0 | MIT |
| `@playwright/test` | ^1.57.0 | Apache-2.0 |
| `@tailwindcss/typography` | ^0.5.16 | MIT |
| `@testing-library/jest-dom` | ^6.6.0 | MIT |
| `@testing-library/react` | ^16.0.0 | MIT |
| `@testing-library/user-event` | ^14.6.1 | MIT |
| `@types/node` | ^22.16.5 | MIT |
| `@types/qrcode` | ^1.5.6 | MIT |
| `@types/react` | ^18.3.23 | MIT |
| `@types/react-dom` | ^18.3.7 | MIT |
| `@vitejs/plugin-react-swc` | ^3.11.0 | MIT |
| `@vitest/coverage-v8` | ^3.2.4 | MIT |
| `autoprefixer` | ^10.4.21 | MIT |
| `eslint` | ^9.32.0 | MIT |
| `eslint-plugin-react-hooks` | ^5.2.0 | MIT |
| `eslint-plugin-react-refresh` | ^0.4.20 | MIT |
| `globals` | ^15.15.0 | MIT |
| `jsdom` | ^20.0.3 | MIT |
| `lovable-tagger` | ^1.1.13 | MIT |
| `postcss` | ^8.5.6 | MIT |
| `rollup-plugin-visualizer` | ^7.0.1 | MIT |
| `tailwindcss` | ^3.4.17 | MIT |
| `typescript` | ^5.8.3 | Apache-2.0 |
| `typescript-eslint` | ^8.38.0 | MIT |
| `vite` | ^5.4.19 | MIT |
| `vitest` | ^3.2.4 | MIT |
| `workbox-window` | ^7.4.1 | MIT |

## O que este arquivo não cobre

- **Dependências transitivas** (as dependências das dependências): não
  listadas aqui. Para o inventário completo, gerar com
  `npx license-checker --summary` (ou equivalente) a partir do
  `package-lock.json`.
- **Serviços** (Supabase, Vercel, Asaas, Woovi etc.): não são código
  aberto — os termos de cada um estão em `docs/operadores.md`.
- **Termos de Uso da plataforma** (§14 — licença de uso do ItaSuper):
  continuam em `src/content/legal/terms_v6_8.md`.

## Manutenção

Refazer este levantamento quando houver troca relevante de dependência
(adição/remoção de pacote de produção) ou, no mínimo, junto com a
auditoria dos 40 itens (a cada 3 meses).
