# Project Memory

## Core
Cérebro = Supabase EXTERNO (qkjhguziuchqsbxzruea), NÃO Lovable Cloud (lktzrqjvqoojlrhqnxuz). Cliente em src/integrations/supabase/client.ts já aponta para o externo.
Auth do externo tem mailer_autoconfirm=true; trigger handle_new_user cria profile a partir de raw_user_meta_data. RPC register_as_lojista deve ser chamada DEPOIS do signin para auth.uid() funcionar.
Para alterar dados/funções do externo, use Management API com $EXTERNAL_SUPABASE_ACCESS_TOKEN; service key em $EXTERNAL_SUPABASE_SERVICE_KEY.
Migrações via supabase--migration aplicam no Lovable Cloud — para o externo é necessário aplicar SQL via Management API também.
