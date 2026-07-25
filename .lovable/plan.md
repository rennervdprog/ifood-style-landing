# Plano — Padronizar "Sair da conta" em todo o app

## Diagnóstico

Já existe o componente `SignOutConfirm` (`src/components/SignOutConfirm.tsx`) com o fluxo ideal:
1. AlertDialog "Deseja realmente sair?" (Cancelar / Sair)
2. Overlay fullscreen com spinner + **"Saindo... Até logo! 👋"** (600ms)
3. `signOut()` + toast + redirect

**Telas que JÁ usam o padrão ✅**
- `PerfilPage` (cliente/lojista)
- `AdminDashboardV2` (lojista)
- `DriverDashboardV2` (motoboy)
- `ModeradorDashboard`

**Telas que chamam `signOut()` direto (sem confirmação nem overlay) ❌**
- `ResellerDashboard.tsx` — botão header
- `revendedor/ResellerPerfil.tsx` — botão "Sair da conta"
- `MatrizDashboard.tsx` — botão header
- `SupportAgentDashboard.tsx` — botão header
- `pdv/components/PdvTopbar.tsx` — item de menu "Sair" (PDV Only e modo lojista)

## Correções

Trocar cada `onClick={signOut}` por `<SignOutConfirm>` envolvendo o botão existente, mantendo o estilo visual atual de cada tela. Redirect por contexto:
- Revendedor → `/revendedor/auth`
- Matriz / Support / PDV lojista → `/portal-parceiro`
- Cliente → `/`

Assim toda saída passa a ter:
- Confirmação "Deseja realmente sair?"
- Animação de fade + "Saindo... Até logo! 👋"
- Toast de sucesso
- Redirect coerente com o tipo de usuário

## Validação

- Playwright/manual: clicar em Sair em cada tela acima e confirmar diálogo + overlay + redirect correto.
- Sem mudança de lógica de auth — só UI/UX consistente.

## Versão

Bump patch em `src/lib/appVersion.ts`, `PerfilPage.tsx` e `android/app/build.gradle` (versionName + versionCode +1).
