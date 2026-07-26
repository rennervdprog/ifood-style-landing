## Objetivo

Trocar **todos os ícones** da aplicação (Lucide → Solar/MDI via `AppIcon`) e depois deixar 100% **offline** — zero requests para `api.iconify.design`, funciona no APK sem internet.

Escopo hoje: **286 arquivos** importam de `lucide-react` (`/cliente`, `/admin`, `/pdv`, `/super-admin`, `/reseller`, `auth`, componentes UI, etc).

---

## Fase 1 — Mapa de ícones (fonte única da verdade)

Criar `src/lib/icon-map.ts` mapeando cada ícone Lucide usado no app para o equivalente Solar (fallback MDI quando Solar não tem). Ex:

```
ShoppingCart → solar:cart-large-minimalistic
Pizza        → mdi:pizza
Hamburger    → mdi:hamburger
Store        → solar:shop
Search       → solar:magnifer
...
```

Auditoria automatizada: script varre `src/`, extrai todo símbolo importado de `lucide-react`, gera o mapa inicial. Ícones sem equivalente óbvio ficam marcados `// TODO` para revisão manual (poucos casos).

## Fase 2 — Codemod: swap em massa

Script Node que, para cada `.tsx`:
1. Remove `import { X, Y } from "lucide-react"`.
2. Adiciona `import { AppIcon } from "@/components/ui/app-icon"`.
3. Substitui `<X className="..." />` por `<AppIcon name="{mapa[X]}" className="..." />`.
4. Preserva props (`className`, `size`, `aria-label`).

Regra de variante:
- **`bold-duotone`** em destaques (ativos, cards, hero, CTAs).
- **`linear`** em UI utilitária (inputs, tabs inativas, botões secundários).
- Detecção heurística por contexto (ex: dentro de `Button variant="ghost"` → linear).

Rollout em 6 lotes, um por área, cada lote = 1 commit + smoke test visual:
1. `/cliente` (parcial já feito — completar checkout, cart, pedidos)
2. `/admin` (dashboard, cardápio, pedidos, financeiro)
3. `/pdv` (vender, mesas, comandas, relatórios, config)
4. `/super-admin` (todas as abas)
5. `/reseller`
6. Componentes compartilhados (`components/ui`, headers, modais, toasts)

## Fase 3 — Validação

- `tsgo --noEmit` a cada lote.
- Screenshot Playwright de 8 rotas-chave antes/depois pra pegar ícones quebrados (nome errado no mapa).
- Remover `lucide-react` do `package.json` no final (só se 0 imports restarem).

## Fase 4 — Offline (bundle local)

Hoje `@iconify/react` busca cada ícone da API pública e cacheia em `localStorage`. No APK sem internet a 1ª carga fica em branco.

Solução:
1. Gerar `src/lib/icons-bundle.ts` que importa **só os ícones usados** direto dos JSONs locais (`@iconify-json/solar/icons.json`, `@iconify-json/mdi/icons.json`) e registra via `addCollection()` do `@iconify/react`.
2. Script lê `icon-map.ts`, extrai os ~60-80 ícones únicos, monta o bundle enxuto (~15-25 KB gzip).
3. `AppIcon` continua igual — Iconify vê o ícone registrado localmente e nunca chama a API.
4. Import do bundle em `src/main.tsx` (top-level).

Resultado: zero network, funciona offline no APK, bundle mínimo.

## Fase 5 — Versionamento

Bump patch a cada lote (v1.25.75 → v1.25.80 aprox), sincronizando `appVersion.ts` + `build.gradle` (versionName + versionCode).

---

## Detalhes técnicos

- **Sem quebra de design system:** `AppIcon` já usa `currentColor` + `cn()`, então `text-primary`, `text-muted-foreground` etc continuam funcionando.
- **Sem `size` prop:** Solar/MDI seguem `className` (`h-4 w-4`). Codemod converte `size={16}` → `className="h-4 w-4"`.
- **Ícones muito específicos do Lucide sem par:** manter Lucide pontualmente (permitido — `AppIcon` e Lucide coexistem). Objetivo é ~95%+ migrado, não 100% forçado.
- **Rollback:** cada lote é 1 commit; reverter é trivial. `icon-map.ts` centraliza qualquer ajuste posterior.

## Riscos

- Ícones com nome ambíguo (`Menu`, `Settings`, `MoreVertical`) — mapa curado manualmente.
- Ícones customizados (SVGs próprios já importados como componente) — **não** são tocados.
- Regressão visual em telas raras — mitigado pelos screenshots Playwright.

## Entregável final

- 100% do app com visual Solar/MDI premium (tipo iFood/Rappi).
- Bundle offline (~20 KB) sem depender da API pública.
- `lucide-react` removido (ou reduzido a poucos casos).
- Rollback simples via `icon-map.ts`.

Aprova pra eu começar pela Fase 1 (mapa + auditoria)?