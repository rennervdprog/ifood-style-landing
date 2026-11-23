# Autoavaliação de conformidade — LGPD (item 40)

**Data da avaliação:** 23/11/2026
**Próxima revisão:** maio/2027 (a cada 6 meses, junto com a auditoria
dos 40 itens — próxima em fevereiro/2027 — e com a revisão trimestral
de acessos; a data exata da próxima revisão deste documento é maio/2027)
**Responsável:** Muse (revisão e aprovação: Renner)
**Controlador:** Renner Vinicius Dias — MEI, CNPJ 66.155.289/0001-26,
Rua São Francisco, 635, Itatinga/SP
**Enquadramento:** agente de tratamento de **pequeno porte** (MEI),
nos termos da Resolução CD/ANPD nº 2/2022.

Este documento é uma **autoavaliação** — não é uma auditoria externa,
não é certificação e não substitui aconselhamento jurídico. Ele existe
para registrar, item por item, o que o ItaSuper já cumpre, o que está
parcial e o que falta, com a evidência de cada ponto.

**Documentos-base:** Política de Privacidade v6.8
(`src/content/legal/privacy_v6_8.md`), Termos de Uso v6.8
(`src/content/legal/terms_v6_8.md`), Política de Cookies (`/cookies`),
`docs/runbook-incidentes.md`, `docs/operadores.md` e o plano da
auditoria de 40 itens (`~/workspace/auditoria-40-itens/PLANO.md`).

**Legenda de status:** ✅ conforme · 🟡 parcial · 🔴 pendente ·
⏳ depende do Renner (painel/decisão).

---

## Parte A — Resolução CD/ANPD nº 2/2022 (agente de pequeno porte)

A Resolução nº 2/2022 flexibiliza obrigações para agentes de pequeno
porte (MEI, microempresa, empresa de pequeno porte, entre outros).
Flexibilizar não é dispensar de tudo: os direitos dos titulares, a
segurança e a comunicação de incidentes continuam valendo.

| # | Exigência (Res. 2/2022) | Status | Evidência / observação |
|---|---|---|---|
| A1 | **Enquadramento como pequeno porte** — o tratamento observa as regras simplificadas próprias do porte. | ✅ | Controlador é MEI (CNPJ 66.155.289/0001-26), declarado nos Termos §1 e §18 e na Política §1. |
| A2 | **Encarregado (DPO) — dispensa com canal mantido.** O agente de pequeno porte é dispensado de indicar encarregado, desde que disponibilize canal de comunicação com o titular. | ✅ | Canal mantido: `Itasupersuporte@gmail.com` (Política §8 e §9). Não há encarregado nomeado — é a dispensa prevista, não uma falta. |
| A3 | **Registro das operações de tratamento (art. 37) — versão simplificada.** O registro pode ser simplificado, mas deve existir: categorias de dados, finalidades, bases legais e destinatários. | 🟡 | As tabelas existem na Política (§3, §4 e §5: categoria, base legal, finalidade e destinatário). Falta um registro único consolidado fora da política — hoje a informação está espalhada entre a política e o código. |
| A4 | **Prazo em dobro para atendimento aos direitos dos titulares** (15 → 30 dias) e para comunicação de incidente à ANPD, conforme a flexibilização da resolução. | 🟡 | A Política (§8 e §9) adota o prazo de 15 dias — **mais rigoroso** que o prazo dobrado permitido. O fluxo operacional (fila de pedidos, registro e prazo visível) ainda não existe: item 17 do plano (tela "Meus dados", tabela `lgpd_requests`, fila no `JuridicoTab`). Até o item 17 sair, o prazo curto é promessa sem rotina. |
| A5 | **Relatório de Impacto (RIPD) — dispensado, salvo tratamento de alto risco.** | ✅ | Não há tratamento de alto risco mapeado (não há dado sensível em larga escala nem decisão automatizada com efeito relevante). Se surgir, o RIPD passa a ser obrigatório — registrar aqui. |
| A6 | **Medidas de segurança compatíveis com o porte** (art. 46 da LGPD, na medida do pequeno porte). | 🟡 | Existem: HTTPS + HSTS + CSP (item 4), RLS em 158 tabelas, Bearer JWT, senha mínima 8, logs com mascaramento. Faltam: MFA (item 1, decisão S3 pendente do Renner), `beforeSend` no Sentry e varredura de logs das edges (item 32), rate limit de login (item 8). Ver `docs/runbook-incidentes.md`, seção 8. |
| A7 | **Comunicação de incidente à ANPD e aos titulares** (art. 48 da LGPD) — procedimento e prazo. | 🟡 | Compromisso na Política (§9: 3 dias úteis). Procedimento operacional, templates e checklist criados em 23/11/2026 em `docs/runbook-incidentes.md`, seção 6. Nunca executado — sem incidente registrado até hoje. |

