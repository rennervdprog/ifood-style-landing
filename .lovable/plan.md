# Plano — Profissionalização da Thermal Print

Objetivo: garantir que **todo pedido** (delivery e PDV) imprima de forma consistente, completa e legível em impressoras 58/80mm, sem perder nenhum dado (adicionais, bordas, tamanhos, complementos, observações, endereço completo, formas de pagamento, troco, agendamento, cupom).

Hoje há **2 funções separadas** (`printThermalReceipt` para delivery e `printPdvReceipt` para PDV) que duplicam lógica de itens/addons e divergem em pequenos detalhes (ex.: PDV não imprime endereço, delivery não suporta split de pagamento, número do pedido aparece como "#ABCDEF12" curto, observações ficam quase invisíveis).

## Fase 1 — Auditoria (sem alterar código)

Comparar **linha a linha** o que cada fluxo envia vs o que a impressão exibe. Saída: tabela com gaps por categoria.

Checklist mínimo a validar em cada fluxo:

| Campo                          | Delivery | PDV | Hoje | Esperado |
|--------------------------------|----------|-----|------|----------|
| Número do pedido (sequencial)  | sim      | sim | só os 8 primeiros chars do UUID | nº curto + UUID curto |
| Data/hora                      | sim      | sim | ok   | ok |
| Loja                           | sim      | sim | ok   | + CNPJ/telefone/endereço da loja |
| Cliente (nome/telefone)        | sim      | n/a | ok   | ok |
| Endereço completo (rua, nº, compl., bairro, cidade, CEP, referência) | sim | n/a | só `address_details + neighborhood` | quebrar em campos |
| Mesa/comanda                   | n/a      | sim | ok   | ok |
| Itens (qtd, nome, unit., total)| sim      | sim | unit. só no PDV | mostrar nos dois |
| Tamanho da pizza               | sim      | sim | ok   | ok |
| Borda                          | sim      | sim | ok   | ok |
| Sabores (pizza meio-a-meio)    | sim      | sim | depende de `getOrderItemDisplayName` | validar com pedido 1/2 + 1/2 |
| Adicionais obrigatórios        | sim      | sim | ok   | ok |
| Adicionais opcionais           | sim      | sim | ok   | ok |
| Complementos / brindes         | sim      | sim | ok   | ok |
| Observações do item            | sim      | sim | fonte pequena | destacar igual delivery (⚠ OBS) |
| Observação geral do pedido     | sim      | sim | **não imprime** | adicionar |
| Subtotal                       | sim      | sim | ok   | ok |
| Taxa de entrega                | sim      | n/a | ok   | ok |
| Cupom aplicado                 | sim      | n/a | só nome no desconto | linha própria |
| Desconto                       | sim      | sim | ok   | ok |
| Total                          | sim      | sim | ok   | ok |
| Forma de pagamento             | sim      | sim | delivery não suporta split | unificar |
| Split de pagamento             | n/a      | sim | só PDV | manter |
| Troco para / recebido / troco  | sim parcial | sim | delivery só "troco para" | imprimir recebido+troco quando houver |
| Pago online (Pix) vs receber   | sim      | sim | ok   | ok |
| Agendamento                    | sim      | n/a | ok   | ok |
| Origem (delivery/balcão/mesa)  | implícito| implícito | confuso | banner explícito |
| QR Code do pedido (rastreio)   | não      | não | -    | opcional, fase 4 |
| Rodapé Asaas                   | sim      | sim | ok   | ok |

## Fase 2 — Núcleo único de impressão

Extrair para `src/lib/thermalPrint/` um único motor:

```text
src/lib/thermalPrint/
  index.ts            // re-exports
  types.ts            // ReceiptModel (normalizado)
  normalize.ts        // PrintOrder/PrintPdvOrder -> ReceiptModel
  renderItems.ts      // bloco de itens (addons, borda, tamanho, complemento, obs)
  renderTotals.ts     // subtotal, entrega, cupom, desconto, total
  renderPayment.ts    // simples + split + troco
  renderHeader.ts     // loja, data, nº pedido, mesa, agendamento, origem
  renderAddress.ts    // endereço completo do cliente
  renderFooter.ts     // agradecimento + Asaas
  print.ts            // monta HTML final e chama window.print()
  styles.css          // tokens 58mm/80mm
```

Os dois entry-points públicos atuais (`printThermalReceipt`, `printPdvReceipt`) viram wrappers finos que só fazem `normalize → render`. Zero quebra de chamadores.

## Fase 3 — Correções pontuais (junto com Fase 2)

1. **Número do pedido**: usar `order_number` (sequencial por loja) quando existir, com fallback ao UUID curto. Imprimir nos 2 fluxos como `PEDIDO #1234` em fonte grande + `ref: ABCDEF12` pequeno.
2. **Endereço**: dividir em linhas — `Rua/Nº`, `Complemento`, `Bairro`, `Cidade/UF`, `CEP`, `Referência`. Hoje vem tudo concatenado em `address_details`; ler de `delivery_address` quando disponível.
3. **Observação geral do pedido** (`orders.notes` / `observations`): imprimir bloco destacado antes do total.
4. **Cupom**: linha própria `Cupom (CODIGO): -R$ X,XX` separada do desconto manual.
5. **Split no delivery**: aceitar `payments[]` igual ao PDV.
6. **Recebido / Troco no delivery**: quando `payment_method=dinheiro` e tiver `change_for`, imprimir bloco igual PDV.
7. **Banner de origem**: faixa preta no topo — `DELIVERY`, `BALCÃO`, `MESA 03`, `RETIRADA`.
8. **Loja**: imprimir telefone e CNPJ da loja no cabeçalho (útil pro cliente).
9. **CSS dedicado**: mover estilos inline para `thermalPrint.css` com `@media print` e largura 58mm/80mm parametrizável.
10. **Quebra de página por via**: opção de imprimir 2 vias (cozinha + cliente) com `page-break-after`.

## Fase 4 — Cobertura por testes (Vitest)

Estender `src/lib/__tests__/thermalPrint.test.ts` com cenários reais:

- Pedido delivery completo com endereço, cupom, troco para, observação geral.
- Pedido com pizza meio-a-meio + borda + complemento grátis.
- PDV com split (3 métodos) e desconto.
- Pedido agendado.
- Pedido só Pix online (sem troco, marca PAGO).
- Garantir que **nenhum campo do banco é silenciosamente descartado** (snapshot do HTML).

Meta: ~15 testes novos. Após verde, bump de versão.

## Fase 5 — Opcionais (acordar depois)

- QR code pequeno com link de acompanhamento do pedido.
- Logo da loja no topo (configurável em `store_settings`).
- Modo 58mm vs 80mm automático (detectar via setting da loja).
- Suporte ESC/POS nativo via Capacitor para impressoras Bluetooth (hoje usa `window.print`).

## Decisões a confirmar antes de codar

1. Quer manter `printThermalReceipt` e `printPdvReceipt` como API pública (wrappers) ou pode trocar para `printReceipt(model)` único?
2. Posso usar `orders.order_number` (sequencial por loja) — confirmar que essa coluna existe no banco externo, senão crio.
3. Imprimir 2 vias (cozinha + cliente) por padrão ou só sob configuração?
4. Largura padrão: 58mm ou 80mm?

Após aprovação executo Fases 1→4 numa única release, com bump de versão e suíte de testes verde.
