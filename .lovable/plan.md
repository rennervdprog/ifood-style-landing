## Diagnóstico — por que estão sendo deslogados hoje

Auditei o fluxo de auth e achei **4 causas reais**:

1. **Checkbox "Lembre-me" com prazo de 2 meses** (`AuthContext.tsx` linhas 33-52): mesmo marcando "lembrar", após 60 dias o `enforceRememberMe` força `signOut()`. Cliente que pede uma vez por mês passa perto do limite.
2. **"Lembre-me" desmarcado = logout ao fechar aba/app** (linha 40): `remember="0" + !session_alive → signOut`. No app Capacitor, quando o Android mata o processo em background, o `sessionStorage` some e o cliente é deslogado no próximo abrir. Muitos clientes desmarcaram sem entender.
3. **Device único forçado** (`check_device_active` linhas 75-106): a cada 30s roda RPC; se o cliente abre no celular depois no navegador do PC, ou depois de trocar de celular, é deslogado com "Sua conta foi acessada em outro dispositivo". Anota.ai/MenuDino **não fazem isso** para cliente.
4. **Tokens antigos inválidos** (auth logs: `bad_jwt: token signature is invalid`): tokens salvos antes da migração pro Supabase externo continuam no `localStorage` e falham silenciosamente sem tentar refresh — o cliente vê "sessão expirada".

## Objetivo

Cliente/Lojista/Entregador logam **uma vez** e permanecem logados por tempo indefinido, igual Anota.ai. Só saem se clicarem em "Sair" ou trocarem a senha.

## Mudanças

### Fase 1 — Sessão perpétua para clientes
Arquivo: `src/contexts/AuthContext.tsx`

- Remover o corte de 2 meses (`REMEMBER_UNTIL`).
- Remover o modo `remember="0"` (deslogar ao fechar). Cliente **sempre** persiste.
- Manter `persistSession: true` + `autoRefreshToken: true` (já ok em `client.ts`).
- Ao detectar token inválido no `getSession()` inicial (`bad_jwt`, `refresh_token_not_found`), **limpar apenas o localStorage do supabase** e redirecionar para `/auth` sem toast agressivo — hoje só falha silenciosamente.

### Fase 2 — Device único só para lojista/admin (opcional)
Arquivo: `src/contexts/AuthContext.tsx`, `AuthPage.tsx`

- Rodar `check_device_active` **apenas quando o usuário for role `admin_loja` ou `super_admin`** (checagem via `user_roles`). Cliente e entregador nunca são deslogados por device.
- Motivo: cliente precisa poder usar o app no celular e no PC ao mesmo tempo (mesmo caso do WhatsApp Web).

### Fase 3 — Remover checkbox "Lembre-me" da tela do cliente
Arquivo: `src/pages/AuthPage.tsx`

- Ocultar o checkbox (default = sempre lembrar).
- Manter o checkbox visível **só na aba lojista/admin**, onde faz sentido por segurança.

### Fase 4 — Refresh proativo em background
Arquivo: `src/contexts/AuthContext.tsx`

- Adicionar `setInterval` de 30 min chamando `supabase.auth.refreshSession()` quando o app está visível — evita que o token expire silenciosamente em abas paradas ou apps Capacitor em background prolongado.
- Ao voltar do background (`visibilitychange` → `visible`), forçar `refreshSession()` uma vez para renovar o JWT antes de qualquer query.

### Fase 5 — Capacitor: storage nativo persistente
Arquivo: `src/integrations/supabase/client.ts`

- No app nativo, usar `@capacitor/preferences` como `storage` em vez de `localStorage`. Sobrevive a limpeza de cache do Android/iOS e a atualização do APK.
- Web continua com `localStorage` normal.

### Fase 6 — Limpeza dos tokens órfãos
- Migration one-shot no bootstrap: se detectar chave `sb-<PROJETO_ANTIGO>-auth-token` no localStorage, remover. Elimina os `bad_jwt` que hoje aparecem nos logs.

## Detalhes técnicos

- Supabase JWT expira em 1h por padrão; `autoRefreshToken` já cuida enquanto o app está aberto. O problema é o **refresh token** que também expira (padrão 30 dias sem uso). Vou verificar `configure_auth` para elevar o `refresh_token_reuse_interval` e garantir sliding window (cada refresh renova por mais 30 dias — assim quem abre o app pelo menos 1x/mês nunca é deslogado).
- Device tracking permanece em `user_active_devices` mas passa a ser **auditoria** (registra), não **kick** (não expulsa), para clientes/entregadores.
- Toda mudança no Supabase externo (via secrets `EXTERNAL_SUPABASE_*`).

## Fora de escopo

- Não mexer em fluxo de recuperação de senha (`RecoveryRedirect` já ok).
- Não mexer no PIN do cliente.
- Não mudar o comportamento do `SignOutConfirm` (botão "Sair" continua funcional).

## Versão

Bump para **v1.10.399** ao final, com aviso "Atualização: agora você fica logado permanentemente".
