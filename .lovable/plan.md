# Plano: Impressão Automática de Cupom (PDV + Delivery)

## Objetivo
Eliminar o clique manual em "Imprimir". Assim que a venda for finalizada (PDV) ou o pedido de delivery mudar para o status configurado, o cupom sai sozinho na térmica. A lojista escolhe entre **Automático** ou **Manual** por canal.

## 1. Configurações da Loja (aba Configurações → Impressão)
Adicionar novo bloco "Impressão automática" com:

- **PDV**: toggle `Imprimir automaticamente ao finalizar venda` (padrão: ligado)
- **Delivery**: toggle `Imprimir automaticamente ao receber pedido` (padrão: ligado)
- **Gatilho do delivery**: seletor com opções
  - Ao chegar (`recebido`) — recomendado
  - Ao aceitar (`preparando`)
  - Ao sair para entrega (`entrega`)
- **Cópias** e **largura (58/80mm)**: já existem, mantidos.
- Botão "Testar impressão" que emite um cupom de teste.

Persistir em `stores.settings`:
```
auto_print_pdv: boolean
auto_print_delivery: boolean
auto_print_delivery_trigger: 'recebido' | 'preparando' | 'entrega'
```

## 2. PDV — impressão automática
Em `usePdvCheckout.ts` a impressão já roda hoje ao finalizar. Vamos:
- Respeitar `settings.auto_print_pdv`. Se `false`, não imprime automaticamente — apenas mostra botão "Imprimir cupom" no toast/sucesso.
- Manter o `safePrint` com retry (já existente) para não travar a venda se a impressora falhar.

## 3. Delivery — impressão automática
Criar hook `useAutoPrintDelivery(storeId)` em `src/hooks/useAutoPrintDelivery.ts` montado no `AdminDashboardV2`:
- Assina Realtime em `orders` filtrado por `store_id`.
- Quando um pedido entra no status configurado (`auto_print_delivery_trigger`), busca `order_items` + produtos e chama `printDeliveryReceipt` (novo helper em `thermalPrint.ts`, espelhando `printPdvReceipt`).
- Deduplicação por `order_id` em `sessionStorage` (`printed:<orderId>`) para evitar reimpressão em reconexões do Realtime ou refresh da aba.
- Se `auto_print_delivery = false`, hook não faz nada; o botão manual continua funcionando no card do pedido.

## 4. Fallback e robustez
- Se o navegador bloquear (janela sem foco / popup), mostrar toast "Impressora não respondeu — clique para reimprimir" com botão de reprint.
- Log em `admin_logs` opcional (impressões falhas) — só se ficar simples, senão fica de fora.
- Manter compatibilidade total: lojas sem os novos flags assumem `true` (comportamento atual da Cantinho, sem quebrar).

## 5. QA na Cantinho da Silvia (piloto)
- Ativar os dois toggles.
- Criar pedido teste PDV → cupom sai sem clique.
- Criar pedido teste Delivery manual → cupom sai ao entrar em `recebido`.
- Validar: 1 impressão por pedido mesmo com reload/reconexão.
- Bump versão para **v1.10.398** nos dois lugares (PerfilPage + build.gradle).

## Arquivos tocados
- `src/pages/admin/tabs/SettingsTab.tsx` — UI dos toggles + teste
- `src/lib/thermalPrint.ts` — novo `printDeliveryReceipt` (se não existir equivalente)
- `src/hooks/useAutoPrintDelivery.ts` — novo, hook global
- `src/pages/AdminDashboardV2.tsx` — montar o hook
- `src/pages/pdv/state/usePdvCheckout.ts` — respeitar flag `auto_print_pdv`
- `src/pages/PerfilPage.tsx` + `android/app/build.gradle` — versão

## Fora de escopo
- Impressão via servidor / cloud print (continua sendo navegador local com a térmica configurada).
- NFC-e / SAT fiscal (é cupom não fiscal).

Posso implementar direto quando aprovar.
