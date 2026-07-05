# Plano — Checkout sem login por WhatsApp (piloto Itatinga)

Ouvi o áudio. Resumo do que a lojista pediu: cliente reclama que precisa se cadastrar. Ela quer o fluxo do "Insta Delivery": monta o pedido, e só no fim informa nome, telefone (WhatsApp) e endereço (com CEP). Se o telefone já for reconhecido, puxar o endereço automaticamente. Ligar isso **apenas para Itatinga** por enquanto e, se der certo, expandir.

## Objetivo
Permitir finalizar pedido **sem criar conta**. Identificação por telefone; endereço salvo por telefone é reaproveitado nas próximas compras.

## Escopo do piloto
- Ativar somente em lojas da cidade **Itatinga** (feature flag por `city_slug` ou por loja).
- Nada muda para as demais cidades.
- Cliente logado continua usando o fluxo atual (endereços salvos, fidelidade etc.).

## Fluxo proposto (guest)
1. Carrinho → botão "Finalizar pedido" **não pede login**.
2. Tela única de checkout com 3 blocos:
   - **WhatsApp** (input com máscara). Ao digitar 11 dígitos → busca perfil guest pelo telefone.
     - Se achar: pré-preenche nome + último endereço, mostrando "Olá, {nome} 👋 — usar o mesmo endereço?".
     - Se não achar: pede nome.
   - **Endereço**: CEP → autofill (rua/bairro), nº, complemento, referência. Bairro deve bater com `neighborhood_fees` da loja (tarifa de entrega).
   - **Pagamento**: PIX / dinheiro / cartão na entrega (mesmo do fluxo atual).
3. Confirmar → cria pedido vinculado ao telefone (sem `user_id`).
4. Acompanhamento do pedido via link enviado no WhatsApp + tela `/pedido/{codigo}` acessível por telefone+código (sem login).

## Backend (Supabase externo `qkjhguziuchqsbxzruea`)
- Nova tabela `guest_customers` (telefone normalizado E.164 como chave):
  - `phone` (unique), `name`, `last_address_json`, `store_id_first_seen`, `city_slug`, `created_at`, `updated_at`.
- Nova tabela `guest_addresses` (histórico, 1 telefone → N endereços):
  - `phone`, `label`, `cep`, `street`, `number`, `complement`, `neighborhood`, `reference_point`, `is_last_used`.
- Ajuste em `orders`:
  - `guest_phone`, `guest_name` (nullable) — usados quando `user_id IS NULL`.
- **RLS**: leitura/gravação somente via **Edge Function** `guest-checkout` com `service_role`. Nada exposto ao cliente via PostgREST anon (evita enumerar telefones).
- Edge Functions novas:
  - `guest-lookup` (POST `{phone}`) → devolve `{name, lastAddress}` **ou 404**. Rate-limit por IP (ex.: 10/min) para não virar vetor de enumeração.
  - `guest-checkout` (POST): valida telefone, cria/atualiza `guest_customers`+`guest_addresses`, cria `order`, retorna `orderCode` + token curto de acompanhamento.
  - `guest-order-status` (GET `{code, phoneLast4}`) → status do pedido sem login.

## Frontend
- Feature flag: `store.city_slug === "itatinga"` **e** `store.guest_checkout_enabled = true` (novo bool, default false).
- Novo componente `<GuestCheckoutForm />` reaproveitando `SavedAddressPicker`/`fetchCep`.
- Roteamento: se flag ativa e usuário deslogado, `CheckoutPage` renderiza fluxo guest em vez de redirecionar para `/auth`.
- Página pública `/p/{orderCode}` para acompanhamento (sem sessão).
- Notificação WhatsApp com link do pedido (usa fluxo existente `src/lib/whatsapp.ts`).

## Segurança
- Telefone normalizado + validado (regex BR).
- `guest-lookup` **não** revela se telefone existe para outra loja — só devolve dados se a última compra for na mesma loja/cidade.
- Rate-limit + captcha invisível se abusar.
- LGPD: aviso curto "ao continuar você concorda com os Termos". Guardar `consent_at`.
- Pedidos guest **não** entram em programa de fidelidade nem cupom recorrente (evita fraude).
- Fraude: reaproveitar `src/lib/fraudCheck.ts` por telefone + IP.

## Rollout
1. Migration + Edge Functions no Supabase externo.
2. Ativar flag apenas para as lojas de Itatinga.
3. Monitorar por 1–2 semanas: taxa de conversão carrinho→pedido, chamados de suporte, fraude.
4. Se ok, expor a flag para lojistas de outras cidades habilitarem.

## Fora do escopo (agora)
- Login mágico por SMS/OTP (fica para v2 se necessário).
- Migrar guest para conta permanente (fluxo "criar conta a partir do último pedido" — v2).
- Mudança do fluxo padrão em outras cidades.

## Detalhes técnicos (resumo)

```text
[Carrinho] → [Checkout Guest]
                │
                ├─ phone(11d) ──► guest-lookup ──► preenche nome+endereço
                │
                ├─ CEP ──► viacep ──► autofill
                │
                └─ [Confirmar] ──► guest-checkout ──► order criada
                                                        │
                                                        └─► WhatsApp com link /p/{code}
```

Aguardo aprovação para implementar. Nada foi alterado ainda.
