# Caçador de Leads ItaSuper

Nova ferramenta interna no Super Admin que encontra **pizzarias, restaurantes e marmitarias** em cidades grandes que **ainda não usam app de delivery** — leads quentes prontos pra abordagem comercial.

## Como funciona (visão do usuário)

Tela em `/super-admin` → nova aba **"Caçador de Leads"**:

1. Escolhe **cidade** (ex: Sorocaba, Campinas, Bauru, Londrina)
2. Escolhe **categoria** (Pizzaria / Restaurante / Marmitaria / Lanche)
3. Clica **Buscar Leads**
4. Vê uma lista com: nome, endereço, telefone, nota Google, nº de avaliações, Instagram (se houver), WhatsApp click-to-chat
5. Cada card tem botões: **📋 Copiar contato**, **💬 Abrir WhatsApp** com mensagem pronta, **✅ Marcar como abordado**

A lista já vem **filtrada**: só aparecem estabelecimentos que **NÃO têm pedido online** detectado (sem link de iFood/Rappi/site próprio de pedido) — ou seja, alta probabilidade de anotarem pedidos no papel.

## Filtros de qualidade (lead bom)

- Nota Google ≥ 4.0
- Mínimo 20 avaliações (descarta lojas fantasma)
- Tem telefone público
- **Sem** campo "reservations/online ordering" no Google Places
- Categoria correta (pizzaria, restaurante, marmitaria)

## Mensagem WhatsApp pronta (editável)

```
Oi {nome}! Vi vocês no Google com {rating}★ — parabéns!
Sou do ItaSuper, plataforma de delivery sem comissão (só R$1 por venda).
Posso te mandar um vídeo de 1min de como funciona?
```

## Detalhes técnicos

**Backend** — nova edge function `lead-hunter`:
- Usa o conector **Google Maps Platform** (já disponível) via gateway
- Endpoint: Places API (New) `places:searchText` com `textQuery: "pizzaria em Sorocaba"`
- FieldMask retorna: `displayName, formattedAddress, internationalPhoneNumber, rating, userRatingCount, websiteUri, googleMapsUri, primaryType`
- Filtra resultados sem `websiteUri` apontando pra iFood/Rappi/site de pedido
- Cacheia resultados por 24h por (cidade+categoria) numa tabela `lead_searches`

**Tabela nova** `prospect_leads` (Supabase externo):
- `id, place_id (unique), name, phone, address, city, category, rating, reviews_count, website, status ('novo'|'abordado'|'convertido'|'descartado'), notes, last_contact_at, created_at`
- RLS: só super_admin lê/escreve
- GRANT pra `authenticated` + `service_role`

**Frontend** — `src/pages/super-admin/tabs/LeadsHunterTab.tsx`:
- Combobox de cidade (lista pré-definida + livre)
- Select de categoria
- Lista virtualizada de cards
- Estado de cada lead persistido (não some quando você marca como abordado)
- Exportar CSV pra usar no celular

**Cidades grandes pré-cadastradas**:
São Paulo, Campinas, Sorocaba, Bauru, Ribeirão Preto, São José do Rio Preto, Piracicaba, Jundiaí, Santos, São José dos Campos, Londrina, Maringá, Curitiba, BH, Uberlândia, Goiânia, Brasília.

## Custo

Google Places (New) Text Search: **US$ 32 por 1000 buscas** — uma busca retorna até 20 leads. O cache de 24h evita refazer a mesma busca. Custo estimado: < R$ 5 pra varrer 10 cidades.

## O que NÃO vou fazer agora

- Não vou raspar Instagram (TOS do Meta) — deixo o campo manual
- Não vou disparar WhatsApp em massa (risco de banimento) — abertura é 1-a-1 via click-to-chat
- Não vou integrar CRM externo — fica tudo dentro do ItaSuper

Posso começar?
