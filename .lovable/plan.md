# Plano: Bot responde no 1º contato + Slugs rotativos anti-spam

## Objetivo
1. Bot enviar saudação já na **primeira** mensagem do cliente (hoje só responde na 2ª).
2. Reduzir risco de WhatsApp marcar o link como spam usando **4 slugs diferentes** por loja (1 principal + 3 aliases curtos), sorteados a cada envio.

---

## Parte 1 — Remover filtro de "primeiro contato"

**Onde:** `supabase/functions/evolution-webhook/index.ts`

- Localizar o bloco que checa se é a 1ª mensagem em 10 min e ignora.
- Remover essa checagem **apenas para a saudação inicial** (mensagem com link da loja).
- Manter intactas as outras 5 camadas anti-ban:
  - dedupe de saudação por 24h (mesmo número não recebe 2x)
  - opt-out (`pare`, `sair`, `stop`)
  - limite diário progressivo por chip
  - delay aleatório 2–4s antes de enviar
  - rotação de 4 templates de texto + caracteres zero-width

Resultado: cliente manda "oi" → recebe saudação com link em segundos.

---

## Parte 2 — Slugs alias rotativos

### 2.1 Banco (migration)
- Adicionar coluna `slug_aliases text[] default '{}'` em `public.stores`.
- Backfill: para cada loja existente, gerar 3 aliases no formato `<prefixo>-<hash4>` (ex.: `past-a4f9`, `past-c9783`, `past-7b21`) a partir das 4 primeiras letras do slug principal + 4 chars aleatórios hex.
- Índice GIN em `slug_aliases` para lookup rápido.

### 2.2 Resolver de rota
- Ajustar a query que resolve `/:slug` para aceitar `slug = $1 OR $1 = ANY(slug_aliases)`.
- Todos os aliases apontam para a mesma loja — mesma página, mesmo cardápio.

### 2.3 Sorteio no envio da saudação
- Em `evolution-send-message` (ou onde monta a URL da saudação), montar array `[slug, ...slug_aliases]` e sortear 1 aleatório por envio.
- URL final: `https://itasuper.com.br/<sorteado>`.

### 2.4 Painel do lojista
- Card "Links anti-spam" mostrando os 4 slugs ativos.
- Botão **"Regenerar aliases"** (caso um link seja marcado como spam) → chama edge function que sobrescreve `slug_aliases` com 3 novos hashes.

---

## Detalhes técnicos
- Slugs alias são somente para **saudação inicial via WhatsApp**. Divulgação normal continua usando o slug principal (SEO).
- Aliases não indexáveis: adicionar `<meta name="robots" content="noindex">` quando a rota casar por alias (não pelo slug principal), para não fragmentar SEO.
- Uniqueness: alias precisa ser único no sistema — checar contra `slug` e `slug_aliases` de todas as lojas antes de inserir; se colidir, regenera.
- Segurança: função de regenerar aliases exige `auth.uid()` = dono da loja (RLS já cobre `stores`).

---

## Versão
Após aplicar: bump para **1.11.85** em `src/lib/appVersion.ts`, `android/app/build.gradle` (versionName + versionCode 839) e `src/pages/PerfilPage.tsx`.

## Confirmar antes de executar
Posso seguir com as 2 partes juntas?
