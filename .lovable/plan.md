# Mesa/Comanda funcional no carrinho da aba Vender

## Problema atual
O input "Mesa / Comanda" no topo do carrinho (`PdvCartSection.tsx`) é apenas texto livre. Ele é salvo em `orders.table_identifier` mas **não conversa** com o módulo real de Mesas & Comandas (Fase B: `pdv_tables` / `pdv_tabs`). Ou seja:

- Não ocupa a mesa (continua "Livre" na aba Mesas).
- Não adiciona os itens numa comanda aberta — cria uma venda direta separada.
- Digitar o mesmo número várias vezes gera vendas independentes em vez de acumular na mesma comanda.
- Não valida se a mesa existe.

## Objetivo
Transformar o campo em um seletor real que:
1. Lista mesas cadastradas + comandas abertas.
2. Permite "Enviar para comanda" (acumula na mesa/comanda) OU "Venda avulsa" (comportamento atual).
3. Cria/reutiliza automaticamente a `pdv_tab` da mesa selecionada.

## Escopo

### 1. Substituir input por seletor (`PdvTableSelector`)
Novo componente no lugar do `<input>` da linha 58:
- Botão compacto que abre popover.
- Popover mostra:
  - **Mesas livres** (chips clicáveis).
  - **Comandas abertas** (mesa + total atual + tempo aberta).
  - Opção "Balcão / Avulsa" (limpa seleção).
  - Opção "Comanda avulsa (sem mesa)" com campo nome/código.
- Badge de estado: `Balcão` | `Mesa 5` | `Mesa 5 · Comanda #ab12` | `Comanda: João`.

### 2. Novo modo do carrinho
State `saleMode: "direct" | "tab"` em `usePdvCart`:
- `direct` (padrão): fluxo atual — botão "Finalizar" cobra e fecha venda.
- `tab`: quando uma mesa/comanda é selecionada, o botão principal vira **"Enviar para comanda"** (não cobra, só acumula itens via RPC existente `pdv_tab_add_item`). Botão secundário **"Cobrar e fechar"** faz checkout + fecha comanda.

### 3. RPCs / integração
Reaproveitar o que já existe (Fase B):
- `pdv_open_tab(store_id, table_id, code, customer_name)` → cria/retorna `tab_id`.
- `pdv_tab_add_item(tab_id, product_id, qty, unit_price, addons, notes)` → grava item.
- `pdv_tab_close(tab_id, payment_method, ...)` → fecha e gera `order`.

Se algum item do carrinho for adicionado no modo `tab`, ao clicar "Enviar":
- Abre/reutiliza tab da mesa selecionada.
- Faz loop enviando cada item.
- Limpa carrinho e mostra toast "3 itens enviados para Mesa 5".

### 4. Ajustes em `usePdvCheckout`
- Se `saleMode === "tab"` e usuário clicar "Cobrar e fechar": chamar `pdv_tab_close` em vez do fluxo de venda direta.
- Preservar `table_identifier` no order (compat).

### 5. Realtime / UX
- Seletor assina `pdv_tabs` para refletir comandas abertas em tempo real (já tem hook `usePdvTables`).
- Ao enviar itens, invalidar query de mesas para atualizar totais.
- Feedback visual claro: cor do header do carrinho muda quando em modo comanda (borda âmbar).

## Fora de escopo
- Mudar a aba Mesas (continua como está).
- Divisão de conta por pessoa dentro da comanda.
- Impressão automática de comanda de cozinha (já existe via KDS).

## Arquivos afetados
- `src/pages/pdv/components/PdvCartSection.tsx` — substitui input, adiciona botão duplo.
- `src/pages/pdv/components/PdvTableSelector.tsx` — **novo**.
- `src/pages/pdv/state/usePdvCart.ts` — adiciona `saleMode`, `selectedTable`, `selectedTabId`.
- `src/pages/pdv/state/usePdvCheckout.ts` — branch para fechar comanda.
- `src/pages/PdvPage.tsx` — propaga novos props.

## Versão
Bump para **v1.20.12 / build 1040** ao final.

## Verificação
- E2E: adicionar 2 itens → selecionar Mesa 3 → "Enviar" → aba Mesas mostra Mesa 3 ocupada com 2 itens → adicionar mais 1 → total acumula → "Cobrar e fechar" → venda registrada e mesa volta a livre.
