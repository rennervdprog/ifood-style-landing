# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

ItaSuper — plataforma de delivery (clientes, lojistas, entregadores, revendedores, admin) + PDV para lojistas.
React 18 + Vite + TypeScript, Tailwind/shadcn/Radix, Supabase (Postgres + Auth + Edge Functions + Storage), deploy web na Vercel.

**Três repositórios, um banco.** Este repo é o cliente **web** — hoje é por onde o lojista acessa o painel.
Os apps de cliente e de entregador foram reescritos em Kotlin/Compose e vivem fora daqui
(`Itasuper-APP-NATIVO` e `Itasuper-entregador-`). Os três clientes compartilham o mesmo Postgres:
mudar assinatura de RPC ou coluna de `orders` compila aqui e quebra os apps em silêncio — não há
tipos gerados nem teste de contrato do lado Kotlin. Tratar o schema como contrato público.

## Planos (oferta vigente)

Só dois planos aceitam novos cadastros — `NEW_STORE_PLAN_TYPES` em `src/lib/plansInfo.ts`:

- **Essencial** (`fixed`): R$ 89,90/mês, 0% de comissão, PIX R$ 1,99, entrega R$ 0,99.
  Começa **grátis** e só passa a cobrar quando a loja soma R$ 5.000 em pedidos numa janela
  móvel de 60 dias, com 30 dias de aviso prévio. Limiar e valor reais vêm de `plan_templates`
  no banco; o cron `check-essencial-upgrade` e a função SQL `check_plan_upgrade` implementam a regra.
- **Somente PDV** (`pdv_only`): R$ 69/mês, só frente de caixa, sem vitrine e sem delivery.

Os demais (`commission_only`, `hybrid`, `supporter`, `autonomy`) são **legado**: continuam definidos
para que lojas antigas mantenham suas regras e histórico, mas estão ocultos na UI pública e não
devem ser oferecidos. Ao mexer em preço/comissão, `plansInfo.ts` é a fonte — não duplicar valores.

## Capacitor — legado

O diretório `android/`, os `src/lib/capacitor*.ts` e os workflows `build-android.yml` / `ota-release.yml`
são da geração anterior, quando cliente e entregador eram o mesmo bundle web empacotado
(`app.itasuper.cliente` e `app.itasuper.parceiro`). O Kotlin substituiu os dois. O código continua no
repo e o versionamento ainda é checado pelo CI (ver abaixo), mas não é o caminho de release atual —
confirmar com o usuário antes de investir em qualquer coisa dessa camada.

## Comandos

```bash
npm run dev              # Vite dev server na porta 8080 (E2E assume esta porta)
npm run build            # build produção
npm run build:dev        # build modo development
npm run lint             # eslint

npm run test             # vitest run (todos)
npm run test:watch
npm run test:pdv         # subset PDV — é o gate obrigatório do CI (pdv-tests.yml)
npx vitest run src/lib/__tests__/pixFormat.test.ts     # arquivo único
npx vitest run -t "nome do teste"                      # por nome

npm run test:e2e         # Playwright (e2e/), precisa do dev server em :8080
npm run test:e2e:report
npx playwright test e2e/06-pdv-lojista.spec.ts         # spec único

npm run deploy:external -- <slug-da-function>          # deploy de edge function
npm run deploy:external -- --all
npm run deploy:external -- --jwt <slug>                # com verify_jwt=true
```

Android (legado): `npx cap sync android && npx cap open android`. APKs saem do workflow `build-android.yml` (cliente / parceiro / white_label), acionado só na mão.

O repo tem três lockfiles (`bun.lockb`, `package-lock.json`, `pnpm-lock.yaml` não versionado) — o CI usa **bun** (`bun install --frozen-lockfile`). Não versionar lockfile de outro gerenciador.

## Dois backends Supabase — não confundir

- **Banco real (cérebro): projeto externo `qkjhguziuchqsbxzruea`.** Todo dado de negócio (usuários, lojas, pedidos, PIX, financeiro) vive aqui. URL e anon key estão **hardcoded** em `src/integrations/supabase/client.ts`.
- O projeto `lktzrqjvqoojlrhqnxuz` (o do `.env`, `supabase/config.toml` e do MCP do Supabase) é o antigo Lovable Cloud, hoje usado só como ponte de deploy (`scripts/deploy-external.mjs` chama a function `deploy-to-external` que vive nele). Não colocar dados de negócio lá.
- `vite.config.ts` tem um plugin `enforceExternalBackendOnly` que **quebra o build** se qualquer arquivo em `src/` mencionar `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY`. Sempre importar de `@/integrations/supabase/client`.
- Ao falar com o usuário, chamar o backend de "Supabase" ou "banco/backend" — nunca "Lovable Cloud".
- Scripts SQL em `scripts/*-external.sql` são feitos para rodar no banco externo.

## Versionamento (CI bloqueia divergência)

`src/lib/appVersion.ts` (`APP_VERSION`) e `android/app/build.gradle` (`versionName`) precisam bater — `version-check.yml` falha se divergirem. Ao mudar código, incrementar o patch nos dois e também `versionCode` (+1 inteiro) no gradle, e informar a nova versão ao usuário. `src/pages/PerfilPage.tsx` exibe a versão na UI.

## CI — estado atual

`pdv-tests.yml` (gate obrigatório) e `version-check.yml` rodam em push/PR; nenhum dos dois toca a rede.

