-- ============================================================================
-- LIMPEZA — FASE 0 DO SISTEMA DE MATRIZ (ItaSuper)
-- Arquivo: limpeza-fase0.sql | Branch: feat/matriz-fase0-fase1
-- Gerado em 28/10/2026 a partir de levantamento só-leitura no banco ao vivo.
--
-- ⚠️  NÃO EXECUTAR SEM A PALAVRA DO RENNER.
-- Este script NÃO foi executado. Ele só existe para ser revisado e, quando o
-- Renner disser, rodado UMA VEZ, com revisão dos SELECTs de conferência (§0 e §6).
-- Rode dentro de uma transação (BEGIN ... COMMIT) e confira os counts antes
-- do COMMIT. Se qualquer count divergir do esperado, ROLLBACK e avise.
--
-- Resumo do que faz (nesta ordem, do menos para o mais destrutivo):
--   §1 cancela os planos ativos das lojas de teste (para a cobrança de novembro)
--   §2 marca is_test = true nas lojas de teste (somem da vitrine; reversível)
--   §3 remove as 2 Duda lanches (lojas fake, decisão fechada do Renner)
--   §4 apaga as 16 redes 'Rede Teste…' + a Pizzaria Fake e rebaixa 12 perfis
--   §5 (OPCIONAL, comentado) Loja Demonstração = demo do Mc Batata — só com
--       confirmação do Renner.
--   §6 conferência final (só SELECT).
-- NÃO TOCA: rede Graal, loja Maristela, Rede Maristela (aguarda decisão),
-- as 10 lojas reais restantes, nenhum perfil de usuário (só cargo/vínculo).
--
-- Por que esta ordem: (1) o plano precisa ser cancelado antes, porque a função
-- de cobrança (monthly-billing) NÃO olha is_test — só is_active e vencimento;
-- (2) os pedidos da Duda Teste precisam ser apagados antes da loja, porque a
-- ligação pedido→loja é NO ACTION (o DELETE da loja falharia); (3) as 3
-- transações failed da Duda Teste são apagadas explicitamente por id, porque a
-- coluna store_id NÃO aceita nulo e a ligação é CASCADE — apagar a loja as
-- apagaria de qualquer jeito; os dados completos estão em limpeza-fase0-lista.md;
-- (4) os perfis são desvinculados antes das redes, para o cargo não ficar
-- quebrado (a ligação rede→perfil é SET NULL, mas o cargo não muda sozinho).
-- ============================================================================

BEGIN;

-- §0 — CONFERÊNCIA PRÉVIA (só leitura; confira os números antes de continuar).
-- Esperado em 28/10/2026:
--   lojas totais 37 | na vitrine (stores_public) 25 | is_test=true 4
--   planos ativos 35, soma R$ 1.085,49 | redes 19 | Rede Teste 16
SELECT (SELECT count(*) FROM public.stores) AS lojas_totais,
       (SELECT count(*) FROM public.stores_public) AS lojas_na_vitrine,
       (SELECT count(*) FROM public.stores WHERE is_test = true) AS lojas_is_test,
       (SELECT count(*) FROM public.store_plans WHERE is_active = true) AS planos_ativos,
       (SELECT coalesce(sum(monthly_fee), 0) FROM public.store_plans WHERE is_active = true) AS mrr_total,
       (SELECT count(*) FROM public.store_networks) AS redes_totais,
       (SELECT count(*) FROM public.store_networks WHERE name LIKE 'Rede Teste%') AS redes_teste;