---

## Parte B — Resolução CD/ANPD nº 15/2024 (transferência internacional de dados)

A Resolução nº 15/2024 regula a transferência internacional de dados
pessoais: só é permitida para país/organismo com decisão de adequação
da ANPD ou mediante garantias — cláusulas-padrão contratuais (SCCs),
cláusulas contratuais específicas, normas corporativas globais ou
outro mecanismo previsto.

| # | Exigência (Res. 15/2024) | Status | Evidência / observação |
|---|---|---|---|
| B1 | **Mapeamento das transferências internacionais** — saber para onde os dados vão. | ✅ | Política §10: Supabase, Vercel, Google/Firebase e Lovable/Gemini — todos nos EUA. |
| B2 | **Mecanismo de garantia para cada destino** — cláusulas-padrão contratuais ou decisão de adequação. | ✅ | Política §10 declara cláusulas contratuais padrão (SCCs) para Supabase, Vercel, Google e Lovable. |
| B3 | **Transparência ao titular sobre a transferência** (país de destino e garantias). | ✅ | Política §10 publica destino e mecanismo. |
| B4 | **Contratos com os operadores que recebem os dados fora do país** (DPA/cláusulas de tratamento). | 🔴 | Nenhum DPA ou contrato de tratamento foi localizado no repositório (item 20 do plano: `grep` por DPA/subprocessador = zero). Ver `docs/operadores.md` — os DPAs estão pendentes e dependem do Renner (baixar/conferir os termos de cada fornecedor). A afirmação de SCCs na política é a declaração do fornecedor; o documento que a sustenta ainda não foi guardado. |

---

## Parte C — LGPD (Lei nº 13.709/2018) — checklist geral

