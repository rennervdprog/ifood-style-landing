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
| **P2** | Dependências npm vulneráveis | Pendente | A auditoria atual identificou **5 críticas, 20 altas, 3 moderadas e 2 baixas**. Atualizar em uma branch de teste, revisar mudanças incompatíveis e executar testes de checkout, PIX, PDV, WebSocket e Capacitor antes de publicar. |
| **P3** | `owner_id` ainda aparece no contrato público | Risco aceito com mitigação | Ele atende ao chat/notificação atual. Em uma fase posterior, substituir por um identificador público ou uma função de notificação do servidor para não expor UUIDs de usuários. |

## Recomendações operacionais

A próxima rodada de segurança deve começar pela classificação das funções `SECURITY DEFINER` em quatro grupos: pública e somente leitura, pública com criação controlada, autenticada por perfil e exclusivamente interna/cron. Em seguida, cada grupo deve receber permissões explícitas, `search_path` imutável e testes de autorização negativa. Essa abordagem reduz o risco sem descontinuar silenciosamente fluxos de pedido, pagamento e repasse.

Também é recomendável adotar uma rotina de revisão antes de cada publicação: auditoria do Supabase, auditoria npm, verificação de políticas de tabelas alteradas e teste de um visitante anônimo contra as rotas REST/RPC expostas. A documentação oficial do Supabase descreve a interpretação dos alertas de função, RLS e proteção de credenciais nas referências abaixo.

## Referências

[1]: https://supabase.com/docs/guides/database/database-linter?lint=0028 "Supabase — Funções SECURITY DEFINER executáveis publicamente"
[2]: https://supabase.com/docs/guides/database/database-linter?lint=0011 "Supabase — search_path mutável em funções"
[3]: https://supabase.com/docs/guides/database/database-linter?lint=0014 "Supabase — Proteção contra senhas vazadas"
[4]: https://supabase.com/docs/guides/database/database-linter?lint=0008 "Supabase — RLS habilitado sem política"
