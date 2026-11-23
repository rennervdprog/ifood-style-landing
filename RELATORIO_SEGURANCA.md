# Relatório de Segurança — ItaFood / ItaSuper

**Data da validação:** 14 de agosto de 2026  
**Escopo:** exposição pública de lojas, funções públicas de catálogo, consultas do frontend, auditoria RLS/Supabase e dependências Node.js.

> **Conclusão executiva:** a vulnerabilidade crítica que permitia a leitura anônima integral da tabela `public.stores` foi corrigida e validada em produção. A plataforma **não deve ser considerada integralmente endurecida** enquanto permanecerem 137 funções `SECURITY DEFINER` executáveis por visitantes, 180 executáveis por usuários autenticados e dependências com vulnerabilidades conhecidas.

| Área | Antes | Estado atual | Evidência |
|---|---|---|---|
| Tabela `public.stores` | Visitantes podiam executar `SELECT` na linha completa, com 69 colunas | **Corrigido**: `anon` não possui mais `SELECT` na tabela base | Validação de privilégio em produção: `anon_can_select_base_table = false` |
| Visão `stores_public` | Executava como definidora e expunha dados de plano e configurações completas | **Corrigido**: `security_invoker = true`, contrato explícito de campos públicos | `view_uses_security_invoker = true`; colunas sensíveis ausentes |
| Bootstrap do catálogo | `store_bootstrap` serializava `to_jsonb(s.*)` diretamente da tabela base | **Corrigido**: consulta a projeção pública limitada | `bootstrap_excludes_sensitive_keys = true` |
| Função Edge de catálogo | Parâmetro do visitante podia alternar leitura para `stores` sob credencial de serviço | **Corrigido**: lê exclusivamente `stores_public` | Chamada HTTP anônima não retornou nenhuma chave sensível |
| Frontend público | Carrinho, checkout de convidado, diretório e outras telas ainda consultavam `stores` | **Corrigido** nos fluxos públicos afetados | Compilação, testes e build concluídos |

## Atualização 23/11/2026 — itens 10, 39 e 36 (auditoria de 40 itens)

**Data:** 23 de novembro de 2026
**Escopo desta atualização:** gestão de dependências e testes de segurança no CI. Nenhuma vulnerabilidade foi corrigida neste PR — o trabalho aqui é o processo (detecção contínua); o inventário fresco vem da 1ª rodada do CI.

| Mudança | Detalhe |
|---|---|
| Dependabot (itens 10/39) | `.github/dependabot.yml` criado: updates semanais de npm, limite de 5 PRs abertos para não virar ruído. |
| `npm audit` no CI (itens 10/39/36) | Step `npm audit --audit-level=high` adicionado ao workflow `pdv-tests.yml` (o "required"). Primeira rodada **não-bloqueante** (`continue-on-error: true`) para levantar as contagens frescas; se o resultado for zero altas/críticas, o próximo PR torna o step bloqueante. |
| Guard de segurança (item 36) | Job `security-checks` em workflow dedicado (`.github/workflows/security-checks.yml`) + `scripts/security-guard.sh`. Falha o CI se o **diff** do PR introduzir `exec_sql`, `Access-Control-Allow-Origin: "*"` ou `verify_jwt = false`. Escopado ao diff: a main atual já contém esses padrões em vários arquivos, e o guard não falha no que já existe. |
| Inventário de dependências | **Inventário fresco — 1ª rodada do `npm audit` no CI, 23/11/2026 (job Vitest - PDV, run 45208038222): 46 vulnerabilidades (3 baixas, 12 moderadas, 23 altas, 8 críticas)** — pior que o inventário de 14/08/2026 (30 no total: 5 críticas, 20 altas, 3 moderadas, 2 baixas). Críticas (6 pacotes): `@capacitor/android` e `@capacitor/ios` 8.0.0–8.3.4 (conteúdo remoto na origem do app via proxy HTTP interno), `protobufjs` ≤7.6.4, `tar` ≤7.5.20, `tinypool` ≤2.1.1, `websocket-driver` ≤0.7.4. Altas (20 pacotes): `@babel/plugin-transform-modules-systemjs`, `@grpc/grpc-js`, `@remix-run/router` (XSS via open redirect), `@xmldom/xmldom`, `brace-expansion`, `browserslist`, `fast-uri`, `flatted`, `form-data`, `glob`, `js-yaml`, `lodash`, `minimatch`, `nanoid`, `picomatch`, `postcss`, `rollup`, `source-map-js`, `ws`, `zod`. **Todas as 36 ocorrências listadas têm fix disponível via `npm audit fix`** (nenhum bloco sem fix) — mas os fixes podem ser breaking e precisam de PR próprio com testes. Como há altas/críticas, **o step de audit segue não-bloqueante** (não vira bloqueante neste lote). |