`e2e-playwright.yml`, `ota-release.yml` e `keep-alive.yml` estão **pausados** (só `workflow_dispatch`)
porque dependem do Supabase, que está suspenso. Os gatilhos automáticos ficaram comentados dentro de
cada arquivo, com o motivo. Quando o banco voltar, descomentar. Antes de pausar, `ota-release.yml`
disparava em push que tocasse `src/**`, `public/**`, `index.html`, `vite.config.ts` ou lockfiles,
publicando bundle OTA (`@capgo/capacitor-updater`).

## Arquitetura

**Roteamento.** `src/App.tsx` só compõe o shell; as rotas vivem em `src/routes/domains/*.routes.tsx` (public, auth, cliente, lojista, driver, admin, revendedor, store) e são montadas nessa ordem. `store.routes` contém o catch-all `/:slug` e o `*` 404 — **sempre por último**. Slugs reservados em `src/routes/reservedSlugs.ts`. Páginas são lazy via `src/routes/lazyPages.ts`; guards por papel via `src/routes/layouts/GuardedLayout.tsx` + `RoleGuard` (aplicar no layout, não repetir por rota).

**Papel + rota inicial.** `src/hooks/useUserRouting.ts` é a fonte única de verdade para role/plano/home-route — um cache react-query por usuário, consumido por todos os guards e telas de login. `resolveUserRouting` é puro e testado. Não reintroduzir queries de role soltas nos componentes.

**Estado.** Contexts: `AuthContext`, `CartContext`, `StoreContext`. Server state em React Query; o `queryClient` mora em `src/lib/queryClient.ts` para que resolvers fora do React usem o mesmo cache.

**Capacitor (legado — ver seção acima).** O modo de app é resolvido em `src/lib/capacitorAppMode.ts` (appId nativo > `VITE_CAPACITOR_APP_MODE` de build > storage) e afeta rotas permitidas (`CapacitorRouteGuard`, `StoreAppGuard`) e o preload de chunks iniciais no `vite.config.ts`. Boot nativo, lifecycle, push, geolocalização em background e OTA ficam em `src/lib/capacitor*.ts`, `nativeBoot.ts`, `otaUpdate.ts`, `driverBackgroundFetch.ts`. Esses guards ainda rodam no bundle web, então mexer neles afeta produção mesmo com os APKs descontinuados.

**Edge Functions** (`supabase/functions/`, ~100): pagamentos (`payment-router`, `create-pix-payment`, `asaas-webhook`, `mercadopago-webhook`, `woovi-*`, `abacatepay-webhook`, `pix-direto-*`), financeiro/crons (`monthly-billing`, `auto-payout-cron`, `generate-commission-charge`, `finance-reconcile-snapshot`), WhatsApp (`evolution-*`, `zapi-*`, `whatsapp-bot-handler`), e E2E (`e2e-mint-session`, `e2e-*-flow`). `verify_jwt` por função é declarado em `supabase/config.toml`; o flag `--jwt` do deploy script precisa bater com isso.

**Fluxo financeiro.** Checkout grava em `orders` com a `commission_rate` **histórica**; `payment-router` processa via Asaas com split para a subconta do lojista; trigger atualiza `store_balances`; painéis do admin e do lojista leem sempre a taxa histórica do pedido, não a atual.

**Fontes únicas de verdade — espelhar, não duplicar:**
- Planos/comissões/taxas: `src/lib/plansInfo.ts` (ver seção "Planos" acima).
- Política de repasse e bloqueio: `supabase/functions/_shared/repasse-policy.ts`, espelhada em `src/lib/repasseRules.ts`. Não inventar prazos/limites em novos crons.
- Taxa de entrega: `src/lib/deliveryFee.ts` + `deliveryFeeDisplay.ts` + `deliveryQuote.ts`.

**PDV** (`src/pages/pdv/`): estado em hooks dedicados (`state/usePdvCart`, `usePdvSession`, `usePdvCatalog`, `usePdvCheckout`, `usePdvTables`) com fila offline em `pdvOutbox.ts`. Variantes por segmento em `apparel/`, `restaurant/`, `snackbar/`. É a área com cobertura de teste obrigatória no CI — ao mexer aqui, rodar `npm run test:pdv`.

**API serverless Vercel** (`api/`): `og.ts` (Open Graph para bots de link — ver rewrite por user-agent em `vercel.json`), `store.ts`, `quote-delivery.ts`, `resolve-delivery-address.ts`, `keep-alive.ts`.

## Testes

- Vitest + Testing Library, jsdom, setup em `src/test/setup.ts`, include `src/**/*.{test,spec}.{ts,tsx}`. Lógica pura testada em `src/lib/__tests__/`.
- Playwright (`e2e/`) roda autenticado: `global-setup.ts` chama a edge function `e2e-mint-session` com `E2E_SETUP_TOKEN` e grava `.auth/pdv-user.json`. Sem esse token os testes caem em `/auth`. `E2E_BASE_URL` sobrescreve `http://localhost:8080`.
- `e2e-native/` roda dentro do WebView do APK via CDP (`adb forward`) — ver `e2e-native/README.md`.

## Convenções

- Alias `@` → `src/`. Componentes shadcn em `src/components/ui/`.
- RLS ativo em todas as tabelas; não desabilitar sem auditoria. Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `EXTERNAL_SUPABASE_SERVICE_KEY`, ...) só no painel de secrets das Edge Functions.
- Ao alterar código, avaliar ganhos reais de performance (lazy-load, memoização onde há re-render real, `select` enxuto no Supabase, imagens webp/lazy) e aplicar só quando fizer diferença; mencionar brevemente ao usuário.
- Comentários e mensagens de commit em português, seguindo o histórico.
