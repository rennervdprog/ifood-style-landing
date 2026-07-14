## Objetivo

Deixar o bot do WhatsApp 100% funcional no Supabase **externo**, sem quebrar o resto. Todas as informações abaixo foram conferidas no código real.

---

## Fatos verificados

- **Rota da loja**: `src/App.tsx` tem `Route path="/:slug"` (linha 439) → `itasuper.com.br/pastelao-carioca` funciona. Link canônico do bot = `https://itasuper.com.br/{stores.slug}` (sem `/loja/`).
- **Handler atual** (`supabase/functions/whatsapp-bot-handler/index.ts`, 528 linhas) já roda 100% no externo (usa `EXTERNAL_SUPABASE_URL` + `EXTERNAL_SUPABASE_SERVICE_KEY`, sem fallback).
- Fluxo atual: `welcome → awaiting_name → categoria → produto → mais? → tipo entrega → rua → número → bairro → referência → pagamento → confirma`. Já grava `address_street/number/neighborhood/reference` + `address_details` na `orders`. Já faz upsert em `profiles(phone, full_name, delivery_pin)`.
- **Bugs reais**:
  1. Sempre pergunta o nome (não olha `profiles.phone` antes).
  2. Não oferece endereço anterior (não lê `saved_addresses`, não grava lá).
  3. Welcome é só texto — sem escolha "Pedir aqui" x "Cardápio online".
  4. Pix escolhido no bot vira `payment_method: "pix"` em pedido comum — **não** usa `create_pix_direto_order` mesmo com `stores.pix_direto_enabled=true`.
- Anti-ban: `evolution-send-message` já tem presença "digitando", delay log-normal, gap por telefone, jitter em retry e pausa longa em rate-limit — o bot herda tudo porque manda por lá.

---

## Fluxo novo

```text
[cliente manda qualquer coisa]
   ↓
Normaliza telefone (só dígitos) e busca profiles.phone
   ├── achou → context.client_id + context.client_name; saudação "Olá, {Nome}!"
   └── novo  → saudação "Olá! 👋 Bem-vindo à {loja}."
   ↓
Envia menu com 3 opções (texto numerado, compatível com Evolution):
   1️⃣ Pedir pelo WhatsApp
   2️⃣ Ver cardápio online
   3️⃣ Falar com atendente
   ↓
   ├── 2 → envia "https://itasuper.com.br/{slug}" + encerra sessão
   ├── 3 → escape (limpa sessão, "atendente vai responder")
   └── 1 → se já tem nome pula awaiting_name; senão pergunta
             ↓ fluxo atual (categoria → produto → carrinho)
   ↓
[Delivery]
   ├── busca saved_addresses do client_id (mais recente)
   │     → "Entregar em: {resumo}? 1) Sim  2) Outro endereço"
   ├── Sim  → reusa (grava em context.address)
   └── Outro/sem → rua → número → bairro → referência → grava em saved_addresses (upsert)
   ↓
[Pagamento] (accepted_payment_methods do bot ∩ métodos da loja)
   ├── Pix + stores.pix_direto_enabled → fluxo Pix Direto (abaixo)
   ├── Pix sem pix_direto → cria pedido normal payment_method=pix
   ├── Dinheiro → pergunta troco
   └── Cartão → cartão na entrega
   ↓
Cria pedido → UPSERT profiles(phone, full_name) → limpa sessão
```

### Sub-fluxo Pix Direto no bot

1. Chama RPC `create_pix_direto_order` (já existe no externo — em `scripts/pix-direto-external.sql`) passando items, endereço, subtotal, delivery_fee, total.
2. Envia mensagem formatada com `stores.pix_direto_key` + `pix_direto_key_type` + `pix_direto_beneficiary` + valor + `pix_direto_instructions`.
3. Novo passo `awaiting_pix_proof`: quando cliente manda imagem, o webhook baixa via Evolution (`/message/downloadMedia`), sobe no bucket `pix-proofs` como `{store_id}/{order_id}.jpg` e chama `attach_pix_proof(order_id, path, anon_session)`.
4. Responde: "✅ Comprovante recebido! O lojista vai confirmar em instantes."
5. Se cliente mandar texto em vez de imagem: reforça "Envie a foto do comprovante".
6. Timeout já garantido pelo `pix_expires_at` (20min) + RPC `expire_pending_pix_orders`.