| # | Exigência (LGPD) | Status | Evidência / observação |
|---|---|---|---|
| C1 | **Bases legais documentadas** (art. 7º) | ✅ | Política §4 e §3.1: contrato, obrigação legal, legítimo interesse, consentimento, geolocalização. Item 12 do plano: TEM. |
| C2 | **Finalidades determinadas e informadas** (art. 6º, I) | ✅ | Política §3, §4 e §5. Item 14 do plano: TEM. |
| C3 | **Política de Privacidade publicada e atualizada** | ✅ | `/politica-de-privacidade`, v6.8 vigente (v6.7 no banco; publicar a 6.8 é passo pendente — ver PLANO, item 4). Item 11: TEM. |
| C4 | **Termos de Uso publicados** | ✅ | v6.8 vigente desde 21/10/2026. Item 21: TEM. |
| C5 | **Consentimento — aceite legal registrado com prova** | ✅ | `recordLegalAcceptance` grava a prova em `terms_acceptance` antes de atualizar `profiles`; checkbox no cadastro; `TermsUpdateModal`. |
| C6 | **Consentimento de cookies/analytics com banner e preferências** | ✅ | Banner + centro de preferências ao vivo desde 21/11/2026 (itens 15 e 16; PRs #823/#824). Página `/cookies` publicada. |
| C7 | **Direitos dos titulares (art. 18)** — acesso, correção, anonimização, portabilidade, eliminação, revogação. | 🟡 | Política §8 lista os direitos e o canal. O titular vê/corrige dados no perfil (`PerfilPage.tsx`) e pode excluir a conta (item 18: TEM). Falta o fluxo self-service de acesso/portabilidade/anonimização com registro e prazo — item 17 do plano. |
| C8 | **Exclusão de dados com prova** | ✅ | "Excluir minha conta" + confirmação digitando "EXCLUIR" → edge `delete-account` (arquiva, anonimiza, apaga, exclui o usuário auth). Ressalva: nunca executado em produção (`archived_accounts` com 0 linhas); o prazo de eliminação do arquivo ainda não é aplicado em código — item 18, ligado ao item 19. |
| C9 | **Minimização de dados** (art. 6º, III) | ⏳ | Contradição aberta: a política (§2/§3) diz que o ItaSuper "não trata CNH, CRLV ou contrato do motoboy", mas o produto **exige** CNH + foto + selfie para aprovar motoboy (`AdminApprovals.tsx`). Decisão do Renner pendente (item 13: opção A — corrigir a política; opção B — parar de exigir). |
| C10 | **Retenção e eliminação (prazos)** | 🟡 | Prazos declarados na Política §7 (cadastro: conta ativa + 5 anos; pedidos: 5 anos; logs de segurança/fraude: 6 meses; suporte: 2 anos; backups: máx. 90 dias). Nenhuma rotina aplica os prazos — não há job de purge/anonimização (item 19, decisão de escopo pendente do Renner). |
| C11 | **Segurança técnica** (art. 46) | 🟡 | Ver A6. Estado atual: bom na base (RLS, TLS, CSP, JWT), com lacunas conhecidas e listadas no plano (itens 1, 2, 8, 9, 32, 33). |
| C12 | **Registro de incidentes e comunicação** (art. 48) | 🟡 | Ver A7. |
| C13 | **Contratos com operadores (DPA)** (art. 39) | 🔴 | Ver B4 / item 20. |
| C14 | **Criptografia em repouso** | 🟡 | Repouso = criptografia gerenciada do Supabase (documentado em `docs/operadores.md`, nota do item 3). Sem criptografia em nível de coluna (`profiles.document`, `profiles.pix_key`) — é opcional e só com a palavra do Renner (item 3, esforço G com risco de migração). |
| C15 | **Transparência sobre IA** | ✅ | Termos §12 declaram o uso de IA (Sales Coach) e o direito a revisão humana. Rótulo "com IA" na interface é o item 30 (código + preview, ainda não feito). |
| C16 | **Transparência de preços e de cobranças** | ✅ | Tabela de preços nos Termos §6.1, na página de planos e na landing (item 22: TEM). O detalhamento da taxa de R$ 0,99 no checkout é decisão pendente do Renner (item 23) — não é falta de conformidade, é decisão comercial documentada desde 06/11/2026. |

---

## Parte D — Auditoria externa e certificação (avaliadas e adiadas)

| Caminho | Decisão | Motivo |
|---|---|---|
| Auditoria externa de conformidade | **Adiada** | Custa caro; o porte (MEI, agente de pequeno porte) não exige. |
| Certificação ISO 27001 / SOC 2 | **Adiada** | Mesmo motivo. Reavaliar se o volume de lojistas, o faturamento ou o tratamento de dados sensíveis mudar de patamar. |
| Autoavaliação documentada (este arquivo) | **Adotada** | Gratuita, revisada a cada 6 meses junto com a auditoria dos 40 itens. |

A decisão de adiar foi registrada para não reabrir o assunto sem motivo.
Se um lojista, parceiro ou edital passar a exigir certificação, este
item volta à pauta com o custo real na mesa.

---

## Resumo da avaliação (23/11/2026)

- **Conformes:** 11 itens (A1, A2, A5, B1, B2, B3, C1–C6, C15, C16).
- **Parciais:** 8 itens (A3, A4, A6, A7, C7, C10, C11, C14) — a maioria
  com a correção já descrita no plano da auditoria de 40 itens.
- **Pendentes:** 2 itens (B4, C13) — o mesmo problema: **DPAs dos
  operadores**, que dependem do Renner (item 20).
- **Aguardando decisão do Renner:** 1 item (C9 — CNH do motoboy, item 13).

Nenhum item desta autoavaliação exige ferramenta paga. O maior risco
aberto é o mesmo da auditoria: **os DPAs** (B4/C13) e a **rotina de
retenção** (C10/item 19).

---

## Histórico de revisões

| Data | Responsável | O que mudou |
|---|---|---|
| 23/11/2026 | Muse | Criação — primeira autoavaliação (Res. 2/2022 e 15/2024 + LGPD). |
