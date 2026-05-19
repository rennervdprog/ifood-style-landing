# Plano — Redesign UI/UX do Painel do Entregador

**Escopo:** apenas UI/UX (`DriverDashboardV2.tsx`, `StoreDriverView.tsx`, `StoreDriverEarnings.tsx`, `DriverPersistentAlert.tsx`). Nenhuma alteração em queries, mutations, geolocalização, realtime, otimização de rota ou regras de negócio.

---

## 1. Pesquisa rápida — padrões consagrados em apps de entregador

Padrões usados por iFood Entregador, Uber Driver, Rappi, DoorDash Dasher:

1. **"Um job, uma tela"** — quando em entrega, a tela inteira foca no pedido ativo. Nada compete com a ação principal.
2. **CTA único e gigante, fixo no rodapé** (thumb zone) — "Aceitar", "Cheguei no cliente", "Entreguei". Altura ≥56px, ocupa largura quase total.
3. **Toggle Online/Offline grande no topo** com cor viva quando online (verde/primary) e neutro quando offline.
4. **Barra de status persistente** com: status (online/offline), ganhos do dia, nº de entregas. Sempre visível, glance-able.
5. **Cards de pedido com hierarquia rígida** — endereço (maior, negrito) > distância/tempo > valor. Nada mais compete.
6. **Sem cores arbitrárias** — só a cor primária da marca + um estado de alerta. Apps de entregador profissionais evitam arco-íris de cores.
7. **Navegação externa em destaque** — botões Waze/Maps grandes, side-by-side, com ícones reconhecíveis.
8. **PIN/código de entrega** em teclado numérico nativo ou input gigante centralizado com tracking amplo.
9. **Contato cliente** — botão WhatsApp/ligar com ícone redondo grande, um toque.
10. **Bottom-sheet** para detalhes secundários (itens do pedido, observações) — não polui a tela principal.
11. **Estados vazios calmos** — "Sem pedidos no momento" com ilustração simples e dica útil, não em vermelho/alerta.
12. **Safe areas obrigatórias** (`pt-safe`, `pb-safe`) para o notch e barra inferior.
13. **Feedback tátil** em toda ação (haptic) + animação `active:scale-[0.97]`.

---

## 2. Diagnóstico do que está feio hoje

- **Cores arbitrárias por toda parte:** `bg-amber-500`, `bg-emerald-500`, `bg-blue-500`, `bg-purple-500` — quebra a identidade da marca, parece protótipo.
- **Gradientes em excesso** — vários cards com `bg-gradient-to-br from-X to-Y`, criando ruído visual.
- **Hierarquia tipográfica fraca** — muito texto do mesmo peso, falta diferenciar endereço vs metadados.
- **Header denso** com nome + role + 2 botões + logo, todos pequenos demais para toque confortável.
- **Cards de pedido com muita informação simultânea** — itens, valores, navegação, ação, tudo competindo.
- **Botões de status (Cheguei/Confirmar PIN)** com cores diferentes do resto do app, parecendo de outro produto.
- **Earnings** misturado no fluxo principal sem hierarquia clara.
- **Tabs/segmentação** (`bg-muted/50 p-1 rounded-2xl`) genéricas, sem indicação clara do ativo.
- **Persistent alert** flutuante competindo com header.
- **Empty states** funcionam mas o convite pendente tem visual pesado para o que é (3 chips decorativos sem função).

---

## 3. Plano de redesign — 5 lotes

### Lote 1 — Sistema visual base do painel
- Definir tokens semânticos consistentes: `--driver-online` (verde primário), `--driver-offline` (muted), `--driver-alert` (destructive). Tudo via index.css, sem novas cores cruas.
- Remover **todos** os `bg-amber-*`, `bg-emerald-*`, `bg-blue-*`, `bg-purple-*`, `text-emerald-*` etc. do fluxo do entregador. Substituir por `primary`, `muted`, `destructive`, `foreground`.
- Padronizar raios: `rounded-2xl` para cards, `rounded-xl` para chips/botões secundários, `rounded-full` para ícones circulares.
- Padronizar sombras: apenas `shadow-sm` em cards e `shadow-lg shadow-primary/20` no CTA principal.
- Remover gradientes decorativos (`from-X to-Y` puro estilo) — manter só em CTA hero.