**Follow-up (não neste PR):** corrigir as vulnerabilidades altas/críticas do inventário fresco, uma por uma, com PR próprio e teste (começar pelas críticas de runtime: `@capacitor/android`/`@capacitor/ios` e `@remix-run/router`); o step de audit **segue não-bloqueante** porque o CI mostrou 23 altas + 8 críticas (só viraria bloqueante com zero altas/críticas); repetir a auditoria dos 40 itens a cada 3 meses (próxima em fevereiro/2027).

## Correção implantada

A migração `20260814021000_harden_public_store_access.sql` foi aplicada ao projeto de produção. Ela removeu a política RLS **`Public can read stores`**, revogou `SELECT` da relação base para o papel `anon` e criou uma política de leitura privada para lojistas, gestores de unidade e administradores. Assim, dados financeiros, cadastrais e operacionais da loja voltam a ficar acessíveis somente a quem tem necessidade funcional e autorização apropriada.

A nova função `public.get_public_stores()` estabelece uma lista fixa de atributos que podem integrar a vitrine. Os campos excluídos incluem identificadores e chaves Asaas, CNPJ/CPF, comissão, plano, bloqueios, vínculos de revendedor e estados internos do aplicativo. O objeto `settings` também deixou de ser exposto por inteiro: a resposta preserva somente métodos de pagamento e configurações de catálogo, pizza, pastel e entrega necessárias ao cliente.

A visão `public.stores_public` foi recriada com `security_invoker = true` e recebe os dados exclusivamente dessa função limitada. Por sua vez, `store_bootstrap` deixou de serializar a linha completa de `stores`; a resposta de bootstrap preserva o formato consumido pela vitrine, mas a chave `store` passa a conter apenas a projeção pública.

| Superfície atualizada | Mudança aplicada |
|---|---|
| `GuestCheckoutPage.tsx` | Consulta de frete, PIX direto e checkout de convidado movida de `stores` para `stores_public` |
| `CartPage.tsx` | Leitura de `guest_checkout_enabled` movida para a visão pública |
| `CheckoutPage.tsx` | Consulta do identificador do lojista para notificação movida para a visão pública |
| `Index.tsx` | Catálogo da página inicial migrado para a visão pública; horários carregados separadamente |
| `StoreDirectory.tsx` | Estatística pública de cidades migrada para a visão pública |
| `DriverRideHistory.tsx` e `LiveTrackingMap.tsx` | Leituras de localização/endereço movidas para a visão pública |
| `ClientHomeContent.tsx` | Seleção pública deixou de pedir campos de plano e override comercial |
| `public-store-catalog` | Removeu a escolha de tabela pelo corpo da requisição; a Edge Function sempre usa `stores_public` |

## Validações executadas

A validação foi realizada diretamente no ambiente de produção após a migração. Ela confirmou que a tabela base não é selecionável por visitantes, a visão pública continua selecionável, a visão usa `security_invoker` e nem a visão nem o bootstrap incluem as chaves privadas verificadas. Uma chamada HTTP anônima à função de catálogo retornou uma loja, sem as propriedades `asaas_subaccount_api_key`, `cnpj_cpf`, `commission_rate` ou `plan_type`.

| Verificação | Resultado |
|---|---|
| Privilégio de `anon` em `public.stores` | **Negado** |
| Privilégio de `anon` em `public.stores_public` | **Permitido**, como requerido para a vitrine |
| Execução pública de `store_bootstrap` | **Permitida**, com payload limitado |
| `security_invoker` em `stores_public` | **Ativo** |
| Colunas sensíveis ausentes da visão | **Confirmado** |
| Chaves sensíveis ausentes do bootstrap | **Confirmado** |
| Testes automatizados | **19 arquivos / 154 testes aprovados** |
| Verificação TypeScript | **Aprovada** com `tsc -b --noEmit` |
| Build de produção | **Aprovado** com `npm run build` |

