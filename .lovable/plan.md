## Pedido Delivery Manual (lançado pela lojista no PDV)

Objetivo: a lojista recebe o pedido pelo WhatsApp/telefone e lança no sistema como **pedido delivery normal** — usando a taxa configurada da loja, gerando notinha, indo pro motoboy e contando nos relatórios. Diferente do PDV "balcão" hoje (que é venda presencial sem entrega).

---

### 1. Onde fica o botão

Dentro do **PDV**, ao lado do botão atual "Nova Venda Balcão", adicionar:

```text
[ + Venda Balcão ]   [ + Pedido Delivery Manual ]
```

Mesma tela, mesmo carrinho do PDV — só muda o modo.

---

### 2. Fluxo da tela (3 passos)

**Passo 1 — Cliente**
- Nome (obrigatório)
- Telefone/WhatsApp (obrigatório — usado pra mensagem automática depois)
- Busca: se o telefone já existir em `profiles`, preenche nome/endereço automaticamente
- PIN: gerado automático (4 dígitos) já que cliente não tem app

**Passo 2 — Endereço de entrega**
- Reaproveita o `AddressModal` já existente (CEP, rua, número, bairro, GPS)
- Calcula taxa de entrega usando **a mesma função do checkout** (`calculateStoreOwnDeliveryFee`) → respeita raio, bairro, split lojista/cliente igualzinho
- Mostra a taxa calculada na tela pra lojista confirmar

**Passo 3 — Itens + Pagamento**
- Mesmo carrinho do PDV (busca produto, adiciona, addons, peso, etc.)
- Forma de pagamento: Dinheiro / Pix / Cartão débito / Cartão crédito / Maquininha externa
- Campo "troco para" se for dinheiro
- Botão **Finalizar Pedido**

---

### 3. O que acontece ao finalizar

Cria registro em `orders` exatamente como um pedido do app, com:

- `order_type = 'delivery'`
- `order_source = 'manual'` (novo campo — pra distinguir nos relatórios)
- `status = 'preparing'` (já entra direto em preparo, pula "novo")
- `delivery_fee` = taxa calculada
- `commission_rate` = mesma do plano da loja
- `delivery_pin` = PIN gerado
- `payment_method`, endereço, itens, tudo igual

**Efeitos automáticos (reaproveita o que já existe):**
- ✅ Imprime notinha térmica (58/80mm)
- ✅ Aparece pro motoboy no app dele com PIN preenchido (Cantinho já tem `driver_pin_autofill`)
- ✅ Conta no fechamento de caixa do PDV (vendas do dia)
- ✅ Conta nos relatórios e no financeiro (comissão de plataforma se aplica)
- ✅ Dispara WhatsApp automático pro cliente com status do pedido (se telefone válido)

---

### 4. Decisão importante (precisa sua resposta)

**Comissão da plataforma nesses pedidos manuais:**

- **Opção A:** Cobra normal (6% ou R$ 2 por entrega, igual pedido do app) — consistente, simples
- **Opção B:** Não cobra comissão em pedido manual — argumento: a plataforma não captou esse cliente, foi a lojista
- **Opção C:** Cobra só a taxa de entrega (R$ 2 do motoboy/split) mas não os 6% — meio termo

Hoje a Cantinho está no plano **Comissão 6%**. Recomendo **Opção A** por consistência (e porque o motoboy/notinha/sistema estão sendo usados), mas é decisão sua.

---

### 5. Detalhes técnicos (não-técnicos podem pular)

- Banco externo: adicionar coluna `orders.order_source TEXT DEFAULT 'app'` com valores `app | manual | pdv_balcao`
- Novo componente: `src/components/pdv/PdvDeliveryManualDialog.tsx` (wizard 3 passos)
- Reaproveita: `AddressModal`, `calculateStoreOwnDeliveryFee`, `usePdvCart`, `safePrint`, `evolution-webhook`
- Hook novo: `usePdvDeliveryManual.ts` (orquestra criação do pedido)
- Cliente "fantasma": se telefone não existe em `profiles`, cria registro mínimo com `client_id` gerado (igual já fazemos pra guest checkout) — assim PIN/endereço ficam salvos pra próxima vez
- Fechamento de caixa: incluir pedidos `order_source='manual'` no resumo do turno
- Relatórios: adicionar filtro/badge "Manual" pra lojista enxergar separado

---

### 6. Fases de entrega

1. **Fase 1** — coluna `order_source` no banco + botão e wizard no PDV (cliente + endereço + itens + pagamento)
2. **Fase 2** — integração com impressora, motoboy, WhatsApp (reaproveitando triggers existentes)
3. **Fase 3** — fechamento de caixa + relatórios mostrando "Manual" separado
4. **Fase 4** — piloto só na Cantinho da Silvia, validar 1 semana, depois liberar pra todas

---

**Me responda:**
1. Opção A, B ou C pra comissão?
2. Pode prosseguir com as 4 fases ou quer ajustar algo?
