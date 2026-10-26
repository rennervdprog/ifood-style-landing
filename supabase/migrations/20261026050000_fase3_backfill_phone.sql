-- Fase 3 do plano guest/bot — unificar a busca por telefone (P0-3)
--
-- Causa raiz: o cadastro do site gravava o telefone so em
-- profiles.whatsapp_number e o bot procurava so em profiles.phone — o
-- mesmo telefone gerava dois user_ids (cadastro duplicado site x bot).
-- O AuthPage passa a gravar os DOIS campos no cadastro (esta fase); o bot
-- ja busca nos dois campos desde a Fase 1 (PR #372).
--
-- O que muda aqui (backfill, aditivo, so preenche o que falta): todo
-- perfil com whatsapp_number e sem phone passa a ter phone igual ao
-- whatsapp_number. Contagem verificada no banco em 2026-10-26, antes de
-- escrever: 25 perfis (92 clientes no total; 35 com phone, 38 com
-- whatsapp_number). Nada e apagado; nenhum user_id muda aqui — a
-- mesclagem dos duplicados e manual e separada desta migration.
--
-- NAO APLICAR sem a palavra do Renner: a migration vai no PR sem ser
-- aplicada (o deploy da Fase 3 a aplica na publicacao).

UPDATE profiles
SET phone = whatsapp_number
WHERE phone IS NULL
  AND whatsapp_number IS NOT NULL;