-- §1 — CANCELAR OS PLANOS ATIVOS DAS LOJAS DE TESTE (R$ 517,89/mês no total).
-- Cada UPDATE só toca o plano da loja certa (store_id explícito).
-- A Duda Teste está incluída aqui (o plano dela é cancelado antes de a loja ser
-- apagada no §3; o DELETE da loja removeria a linha do plano por CASCADE).
-- A Loja Demonstração (demo do Mc Batata) NÃO está aqui — ver §5 opcional.
UPDATE public.store_plans SET is_active = false WHERE store_id = '71462610-0086-4619-a1fe-8788daf924a9' AND is_active = true; -- Duda lanches Teste (R$ 89,90)
UPDATE public.store_plans SET is_active = false WHERE store_id = 'f4cb37d3-5c08-4207-b00c-ea1fa9d3260b' AND is_active = true; -- Sandbox PDV (R$ 69,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = 'a001a767-f087-418b-a7ab-cb7a900fee0d' AND is_active = true; -- E2E Boutique (R$ 69,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '1825c9d1-6646-4247-9a77-301300803371' AND is_active = true; -- E2E Roupas Teste (R$ 69,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '363c52e2-6477-4aae-89df-6ad8224e5c71' AND is_active = true; -- RennerPdv (R$ 69,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '802ce29a-3f2a-4bc8-8146-78028b31477b' AND is_active = true; -- Teste PDV Restaurante (R$ 69,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '86e2532c-0a38-4e3a-878b-8aa61ca28f6c' AND is_active = true; -- ItaSuper Woovi Sandbox Billing - NAO UTILIZAR (R$ 3,99)
UPDATE public.store_plans SET is_active = false WHERE store_id = '0aa44391-57fa-4b51-b87b-47096977d1a5' AND is_active = true; -- Loja Teste E2E 6 (R$ 10,00)
-- Planos de teste com valor R$ 0,00 (também cancelados, para não virarem cobrança
-- se um valor for colocado depois):
UPDATE public.store_plans SET is_active = false WHERE store_id = 'cfd1c8a0-bc9b-405b-9e29-6c67bfbd98f9' AND is_active = true; -- E2E Admin (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '6be2202e-f72e-4251-8106-7dfbf3e6fb24' AND is_active = true; -- ItaSuper E2E Loja B 2026 (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '7373d988-a1f6-46bb-8fc2-10e623767bf1' AND is_active = true; -- Loja 3tes (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = 'c7894fb8-7848-434b-ae10-0c9578c597d4' AND is_active = true; -- Loja Teste E2E (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = 'ef837d8c-1baa-4be1-9392-8360e85927a4' AND is_active = true; -- Loja Teste E2E 2 (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '0d25ea08-8526-4e2f-9920-924ab9ee3f32' AND is_active = true; -- Loja Teste E2E 3 (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '8449543a-8774-40be-bdf3-e54d0a65806d' AND is_active = true; -- Loja Teste E2E 4 (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = 'f1f64e18-e828-4e36-a7b2-b1b3bc07333f' AND is_active = true; -- Loja Teste E2E 5 (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '95f97bfb-dbab-41f5-93da-9b14bf512fbd' AND is_active = true; -- Loja Teste Exploracao (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '2bb3e19d-8299-4976-a194-dee0bb5e4eb0' AND is_active = true; -- Loja Teste UI UX - Nao Utilizar (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '4cb1762e-7eaa-4466-b544-67055d072d73' AND is_active = true; -- PDV Only Teste (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '912a6c6f-4c66-4bbc-9ad3-f8a95e25f32f' AND is_active = true; -- Playwright Audit Loja 2026 (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '7093439a-6fa9-4e07-adf7-26b04adfb356' AND is_active = true; -- Playwright Audit Loja 2026B (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = 'aa6de20b-6189-4955-a182-d1c41a410b57' AND is_active = true; -- Sandbox Burger (R$ 0,00)
UPDATE public.store_plans SET is_active = false WHERE store_id = '667bef59-0b67-4da5-9837-ce07b7427d09' AND is_active = true; -- Sandbox Sushi (R$ 0,00)

-- §2 — MARCAR is_test = true NAS LOJAS DE TESTE (somem da vitrine; reversível).
-- 13 na vitrine + 7 ocultas = 20 lojas. Cada UPDATE tem guarda por id E nome.
-- As 4 que já têm is_test = true não precisam de UPDATE. A Duda Teste não está
-- aqui — ela é apagada no §3. A Loja Demonstração está no §5 opcional.
UPDATE public.stores SET is_test = true WHERE id = '6be2202e-f72e-4251-8106-7dfbf3e6fb24' AND name = 'ItaSuper E2E Loja B 2026' AND is_test IS DISTINCT FROM true; -- ItaSuper E2E Loja B 2026
UPDATE public.stores SET is_test = true WHERE id = '912a6c6f-4c66-4bbc-9ad3-f8a95e25f32f' AND name = 'Playwright Audit Loja 2026' AND is_test IS DISTINCT FROM true; -- Playwright Audit Loja 2026
UPDATE public.stores SET is_test = true WHERE id = '7093439a-6fa9-4e07-adf7-26b04adfb356' AND name = 'Playwright Audit Loja 2026B' AND is_test IS DISTINCT FROM true; -- Playwright Audit Loja 2026B
UPDATE public.stores SET is_test = true WHERE id = 'cfd1c8a0-bc9b-405b-9e29-6c67bfbd98f9' AND name = 'E2E Admin' AND is_test IS DISTINCT FROM true; -- E2E Admin
UPDATE public.stores SET is_test = true WHERE id = '7373d988-a1f6-46bb-8fc2-10e623767bf1' AND name = 'Loja 3tes' AND is_test IS DISTINCT FROM true; -- Loja 3tes
UPDATE public.stores SET is_test = true WHERE id = 'c7894fb8-7848-434b-ae10-0c9578c597d4' AND name = 'Loja Teste E2E' AND is_test IS DISTINCT FROM true; -- Loja Teste E2E
UPDATE public.stores SET is_test = true WHERE id = 'ef837d8c-1baa-4be1-9392-8360e85927a4' AND name = 'Loja Teste E2E 2' AND is_test IS DISTINCT FROM true; -- Loja Teste E2E 2
UPDATE public.stores SET is_test = true WHERE id = '0d25ea08-8526-4e2f-9920-924ab9ee3f32' AND name = 'Loja Teste E2E 3' AND is_test IS DISTINCT FROM true; -- Loja Teste E2E 3
UPDATE public.stores SET is_test = true WHERE id = '8449543a-8774-40be-bdf3-e54d0a65806d' AND name = 'Loja Teste E2E 4' AND is_test IS DISTINCT FROM true; -- Loja Teste E2E 4
UPDATE public.stores SET is_test = true WHERE id = 'f1f64e18-e828-4e36-a7b2-b1b3bc07333f' AND name = 'Loja Teste E2E 5' AND is_test IS DISTINCT FROM true; -- Loja Teste E2E 5
UPDATE public.stores SET is_test = true WHERE id = '95f97bfb-dbab-41f5-93da-9b14bf512fbd' AND name = 'Loja Teste Exploracao' AND is_test IS DISTINCT FROM true; -- Loja Teste Exploracao
UPDATE public.stores SET is_test = true WHERE id = '2bb3e19d-8299-4976-a194-dee0bb5e4eb0' AND name = 'Loja Teste UI UX - Nao Utilizar' AND is_test IS DISTINCT FROM true; -- Loja Teste UI UX - Nao Utilizar
UPDATE public.stores SET is_test = true WHERE id = 'f4cb37d3-5c08-4207-b00c-ea1fa9d3260b' AND name = 'Sandbox PDV' AND is_test IS DISTINCT FROM true; -- Sandbox PDV
UPDATE public.stores SET is_test = true WHERE id = 'a001a767-f087-418b-a7ab-cb7a900fee0d' AND name = 'E2E Boutique' AND is_test IS DISTINCT FROM true; -- E2E Boutique
UPDATE public.stores SET is_test = true WHERE id = '1825c9d1-6646-4247-9a77-301300803371' AND name = 'E2E Roupas Teste' AND is_test IS DISTINCT FROM true; -- E2E Roupas Teste
UPDATE public.stores SET is_test = true WHERE id = '4cb1762e-7eaa-4466-b544-67055d072d73' AND name = 'PDV Only Teste' AND is_test IS DISTINCT FROM true; -- PDV Only Teste
UPDATE public.stores SET is_test = true WHERE id = '363c52e2-6477-4aae-89df-6ad8224e5c71' AND name = 'RennerPdv' AND is_test IS DISTINCT FROM true; -- RennerPdv
UPDATE public.stores SET is_test = true WHERE id = '4392f565-c2cc-4369-abef-1f2e5bb9792d' AND name = 'Teste Boutique Boutique' AND is_test IS DISTINCT FROM true; -- Teste Boutique Boutique
UPDATE public.stores SET is_test = true WHERE id = '802ce29a-3f2a-4bc8-8146-78028b31477b' AND name = 'Teste PDV Restaurante' AND is_test IS DISTINCT FROM true; -- Teste PDV Restaurante
UPDATE public.stores SET is_test = true WHERE id = '36af181b-894f-45b6-8650-35c3e98b27df' AND name = 'Teste Restaurante Restaurante' AND is_test IS DISTINCT FROM true; -- Teste Restaurante Restaurante

-- §3 — REMOVER AS 2 DUDA LANCHES (decisão fechada do Renner, 28/10/2026).
-- PRÉ-CONDIÇÃO: a loja real tem 0 produtos e o único cardápio da Duda (41
-- produtos) está na cópia de teste. Se o cardápio precisar ser preservado,
-- copie-o para a loja real ANTES de rodar este bloco.
--
-- §3.1 As 3 transações failed da Duda Teste (R$ 70,00 cada, total R$ 210,00).
-- Apagadas explicitamente por id. Não dá para preservá-las soltando a ligação:
-- financial_transactions.store_id NÃO aceita nulo e a ligação é CASCADE.
-- Nenhuma foi paga (status failed, Asaas, commission_charge). Dados completos
-- em limpeza-fase0-lista.md (refs #MENS-6EE748A6, #MENS-9A803596, #MENS-2ABC42E7).
DELETE FROM public.financial_transactions WHERE id = 'df45396e-4cef-432e-8926-824e2fc276d4' AND store_id = '71462610-0086-4619-a1fe-8788daf924a9' AND status = 'failed'; -- #MENS-6EE748A6 R$ 70,00
DELETE FROM public.financial_transactions WHERE id = 'ee9fc13f-179e-408b-ae84-9dd1e1fe188d' AND store_id = '71462610-0086-4619-a1fe-8788daf924a9' AND status = 'failed'; -- #MENS-9A803596 R$ 70,00
DELETE FROM public.financial_transactions WHERE id = '0cbf80df-297c-4876-b4c1-7af1d0badd26' AND store_id = '71462610-0086-4619-a1fe-8788daf924a9' AND status = 'failed'; -- #MENS-2ABC42E7 R$ 70,00
-- §3.2 Os 31 pedidos de teste da Duda Teste (todos 'finalizado', R$ 16.504,00,
-- todos em dinheiro, sem pagamento online e sem repasse). O DELETE da loja
-- falharia sem este passo, porque orders.store_id é NO ACTION.
DELETE FROM public.orders WHERE store_id = '71462610-0086-4619-a1fe-8788daf924a9'; -- 31 pedidos de teste, esperado: 31 linhas
-- §3.3 As 2 lojas (guardas por id E nome). Produtos, seções, horários e planos
-- vão junto por CASCADE. A dona da Duda real NÃO é apagada (só a loja).
DELETE FROM public.stores WHERE id = '71462610-0086-4619-a1fe-8788daf924a9' AND name = 'Duda lanches Teste'; -- cópia de teste, sem dono, 41 produtos
DELETE FROM public.stores WHERE id = '74f95812-85af-4e71-96bd-6db7a5dd5f12' AND name = 'Duda lanches'; -- loja real, dona mariaeduardagori@icloud.com, 0 produtos

-- §4 — APAGAR AS REDES DE TESTE E REBAIXAR OS PERFIS.
-- §4.1 Rebaixar os 12 perfis (cargo volta a 'lojista', vínculo zerado).
-- Nenhum usuário é apagado. Guardas por id E e-mail.
-- 9 donos de Rede Teste com cargo lojista_matriz:
UPDATE public.profiles SET role = 'lojista', network_id = NULL, unit_store_id = NULL WHERE id = '7f979bb5-123a-4b3d-a6bf-109cd325b5b4' AND email = 'teste-matriz+1781457087026@itasuper.com.br' AND role = 'lojista_matriz'; -- dono da Rede Teste 1781457087026
UPDATE public.profiles SET role = 'lojista', network_id = NULL, unit_store_id = NULL WHERE id = '2702d079-3b66-4d56-b995-404d12e9e5c8' AND email = 'teste-matriz+1782267210576@itasuper.com.br' AND role = 'lojista_matriz'; -- dono da Rede Teste 1782267210576
UPDATE public.profiles SET role = 'lojista', network_id = NULL, unit_store_id = NULL WHERE id = 'eec8f2cf-614b-4777-a8d5-c35fa76564a0' AND email = 'teste-matriz+1782329722426@itasuper.com.br' AND role = 'lojista_matriz'; -- dono da Rede Teste 1782329722426
UPDATE public.profiles SET role = 'lojista', network_id = NULL, unit_store_id = NULL WHERE id = '9d863fe1-1809-4ae8-aa88-3b14bcb78a18' AND email = 'teste-matriz+1782682058126@itasuper.com.br' AND role = 'lojista_matriz'; -- dono da Rede Teste 1782682058126
UPDATE public.profiles SET role = 'lojista', network_id = NULL, unit_store_id = NULL WHERE id = 'e56c2eaa-2e12-48ec-bc6f-bc3f996d7731' AND email = 'teste-matriz+1783190914871@itasuper.com.br' AND role = 'lojista_matriz'; -- dono da Rede Teste 1783190914871
UPDATE public.profiles SET role = 'lojista', network_id = NULL, unit_store_id = NULL WHERE id = '82a15b82-e6ed-49dd-822f-9b261fa7a79d' AND email = 'teste-matriz+1783191024964@itasuper.com.br' AND role = 'lojista_matriz'; -- dono da Rede Teste 1783191024964
UPDATE public.profiles SET role = 'lojista', network_id = NULL, unit_store_id = NULL WHERE id = '5f9fb060-cc58-4b77-ac3a-167262583c6b' AND email = 'teste-matriz+1783652683029@itasuper.com.br' AND role = 'lojista_matriz'; -- dono da Rede Teste 1783652683029
UPDATE public.profiles SET role = 'lojista', network_id = NULL, unit_store_id = NULL WHERE id = '2e1cb61b-4599-4f37-93b3-90ef5a0655f5' AND email = 'teste-matriz+1783652798457@itasuper.com.br' AND role = 'lojista_matriz'; -- dono da Rede Teste 1783652798457
UPDATE public.profiles SET role = 'lojista', network_id = NULL, unit_store_id = NULL WHERE id = '8eb3a23a-ff6f-452f-9c2f-8c3b4a759311' AND email = 'teste-matriz+1783653163372@itasuper.com.br' AND role = 'lojista_matriz'; -- dono da Rede Teste 1783653163372
-- Dono da Pizzaria Fake:
UPDATE public.profiles SET role = 'lojista', network_id = NULL, unit_store_id = NULL WHERE id = '5920d818-a383-4022-9b74-068f5f62288b' AND email = 'fake-matriz+1781103963@itasuper.com.br' AND role = 'lojista_matriz'; -- Pizzaria Fake Matriz
-- 2 gerentes sem loja (Pizzaria Fake):
UPDATE public.profiles SET role = 'lojista', network_id = NULL, unit_store_id = NULL WHERE id = '2ba4e885-aa2b-4bd1-89a3-1cf7816125e8' AND email = 'fake-unit-cabo-frio+1781103996@itasuper.com.br' AND role = 'lojista_unidade'; -- gerente fake de Cabo Frio
UPDATE public.profiles SET role = 'lojista', network_id = NULL, unit_store_id = NULL WHERE id = 'a0958028-e76b-4987-ac0b-9b4d19b25044' AND email = 'fake-unit-arraial-do-cabo+1781103996@itasuper.com.br' AND role = 'lojista_unidade'; -- gerente fake de Arraial do Cabo
-- (Os 7 outros donos de Rede Teste já estão com cargo 'cliente' e sem vínculo:
-- nada a fazer com eles. Os e-mails teste-matriz+… continuam existindo;
-- apagar as contas é uma limpeza futura opcional, fora desta Fase 0.)
-- §4.2 Apagar as 17 redes (16 'Rede Teste…' + Pizzaria Fake). Guardas por id E nome.
-- Nenhuma tem loja ligada (matriz_store_id nulo em todas) e nenhum outro
-- registro aponta para elas, exceto os perfis já tratados no §4.1.
DELETE FROM public.store_networks WHERE id = 'e6d3048c-e5b3-49d9-9cd6-2318f3bbbfb9' AND name = 'Rede Teste 1781088604093'; -- criada em 2026-06-10
DELETE FROM public.store_networks WHERE id = '34c08102-f5ce-475e-b6e5-4c9f57f50059' AND name = 'Rede Teste 1781088633217'; -- criada em 2026-06-10
DELETE FROM public.store_networks WHERE id = '58c33f18-9c39-43ce-9023-48b062067c04' AND name = 'Rede Teste 1781088656559'; -- criada em 2026-06-10
DELETE FROM public.store_networks WHERE id = '701ee31c-573e-44ed-a947-74d9da06618b' AND name = 'Rede Teste 1781311600499'; -- criada em 2026-06-13
DELETE FROM public.store_networks WHERE id = '7970937f-74c6-43e2-b54f-20558cdb6bea' AND name = 'Rede Teste 1781311668470'; -- criada em 2026-06-13
DELETE FROM public.store_networks WHERE id = 'bc99b5f7-b5eb-4b64-bc43-219b4fc3fbd6' AND name = 'Rede Teste 1781311698202'; -- criada em 2026-06-13
DELETE FROM public.store_networks WHERE id = '4c070c70-1334-4165-ac3b-ef7d04885ede' AND name = 'Rede Teste 1781311744297'; -- criada em 2026-06-13
DELETE FROM public.store_networks WHERE id = 'ad22f2a4-b924-4b2e-9d18-e446b4cb199c' AND name = 'Rede Teste 1781457087026'; -- criada em 2026-06-14
DELETE FROM public.store_networks WHERE id = '71e2b9b2-3b97-410f-b7cd-d630a93be456' AND name = 'Rede Teste 1782267210576'; -- criada em 2026-06-24
DELETE FROM public.store_networks WHERE id = 'dfc70fed-be51-45cd-9e1c-e1f0cb7007ca' AND name = 'Rede Teste 1782329722426'; -- criada em 2026-06-24
DELETE FROM public.store_networks WHERE id = '836e4b5f-1154-471c-a119-eb76700dfd9a' AND name = 'Rede Teste 1782682058126'; -- criada em 2026-06-28
DELETE FROM public.store_networks WHERE id = '054c8d61-7ebd-4fea-90d8-79011fffacb0' AND name = 'Rede Teste 1783190914871'; -- criada em 2026-07-04
DELETE FROM public.store_networks WHERE id = 'd04e1ff4-37ed-4754-8b9c-78f8943b42e4' AND name = 'Rede Teste 1783191024964'; -- criada em 2026-07-04
DELETE FROM public.store_networks WHERE id = '25192577-1a03-494d-b2ac-0e30848b4253' AND name = 'Rede Teste 1783652683029'; -- criada em 2026-07-10
DELETE FROM public.store_networks WHERE id = '89015ad9-4faa-42a0-8334-ef8f17e8dd0d' AND name = 'Rede Teste 1783652798457'; -- criada em 2026-07-10
DELETE FROM public.store_networks WHERE id = 'afdecb0e-e4d4-464b-a7eb-ff55a74a695d' AND name = 'Rede Teste 1783653163372'; -- criada em 2026-07-10
DELETE FROM public.store_networks WHERE id = 'e8d1bfe1-78ed-46c5-80a8-afd2c2da6824' AND name = 'Pizzaria Fake'; -- criada em 10/06/2026, 2 gerentes sem loja
-- (Rede Maristela 67162d56-c269-47b3-8659-0fc1938fa141: NÃO apagar — aguarda
-- decisão do Renner. Rede Graal: NÃO TOCAR — é a única rede real.)

-- §5 — OPCIONAL (BLOCO COMENTADO — só rodar com a palavra do Renner).
-- Loja Demonstração (8197bdd8-f041-410d-acc0-af9ecb448f55) = DEMO DO MC BATATA:
-- cardápio real deles, 13 produtos, 37 pedidos, plano fixed R$ 69,00/mês
-- venc. 15/11/2026. A loja NÃO é apagada e já está fora da vitrine
-- (is_visible = false). Para incluir a demo na limpeza, descomente as 2 linhas
-- abaixo. Sem ela, os planos de teste cancelados somam R$ 448,89 e o MRR final
-- fica R$ 546,70 em vez de R$ 477,70.
-- UPDATE public.store_plans SET is_active = false WHERE store_id = '8197bdd8-f041-410d-acc0-af9ecb448f55' AND is_active = true; -- Loja Demonstração (R$ 69,00)
-- UPDATE public.stores SET is_test = true WHERE id = '8197bdd8-f041-410d-acc0-af9ecb448f55' AND name = 'Loja Demonstração' AND is_test IS DISTINCT FROM true; -- Loja Demonstração

-- §6 — CONFERÊNCIA FINAL (só leitura; confira antes do COMMIT).
-- Esperado após a execução (sem o bloco opcional §5):
--   lojas totais 35 | na vitrine 11 | planos ativos 11, soma R$ 546,70
--   (com o §5: planos ativos 10, soma R$ 477,70) | redes 2 (Graal + Rede Maristela)
--   Duda lanches: 0 lojas | pedidos da Duda Teste: 0 | transações failed: 0
--   perfis lojista_matriz/lojista_unidade restantes: 2 (donos de Graal e Rede Maristela)
SELECT (SELECT count(*) FROM public.stores) AS lojas_totais,
       (SELECT count(*) FROM public.stores_public) AS lojas_na_vitrine,
       (SELECT count(*) FROM public.store_plans WHERE is_active = true) AS planos_ativos,
       (SELECT coalesce(sum(monthly_fee), 0) FROM public.store_plans WHERE is_active = true) AS mrr_total,
       (SELECT count(*) FROM public.store_networks) AS redes_totais,
       (SELECT count(*) FROM public.stores WHERE name ILIKE '%Duda%') AS lojas_duda,
       (SELECT count(*) FROM public.orders WHERE store_id = '71462610-0086-4619-a1fe-8788daf924a9') AS pedidos_duda_teste,
       (SELECT count(*) FROM public.financial_transactions WHERE store_id IN ('71462610-0086-4619-a1fe-8788daf924a9','74f95812-85af-4e71-96bd-6db7a5dd5f12')) AS transacoes_duda,
       (SELECT count(*) FROM public.profiles WHERE role IN ('lojista_matriz','lojista_unidade')) AS perfis_matriz_unidade_restantes;

-- Se tudo conferir: COMMIT; se qualquer número divergir: ROLLBACK.
COMMIT;
