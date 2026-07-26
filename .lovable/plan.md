# Plano: Headers persistentes no app cliente (Capacitor)

Objetivo: em **todas** as telas do fluxo `/cliente/**` e loja pública, o header (barra superior) fica **fixo no topo**, **respeita o notch/status bar do Android** (hora, bateria) e o conteúdo rola **por baixo** dele — igual ao iFood.

## 1. Criar primitivo único `AppHeader`

Arquivo: `src/components/cliente/AppHeader.tsx`

Responsabilidades:
- `position: sticky; top: 0; z-index: 40`
- `padding-top: env(safe-area-inset-top)` (notch) + fundo sólido opaco (não translúcido) para nunca "vazar" atrás da status bar
- Variantes: `solid` (padrão branco) / `transparent-to-solid` (StorePage — vira sólido no scroll) / `brand` (gradiente laranja da home)
- Slots: `left` (voltar/menu), `center` (título/busca), `right` (ações — sino, favorito)
- Prop `elevated` (sombra sutil ao rolar)

## 2. Configurar StatusBar nativa uma vez

`src/lib/capacitorNative.ts`:
- `StatusBar.setOverlaysWebView({ overlay: true })` (já usamos parcial)
- `StatusBar.setStyle({ style: Style.Dark })` para ícones escuros sobre header branco; alternar para `Light` em telas com header brand (laranja)
- Hook `useStatusBarStyle(variant)` chamado por cada `AppHeader`

## 3. Telas a migrar para `AppHeader`

Todas usam padrão sticky + safe-area:

| Tela | Arquivo | Variante |
|---|---|---|
| Home cliente | `ClientHomeContent.tsx` | `brand` (endereço + sino) |
| Busca | `busca/ClientBuscaPage.tsx` | `solid` (já sticky — trocar wrapper) |
| Categoria/resultados | mesma acima | `solid` |
| Loja pública | `StorePage.tsx` | `transparent-to-solid` |
| Cardápio item | `ProductPage.tsx` | `solid` |
| Carrinho | `CartPage.tsx` | `solid` |
| Checkout | `CheckoutPage.tsx` | `solid` |
| Pedidos | `cliente/PedidosPage.tsx` | `solid` |
| Detalhe pedido | `PedidoDetalhePage.tsx` | `solid` |
| Perfil | `PerfilPage.tsx` | `solid` |
| Endereços | `EnderecosPage.tsx` | `solid` |
| Favoritos | `FavoritosPage.tsx` | `solid` |
| Ajuda / Termos | `AjudaPage.tsx` etc. | `solid` |

## 4. Ajustes globais

- Remover `paddingTop: env(safe-area-inset-top)` **do body/App** para as rotas `/cliente/**` (o header agora cuida disso). Rotas sem header próprio mantêm um `SafeAreaTop` filler.
- `src/index.css`: garantir `html, body { background: white }` para o gap do notch nunca aparecer preto ao rolar bounce (iOS-like overscroll no Android também).
- Bottom nav: já respeita `safe-area-inset-bottom`; sem mudanças.

## 5. Comportamento no scroll (iFood-like)

- Sticky puro (não `fixed`) → conteúdo empurra normalmente, header acompanha o topo do viewport.
- Sombra aparece após 8px de scroll via `IntersectionObserver` de um sentinel invisível — sem listener de `scroll` pesado.
- StorePage: opacidade do fundo do header interpolada 0→1 nos primeiros 120px (já existe, será portado para `AppHeader`).

## 6. Versionamento

Bump para **v1.26.0** (mudança visual global). Atualiza `src/lib/appVersion.ts` + `android/app/build.gradle` (`versionName` + `versionCode +1`).

## Detalhes técnicos

- `sticky` funciona dentro do WebView do Capacitor sem precisar de `-webkit-` extra.
- `env(safe-area-inset-top)` só devolve valor > 0 quando o `AndroidManifest` tem `windowLayoutInDisplayCutoutMode="shortEdges"` e `StatusBar.setOverlaysWebView(true)` — ambos já configurados.
- Web (não-Capacitor) recebe `env()` = 0 → header cola no topo do navegador, sem regressão.
- Evita `position: fixed` para não brigar com o teclado (bug do gap branco já resolvido).

## Fora de escopo

- Redesign visual dos headers (só estrutura + sticky). Refinos de UI ficam para plano separado.
- Rotas de super-admin / lojista / PDV.
