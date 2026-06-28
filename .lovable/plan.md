# Plano — Termos de Uso & Política de Privacidade 100% legais + Modal de Diff Automático

## Objetivo
1. Reescrever `/termos` e `/privacidade` com base legal **real e verificável** (LGPD, CDC, MCI, BCB, ANPD, CF/88), eliminando risco de processo por publicidade enganosa, cláusula abusiva ou falta de bases legais.
2. Substituir o `TermsUpdateModal` atual (hoje hard-coded com a lista de mudanças escrita à mão) por um sistema que **calcula e mostra automaticamente só o que mudou** entre a versão aceita pelo usuário e a versão atual.

---

## Parte 1 — Conteúdo Legal (Termos + Privacidade)

### Pesquisa e base normativa obrigatória
Antes de escrever cada cláusula, validar contra a lei vigente em 2026:

| Tema | Norma | O que precisa estar correto |
|---|---|---|
| Tratamento de dados | **LGPD (Lei 13.709/18)** + Resoluções ANPD 2/22, 15/24, 18/24 | Bases legais por finalidade, direitos do titular (Art. 18), DPO nomeado, prazo de resposta 15 dias |
| Marketplace / intermediação | **Marco Civil da Internet (Lei 12.965/14)** Art. 19 | ItaSuper como provedor de aplicação, responsabilidade só após ordem judicial específica |
| Consumidor final | **CDC (Lei 8.078/90)** Art. 6º, 39, 51 | Direito de arrependimento 7d (Art. 49) — **não se aplica a alimento perecível**, mas precisa estar explícito |
| Pagamentos PIX | **Resolução BCB 1/20, 103/24, Lei 12.865/13** | ItaSuper como iniciador de pagamento (não custodiante), Asaas como IP autorizada |
| Entregadores autônomos | **CLT Art. 442-B + STF Tema 725 + RE 958.252** | Não vínculo empregatício, ressalva de pejotização |
| Lojistas (B2B) | **Código Civil Art. 421, 422** | Função social, boa-fé objetiva, denúncia com aviso prévio |
| Menor de idade | **ECA Art. 2º + LGPD Art. 14** | 18+ para lojista/entregador, 16-17 cliente com assistência, <16 vedado |
| Publicidade | **CDC Art. 37 + CONAR** | Sem promessa de "100% gratuito" se houver R$1/venda; deixar PIX R$1,99 explícito |
| Encerramento | **LGPD Art. 16** | Retenção mínima legal (5 anos fiscal — CTN Art. 173) vs. exclusão definitiva |
| Cookies | **ANPD Guia Cookies 2023** | Banner com aceite granular (essencial/analytics/marketing) |

### Estrutura final dos Termos (versão 5.0)
1. Definições (Plataforma, Lojista, Cliente, Entregador, Pedido, Pagamento, Repasse)
2. Objeto e natureza jurídica (provedor de aplicação MCI Art. 19)
3. Cadastro e elegibilidade (idade, documentos, KYC Asaas)
4. Planos e preços (tabela real: Essencial, Crescimento, Comissão, Autonomia + taxas PIX)
5. Pagamentos e repasses (D+1 Asaas, split, retenções)
6. Responsabilidades do Lojista (qualidade do produto, fiscal, sanitária)
7. Responsabilidades do Entregador (autônomo, MEI recomendado, seguro próprio)
8. Responsabilidades do Cliente (dados verídicos, pagamento)
9. Limitação de responsabilidade do ItaSuper (intermediário, não solidário pelo produto)
10. Propriedade intelectual e licença de marca
11. Condutas proibidas e sanções
12. Encerramento e portabilidade de dados
13. Resolução de conflitos (mediação → foro do consumidor CDC Art. 101)
14. Disposições gerais e vigência

### Estrutura final da Privacidade (versão 5.0)
1. Controlador e Encarregado (DPO nome+email reais)
2. Dados coletados por categoria de titular (Cliente, Lojista, Entregador)
3. Bases legais por finalidade (tabela LGPD Art. 7º e 11)
4. Compartilhamento e operadores (Asaas, Supabase, Vercel, Sentry, OneSignal, OSM, Mercado Pago, Z-API, Evolution)
5. Transferência internacional (SCC + adequação)
6. Retenção por categoria (com prazo e base — fiscal 5a, contratual 5a, marketing até revogação)
7. Direitos do titular + canal e prazo (15d)
8. Segurança (TLS, RLS, criptografia em repouso Supabase, MFA)
9. Cookies e tecnologias similares
10. Incidentes (Res. ANPD 18/24 — comunicação em prazo razoável)
11. Crianças e adolescentes
12. Alterações desta política