## Achados remanescentes e plano de tratamento

A auditoria pós-correção ainda reporta riscos importantes. Eles não foram revogados automaticamente porque muitos podem ser usados por cron, Edge Functions, pagamentos, PDV ou painéis administrativos; a remoção em massa sem inventário funcional poderia interromper pedidos, repasses ou operações de loja.

| Prioridade | Achado | Estado | Ação recomendada |
|---|---|---|---|
| **P0** | 137 funções `SECURITY DEFINER` executáveis por `anon` | Pendente | Inventariar cada função e revogar `EXECUTE` de `anon` por padrão; manter somente endpoints públicos documentados, como bootstrap e cálculos estritamente necessários. As funções `admin_*`, cobrança, estoque, cancelamento e repasse devem exigir usuário autenticado e validar papel no corpo da função. [1] |
| **P0** | 180 funções `SECURITY DEFINER` executáveis por `authenticated` | Pendente | Aplicar o princípio do menor privilégio por função. A autorização deve ocorrer tanto no `GRANT EXECUTE` quanto dentro das rotinas com efeito financeiro ou administrativo. [1] |
| **P1** | 7 funções com `search_path` mutável | Pendente | Recriar as funções com `SET search_path = public, pg_temp` e referências qualificadas, especialmente as que usam `SECURITY DEFINER`. [2] |
| **P1** | Proteção contra senhas vazadas desativada no Auth | Pendente, requer configuração | Habilitar a verificação de senha vazada nas configurações de autenticação do Supabase e comunicar a nova regra de senha. [3] |
| **P1** | `ext-sql-runner` sem JWT | Aceito temporariamente | Manter segredo forte, rotacionável e fora do código; preferir JWT assinado ou restringir por rede/IP quando a integração permitir. Revisar logs e chamadas antes de qualquer alteração. |
| **P2** | Tabelas com RLS sem políticas: `asaas_subaccounts_registry`, `whatsapp_inbound_log`, `whatsapp_send_log` | Informativo | Confirmar que não há `GRANT` para papéis cliente. Sem política, o RLS bloqueia por padrão; documentar esse comportamento. [4] |
| **P2** | Dependências npm vulneráveis | Em andamento (23/11/2026) — Dependabot + `npm audit` no CI; inventário fresco registrado: 46 vulnerabilidades (3 baixas, 12 moderadas, 23 altas, 8 críticas) | A auditoria de 14/08/2026 identificou **5 críticas, 20 altas, 3 moderadas e 2 baixas**. Atualizar em uma branch de teste, revisar mudanças incompatíveis e executar testes de checkout, PIX, PDV, WebSocket e Capacitor antes de publicar. |
| **P3** | `owner_id` ainda aparece no contrato público | Risco aceito com mitigação | Ele atende ao chat/notificação atual. Em uma fase posterior, substituir por um identificador público ou uma função de notificação do servidor para não expor UUIDs de usuários. |

## Recomendações operacionais

A próxima rodada de segurança deve começar pela classificação das funções `SECURITY DEFINER` em quatro grupos: pública e somente leitura, pública com criação controlada, autenticada por perfil e exclusivamente interna/cron. Em seguida, cada grupo deve receber permissões explícitas, `search_path` imutável e testes de autorização negativa. Essa abordagem reduz o risco sem descontinuar silenciosamente fluxos de pedido, pagamento e repasse.

Também é recomendável adotar uma rotina de revisão antes de cada publicação: auditoria do Supabase, auditoria npm, verificação de políticas de tabelas alteradas e teste de um visitante anônimo contra as rotas REST/RPC expostas. A documentação oficial do Supabase descreve a interpretação dos alertas de função, RLS e proteção de credenciais nas referências abaixo.

## Referências

[1]: https://supabase.com/docs/guides/database/database-linter?lint=0028 "Supabase — Funções SECURITY DEFINER executáveis publicamente"
[2]: https://supabase.com/docs/guides/database/database-linter?lint=0011 "Supabase — search_path mutável em funções"
[3]: https://supabase.com/docs/guides/database/database-linter?lint=0014 "Supabase — Proteção contra senhas vazadas"
[4]: https://supabase.com/docs/guides/database/database-linter?lint=0008 "Supabase — RLS habilitado sem política"
