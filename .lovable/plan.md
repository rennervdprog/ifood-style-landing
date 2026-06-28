
## Diagnóstico

Hoje existem **dois cadastros diferentes** de cliente:

- `/auth` (`src/pages/AuthPage.tsx`) — o da sua screenshot: pede só WhatsApp + senha. **Não pede PIN, nome, CPF nem endereço.**
- `/cliente` (`src/pages/cliente/auth/ClientAuthScreen.tsx`) — já pede nome, CPF, WhatsApp e PIN (4 dígitos + confirmação + alerta).

O **backend já está pronto** e funcionando:

- `profiles.delivery_pin` existe (CHECK `^[0-9]{4}$`).
- Trigger `generate_delivery_pin` em `orders` busca o PIN do `profiles` do cliente daquele pedido — cada pedido nasce com o PIN próprio do dono.
- RPC `driver_finish_delivery(_order_id, _pin)` compara o PIN digitado com `orders.delivery_pin` e só finaliza se bater.
- Entregador (`StoreDriverView.tsx`) já tem campo de PIN, geofence de chegada e validação offline.
- `ClientPinChecker` global força clientes antigos a definir PIN antes de qualquer ação.

**Conclusão:** o fluxo do PIN próprio por cliente já está 100% funcional no banco e no app do entregador. O que falta é só a tela `/auth` coletar PIN + endereço no cadastro novo.

## Objetivo

Cadastro único, completo e funcional em `/auth`, igual ao do `/cliente`, com:

1. Nome completo
2. CPF/CNPJ
3. WhatsApp
4. **Endereço principal** (CEP, rua, número, complemento, bairro, ponto de referência)
5. **PIN de 4 dígitos + confirmação + checkbox de ciência**
6. Aceite de Termos

## Plano de execução

### Passo 1 — Reescrever o formulário de signup em `src/pages/AuthPage.tsx`
Adicionar ao modo `signup` os mesmos campos do `ClientAuthScreen.tsx`:

- Nome completo, CPF/CNPJ (com `formatDocument` / `validateDocument`).
- Bloco "PIN de entrega" reutilizando o componente visual atual (alerta `ShieldCheck` + 2 inputs `tel` numéricos + checkbox `pinAcknowledged`).
- Bloco "Endereço principal" com: CEP (busca via `@/lib/location/cep`), rua, número, complemento, bairro, ponto de referência. Auto-preenche rua/bairro ao digitar CEP válido.
- Mesmas validações: PIN 4 dígitos, PINs iguais, checkbox marcado, endereço com pelo menos CEP + rua + número + bairro.

### Passo 2 — Persistir tudo no signup
No bloco `mode === "signup"` já existente (linhas 241-267):

- Passar `full_name`, `document`, `delivery_pin` em `options.data` do `supabase.auth.signUp`.
- Após criar usuário, fazer:
  - `UPDATE profiles` com `full_name`, `document`, `whatsapp_number`, `delivery_pin`, `terms_accepted_at`.
  - `INSERT INTO saved_addresses` com `is_default: true` e os campos do endereço informado.
- `terms_acceptance` continua como hoje.

### Passo 3 — Garantia de PIN no pedido (já existe, só conferir)
Nenhuma alteração de código necessária. Conferir após o passo 2:

- `profiles.delivery_pin` gravado no signup → trigger copia para `orders.delivery_pin` em todo novo pedido → entregador digita o PIN → RPC compara com `orders.delivery_pin` (PIN do dono daquele pedido). Cliente A não consegue liberar pedido do cliente B.

### Passo 4 — Versão e revisão de segurança
- Bump de `APP_VERSION` em `src/lib/appVersion.ts` e `android/app/build.gradle` (versionName + versionCode).
- Revisão rápida: validar input client-side (já com zod-like checks manuais), CEP via Nominatim/ViaCEP sem expor secrets, RLS de `saved_addresses` (cliente só insere o próprio — confirmar a policy existente cobre `auth.uid() = user_id`).

## Detalhes técnicos

- Arquivos tocados: **apenas** `src/pages/AuthPage.tsx`, `src/lib/appVersion.ts`, `android/app/build.gradle`.
- **Sem migração de banco**, sem mudar trigger nem RPC, sem mexer em `StoreDriverView`, `ClientPinChecker`, `ClientAuthScreen`. Zero risco de quebrar fluxo do entregador.
- Reaproveita helpers já existentes: `formatDocument`, `validateDocument`, `maskWhatsApp`, `@/lib/location/cep`.
- O `ClientPinChecker` global continua sendo a rede de segurança para qualquer conta antiga que entre por `/auth` sem PIN.

## Fluxo final do PIN (após o plano)

```text
Cadastro /auth ──► profiles.delivery_pin = "1234"
                         │
Cliente faz pedido ──► trigger copia para orders.delivery_pin = "1234"
                         │
Entregador chega ──► geofence abre card de PIN
                         │
Digita "1234" ──► driver_finish_delivery valida contra orders.delivery_pin
                         │
              ✅ confere → entrega finalizada
              ❌ não confere → erro "Código inválido"
```

PIN é **por cliente**, não global, não aleatório.
