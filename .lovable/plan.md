## Plano de Teste — ItaSuper (padrão de empresas como Google, Stripe, Uber, iFood)

Objetivo: validar que **fluxos críticos de receita e operação** funcionam de ponta a ponta, sem regressões, em todas as personas (cliente, loja, entregador, admin/matriz).

### Princípios (test pyramid clássico)

```text
        ╱╲     E2E (poucos, fluxos de receita)
       ╱──╲    Integração (RPCs Supabase + edge functions)
      ╱────╲   Componente (UI crítica c/ Testing Library)
     ╱──────╲  Unitário (lib/utils, formatters, regras puras)
```

70% unit · 20% integração · 10% E2E — mesma proporção usada no Google e Spotify.

---

### Fase 1 — Fundação (setup já existe, só ampliar)

Já há `vitest` + `@testing-library/react` + `jsdom`. Adicionar:
- `@testing-library/user-event` para interações realistas (focus/blur/typing)
- `msw` (Mock Service Worker) para mockar Supabase REST/Edge sem rede
- `playwright` para E2E mobile (Capacitor é WebView, Playwright cobre bem)
- Coverage com `@vitest/coverage-v8` — meta 60% lib/, 50% components/

### Fase 2 — Unitários (rápidos, isolados)

Alvo: `src/lib/` e funções puras. Onde mais bug silencioso costuma morar.

| Módulo | O que testar |
|---|---|
| `formatBRL`, `appVersion`, `orderItemName` | formatação, edge cases (0, negativo, null) |
| `driverGeolocation` | start/stop/update, idempotência, no-op na web |
| `haptics` | no-op fora do Capacitor, fallback silencioso |
| `realtimeChannel` | rejoin, cleanup, sem leaks |
| Regras de negócio (cálculo de troco, comissão, frete) | golden tests com tabela de entradas/saídas |

### Fase 3 — Testes de componente (UI crítica)

Foco em componentes onde erro = perda de dinheiro ou confusão do usuário:

1. **StoreDriverView** — toggle online/offline, aceitar pedido, PIN 4 boxes (auto-advance, paste, backspace), confirmar entrega
2. **Checkout / Carrinho** — soma de itens, cupom, troco, método de pagamento
3. **PlatformSplitAlert** — fluxo PIX e cópia para área de transferência
4. **MenuProduct** — adicionar ao carrinho, variações, observações
5. **Auth (login/cadastro)** — validação, mensagens de erro, redirect

Padrão: render → user-event → assert texto visível. Sem testar implementação interna.

### Fase 4 — Integração (RPCs + Edge Functions)

Cada RPC crítica recebe teste Deno (`supabase/functions/*/test.ts`):

- `driver_accept_order` — só aceita se online, bloqueia duplo accept
- `driver_finish_delivery` — valida PIN, marca status, dispara comissão
- `confirm-order-payment` — idempotente, não duplica receita
- `create-pix-payment` / `mercadopago-webhook` — assinatura, replay protection
- `create-withdrawal-request` — saldo suficiente, anti-fraude, lock

Usar `supabase--test_edge_functions` e `curl_edge_functions` no CI.

### Fase 5 — E2E mobile (Playwright, viewport 384×672)

5 jornadas críticas — as únicas que JAMAIS podem quebrar:

```text
1. Cliente faz pedido     login → menu → carrinho → pagamento PIX → confirmação
2. Loja recebe e prepara  notificação → aceitar → pronto → marca saída
3. Entregador entrega     online → aceitar → sair → PIN → confirmar
4. Saque do entregador    earnings → solicitar saque → aprovação
5. Onboarding loja nova   cadastro → plano → cardápio → ativar
```

Cada jornada roda em CI a cada push em `main` e bloqueia deploy se falhar.

### Fase 6 — Segurança (não-funcional, mas obrigatório)

- `supabase--linter` no CI — RLS em todas tabelas
- `security--run_security_scan` semanal
- Revisão manual das policies de `orders`, `withdrawals`, `drivers`, `stores`
- Pentest leve: tentar `select *` em tabelas sensíveis com anon key
- Validar que entregador A não vê pedidos da loja B

### Fase 7 — Performance & resiliência

- Lighthouse mobile (LCP < 2.5s, CLS < 0.1, TTI < 3.5s)
- Teste de carga nas edge functions de pagamento (k6 ou artillery)
- Realtime: 50 entregadores online simultâneos sem deadlock
- Modo offline: cliente Capacitor não trava sem rede

### Fase 8 — Smoke test manual antes de cada release

Checklist rápido (5 min) feito no APK real:
- [ ] Login funciona
- [ ] Ficar online/offline (toggle alinhado)
- [ ] Aceitar pedido fictício
- [ ] PIN de 4 caixas auto-avança
- [ ] Notificação push chega
- [ ] Versão exibida no Perfil bate com build

---

### Ordem de execução sugerida

1. **Esta semana** — Fase 1 (setup) + Fase 2 (unitários `lib/`) → base rápida, alto ROI
2. **Próxima** — Fase 3 (componentes do entregador, redesenhados recentemente)
3. **Depois** — Fase 4 (RPCs de pagamento) + Fase 6 (segurança)
4. **Antes do próximo lançamento grande** — Fase 5 (E2E) + Fase 8 (smoke)

### O que NÃO testar (regra do Google)

- Detalhes de implementação (cor exata, classe Tailwind)
- Bibliotecas terceiras (confiar no React, lucide, etc.)
- Telas administrativas raramente usadas (custo > benefício)

---

Quando você aprovar, começo pela **Fase 1 + Fase 2** (setup ampliado + suíte de unitários em `src/lib/`) — fundação que destrava todo o resto.