### Lote 2 — Header e Status Bar
- Header mais alto (h-16) com:
  - Esquerda: avatar/iniciais + nome em peso black + role em micro caps.
  - Direita: ícones suporte + sair em containers 40×40.
- Logo abaixo do header: **Status Bar fixa** com 3 colunas glance-able:
  - **Status** (Online/Offline) com dot pulsante quando online.
  - **Ganhos hoje** (R$ XX,XX).
  - **Entregas hoje** (n).
- Toggle online/offline vira o elemento mais proeminente — pill grande clicável de largura total acima das tabs.

### Lote 3 — Cards de pedido (lista de disponíveis e aceitos)
- Reescrita do card com hierarquia tipo iFood:
  - **Linha 1:** ícone loja + nome da loja (sm, muted).
  - **Linha 2:** **Bairro · rua** (xl, font-black, foreground).
  - **Linha 3:** chips compactos — distância · valor da entrega · forma de pagamento.
  - **Footer fixo do card:** CTA único primário ("Aceitar" / "Iniciar entrega") + ação secundária discreta (recusar como link, não como botão).
- Estados visuais com **borda esquerda colorida** (3px) ao invés de fundo colorido inteiro:
  - Novo = primary.
  - Em entrega = primary + pulse sutil.
  - Aguardando código = muted-foreground.
- Itens do pedido escondidos atrás de "Ver itens" (bottom-sheet/accordion).

### Lote 4 — Tela de entrega ativa (foco total)
- Quando há pedido em andamento, esconder lista e mostrar **tela única** do pedido ativo:
  - Topo: cliente (nome + telefone) + 2 botões grandes (Ligar / WhatsApp).
  - Meio: endereço gigante + botões Waze/Maps lado a lado (`flex-1`, tokens primary/muted, sem azul/roxo crus).
  - Bloco itens colapsado por padrão.
  - Bloco pagamento se cash (troco).
  - Rodapé sticky: CTA único de próxima ação ("Cheguei", "Entreguei", "Inserir código").
- Input de **código PIN** com dígitos individuais (6 caixas) ao invés de texto único — padrão fintech, muito mais claro.

### Lote 5 — Convite, Aguardando vínculo, Earnings, Persistent Alert
- **Convite pendente:** simplificar. Remover os 3 chips decorativos sem função. Manter: loja, "Convite de loja", 2 botões grandes.
- **Aguardando vínculo:** já bom — só ajustar para tokens semânticos e copy mais curta.
- **Earnings:** card compacto colapsado por padrão na home; expansível para detalhes. Sem `text-emerald-*`.
- **DriverPersistentAlert:** redesenhar como faixa fina no topo (não card flutuante), `bg-primary/10 text-primary` quando informativo, `bg-destructive/10` só se realmente crítico.
- **Empty state "sem pedidos":** ilustração calma (ícone Bike grande em `text-muted-foreground/30`), copy "Tudo certo. Avisaremos quando chegar um pedido."

---

## 4. O que NÃO entra (proteção contra escopo)

- Nenhuma mudança em: `useQuery`, mutations Supabase, realtime, `startDriverTracking`, `optimizeRoute`, `notifyOrderStatusChange`, lógica de status, regras de PIN, fluxo de aceitar/rejeitar, persistência de declined, lógica de earnings.
- Nenhuma mudança em rotas, auth, guards.
- Nenhuma alteração em `StoreDriverEarnings` além de estilos.

---

## 5. Ordem de execução sugerida (1 lote por mensagem "Sim")

1. Lote 1 — tokens + remoção de cores cruas.
2. Lote 2 — header + status bar + toggle online.
3. Lote 3 — cards de pedido.
4. Lote 4 — tela de entrega ativa + PIN.
5. Lote 5 — convite, earnings, persistent alert, empty states.

Cada lote: incremento de versão patch (`1.6.28` → `1.6.32`) com `versionCode` correspondente, conforme rotina.

---

## 6. Métricas de sucesso visual

- Zero classes `bg-amber-*`, `bg-emerald-*`, `bg-blue-*`, `bg-purple-*`, `text-emerald-*`, `text-amber-*`, `text-blue-*` no fluxo do entregador.
- CTA primário ≥56px em todas as telas de ação.
- Todo texto crítico (endereço, valor, código) em `font-black` ≥ `text-lg`.
- Toda área tocável ≥40×40.
- `pt-safe`/`pb-safe` em todas as telas full-screen.

Posso começar pelo **Lote 1** assim que você confirmar.