---

## Mudanças arquivo por arquivo

### `supabase/functions/whatsapp-bot-handler/index.ts`  (único arquivo alterado)

Adições:

- `normalizePhone(p)` = só dígitos, sem `+`.
- No welcome:
  - `SELECT user_id, full_name FROM profiles WHERE phone = <normalized> LIMIT 1`.
  - Envia saudação personalizada + menu 3 opções.
  - Novo step `awaiting_main_menu`.
- Case `awaiting_main_menu`: `"2"` → link cardápio + `clearSession`; `"3"` → escape; `"1"` → pula direto pra `awaiting_category` se já tem nome, senão `awaiting_name`.
- Antes de `askStreet`: se `client_id`, busca `saved_addresses WHERE user_id=... ORDER BY created_at DESC LIMIT 1`; se achou, novo step `awaiting_address_choice` com resumo + [Sim/Outro].
- Depois de coletar endereço completo (após `awaiting_reference`): `upsert saved_addresses` com onConflict lógico (user_id + street + number + neighborhood).
- No `askPayment`: se `payment_method === "pix"` **e** `store.pix_direto_enabled` **e** `store.pix_direto_key` → rota Pix Direto (RPC + mensagem + `awaiting_pix_proof`).
- Novo step `awaiting_pix_proof`: no webhook, quando `messageType === "imageMessage"`, baixar via Evolution, upload no bucket `pix-proofs`, chamar `attach_pix_proof`.
- Cap anti-ban interno: `min gap 1200ms` entre mensagens pro mesmo telefone dentro do handler (além do que evolution-send-message já faz).

### `supabase/functions/evolution-webhook/index.ts`

- Ao receber `MESSAGES_UPSERT`, se a sessão do telefone estiver em `awaiting_pix_proof` **e** a msg for imagem, passar `mediaUrl` + `mimeType` pro bot-handler no lugar de `text`.

### Sem migrations

Colunas já existem: `profiles.phone/full_name/delivery_pin`, `saved_addresses.user_id/street/number/neighborhood/reference`, `stores.pix_direto_*`, `orders.address_*`. Bucket `pix-proofs` e RPCs `create_pix_direto_order` / `attach_pix_proof` já existem (script `scripts/pix-direto-external.sql`).

### Versão

- `src/pages/PerfilPage.tsx`: bump patch (v1.15.23).
- `android/app/build.gradle`: `versionName "1.15.23"` + `versionCode` +1 (983).

---

## Segurança

- `phone` sempre normalizado antes de query (`replace(/\D/g,"")`).
- Colisão de número entre 2 clientes: se `profiles` retornar mais de 1, usar o mais recente e não expor nome antigo (comparar `updated_at`).
- RPCs mantêm `SECURITY DEFINER` já auditadas; nenhuma nova exposição.
- Upload no bucket `pix-proofs` só via service key dentro da edge function (bucket segue privado; políticas storage inalteradas).

---

## Checklist manual

1. Cliente novo → "oi" → menu 3 opções.
2. Opção 2 → recebe `itasuper.com.br/pastelao-carioca` e sessão zera.
3. Opção 1 (cliente novo) → pede nome → fluxo até pedido criado com endereço no card do lojista.
4. Mesmo número volta e manda "oi" → "Olá, {Nome}!" + menu, sem pedir nome de novo.
5. Segundo pedido → oferece endereço anterior; aceitar reusa; recusar pede novo e salva.
6. Loja com Pix Direto → mensagem com chave/beneficiário; cliente manda foto; pedido aparece como `comprovante_enviado` no painel.
7. Loja sem Pix Direto → opção Pix cai no fluxo antigo (pedido normal).
8. Palavra "atendente" em qualquer step → escape.

Confirma pra eu implementar?
