# Plano: corrigir "Não foi possível atualizar status" no toggle Online

## Causa raiz (confirmada no banco externo)
O botão faz `upsert` na tabela `drivers`. Motoboys vinculados a loja (Silvio) **não têm linha** em `drivers` — só em `store_drivers`. Portanto o upsert precisa **INSERIR**, mas a policy atual bloqueia:

```
"No direct driver insert"  →  WITH CHECK (false)
"Drivers can update own online status"  →  só UPDATE
```

Resultado: qualquer motoboy sem registro prévio recebe erro de RLS ao tentar ficar online, e o status volta para offline.

## Correção

### 1. Migração RLS no Supabase externo
Substituir a policy de insert por uma que permita o próprio motoboy criar sua linha, mantendo bloqueio para terceiros:

```sql
DROP POLICY "No direct driver insert" ON public.drivers;

CREATE POLICY "Drivers can insert own record"
  ON public.drivers
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
```

Mantém as demais policies (read/update/delete) intactas. Sem exposição extra: só o próprio usuário autenticado pode criar a linha dele.

### 2. Endurecer o upsert no cliente
Em `src/components/StoreDriverView.tsx` (função `toggleOnline`):
- Logar o `error.message` real (hoje só mostra toast genérico), para diagnóstico futuro.
- Manter `onConflict: user_id` e defaults (`is_active: true`, `name`).

### 3. Bump de versão
- `src/pages/PerfilPage.tsx` → `v1.10.408`
- `android/app/build.gradle` → `versionName "1.10.408"`, `versionCode 737`

### 4. Validação
- Testar via Playwright logado como Silvio: alternar online → confirmar sucesso e persistência após reload.
- Rodar `security--run_security_scan` para confirmar que a nova policy não abre brecha.

## Detalhes técnicos
- A migração roda direto no projeto externo (`qkjhguziuchqsbxzruea`) via script/mgmt API — não usa `supabase/migrations` do Lovable Cloud.
- Nenhuma mudança em edge functions ou fluxo de pedidos.