### Validação anti-processo (checklist obrigatório antes de publicar)
- [ ] Toda cláusula que limita direito do consumidor cita o artigo do CDC que a permite
- [ ] Nenhuma cláusula entra no rol do Art. 51 do CDC (cláusulas abusivas)
- [ ] Bases legais LGPD declaradas **por finalidade**, não genéricas
- [ ] Razão social, CNPJ, endereço e DPO reais e atualizados
- [ ] Versão, data de vigência e changelog visíveis no topo
- [ ] Linguagem clara (LGPD Art. 9º — informação clara e ostensiva)

---

## Parte 2 — Modal de Diff Automático

### Problema atual
`src/components/TermsUpdateModal.tsx` tem a constante `CHANGES` escrita à mão a cada release. Se esquecermos de atualizar, o usuário aceita texto antigo achando que é o novo → risco jurídico.

### Nova arquitetura

**Banco (Supabase externo)** — nova tabela:
```
legal_documents
  id uuid pk
  kind text check (kind in ('terms','privacy'))
  version text                    -- ex: "5.0"
  effective_date timestamptz
  content_md text                 -- markdown completo
  summary text                    -- resumo 1 parágrafo
  created_at timestamptz default now()
  unique (kind, version)
```

```
legal_document_changes
  id uuid pk
  document_id uuid fk
  section text                    -- "3.2 Cadastro"
  change_type text                -- 'added' | 'modified' | 'removed' | 'fix'
  summary text                    -- frase curta exibida no modal
  legal_basis text                -- "LGPD Art. 18" (opcional)
  display_order int
```

RLS: `SELECT` público (`anon` + `authenticated`); escrita só `service_role`.

**Fluxo do modal**:
1. App lê `profiles.terms_version_accepted` do usuário.
2. Busca `legal_documents` onde `version > aceita` (para terms e privacy).
3. Para cada versão entre a aceita e a atual, carrega `legal_document_changes` ordenados.
4. Modal renderiza **só os changes das versões intermediárias** — agrupados por versão, depois por documento (Termos/Privacidade), depois por tipo (Novo/Alterado/Correção).
5. Ao aceitar, grava em `terms_acceptance` a versão de termos **e** privacy aceitas, e atualiza `profiles.terms_version_accepted` + novo campo `privacy_version_accepted`.

**Fluxo de publicação de nova versão** (Super Admin):
- Nova aba em `SuperAdminDashboard` → "Documentos Legais"
- Editor markdown com preview
- Campo obrigatório: lista de changes (section, tipo, resumo, base legal)
- Botão "Publicar versão X.Y" → insere `legal_documents` + `legal_document_changes` em transação
- Trigger opcional: dispara push para usuários ativos

### Arquivos a criar/alterar
- `supabase/migrations/*_legal_documents.sql` — tabelas + RLS + GRANT
- `src/lib/legalDocuments.ts` — fetch helpers + cache
- `src/components/TermsUpdateModal.tsx` — refatorar para consumir o banco (zero hard-code)
- `src/pages/TermosDeUso.tsx` + `PoliticaPrivacidade.tsx` — render do markdown vindo do banco (com fallback estático)
- `src/pages/super-admin/tabs/DocumentosLegaisTab.tsx` — novo CRUD
- Seed inicial: migration que insere versão 5.0 com o texto reescrito + changelog completo desde a 4.4

---

## Detalhes Técnicos

- Markdown renderizado com `react-markdown` + `remark-gfm` (já familiar no stack)
- Cache do documento atual em `localStorage` com TTL 1h para não bater no banco a cada page view
- Hook `useLegalAcceptance()` que retorna `{ needsAcceptance, pendingChanges, accept() }` — substitui a lógica espalhada hoje
- Auditoria: `terms_acceptance` continua registrando IP (via edge function), user_agent, timestamp, versão aceita — prova LGPD Art. 8º §1º
- Edge function `legal-record-acceptance` para capturar IP do servidor (cliente não pode forjar)

---

## Entregáveis

1. **Fase A — Conteúdo** (sem código novo): rascunho dos Termos 5.0 e Privacidade 5.0 reescritos com revisão jurídica linha-a-linha, entregue em markdown para você revisar antes de eu colocar no ar.
2. **Fase B — Infra do diff**: tabelas, edge function, hook, refator do modal, aba super admin.
3. **Fase C — Migração**: seed da versão 5.0 + changelog automático desde 4.4 + reset do flag para forçar todos a reaceitarem (uma vez só).

---

## Perguntas antes de começar

1. **Razão social, CNPJ e endereço oficiais** do ItaSuper para colocar nos documentos? (hoje não tenho 100% de certeza dos dados atuais)
2. **DPO** — nome e email oficial do Encarregado de Dados?
3. Quer que eu **contrate linguagem revisada por advogado** (gero o texto com base nas leis citadas, mas a revisão final por OAB é sua responsabilidade) ou prefere que eu adicione um aviso "documento gerado, sujeito a revisão jurídica"?
4. Começo pela **Fase A (conteúdo)** ou pela **Fase B (infra do diff)**?
