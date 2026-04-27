---
name: external-database
description: Banco de dados principal (cérebro) do projeto — projeto Supabase externo, NÃO usar Lovable Cloud
type: constraint
---
O banco de dados PRINCIPAL deste projeto é o Supabase EXTERNO com ref: **qkjhguziuchqsbxzruea**

**Regras críticas:**
- Lovable Cloud foi DESCONTINUADO neste projeto — não usar para dados de negócio (cadastros, lojistas, pedidos, perfis, etc.)
- Todo dado real (usuários, lojistas, pedidos, PIX, etc.) vive no banco externo `qkjhguziuchqsbxzruea`
- As credenciais externas estão configuradas como secrets: `EXTERNAL_SUPABASE_URL` e `EXTERNAL_SUPABASE_SERVICE_KEY`
- Edge Functions como `sync-to-external`, `confirm-order-payment`, `asaas-webhook` devem operar contra o banco externo
- Ao debugar cadastros, lojistas, aprovações ou qualquer dado do app: consultar o banco EXTERNO, não o Lovable Cloud
- Não sugerir migrations no Lovable Cloud para features de negócio — usar o banco externo
