## Profissionalização do Blog ItaSuper

Hoje o blog tem 2 arquivos (`BlogIndex.tsx` 319 linhas, `BlogPost.tsx` 422 linhas) consumindo `blog_posts` do Supabase, sem editor admin, sem SEO estruturado, sem categorias navegáveis, sem comentários, sem newsletter e sem analytics. O objetivo é transformá-lo em uma **fonte de autoridade do nicho (delivery, PDV, restaurante)** que traga lojistas organicamente.

---

### Fase 1 — Fundação SEO (alta prioridade)

Sem isso o blog não cresce no Google.

- **Sitemap dinâmico** `/sitemap.xml` via Edge Function listando todos os posts publicados
- **RSS feed** `/blog/rss.xml` (gera autoridade + indexação rápida)
- **JSON-LD `Article`** em cada post (autor, data, imagem, organização)
- **Breadcrumbs JSON-LD** (Home > Blog > Categoria > Post)
- **Open Graph + Twitter Cards** dinâmicos por post
- **Canonical URL** correto (resolve duplicação)
- **robots.txt** liberando `/blog/*` e apontando para o sitemap
- **Imagens em WebP** com `width`/`height` definidos (Core Web Vitals)

### Fase 2 — Editor Profissional para Lojista/Admin

Hoje só dá pra criar post direto no banco — barreira enorme.

- Página `/admin/blog` com lista, busca, filtros (rascunho/publicado/agendado)
- Editor rich text (TipTap) com: cabeçalhos, listas, imagens, links, código, citações, embeds (YouTube/Instagram)
- **Upload de imagens** para Supabase Storage (bucket `blog-media`) com compressão automática (WebP, máx 1200px)
- **Capa do post** com crop 16:9
- Campos: título, slug auto-gerado, excerpt, categoria, tags, autor, tempo de leitura (auto), data de publicação (agendamento)
- **Preview** antes de publicar
- **Auto-save** a cada 10s
- Validação de slug único (igual fizemos pra lojas)

### Fase 3 — Navegação e Descoberta

Transformar de "lista de posts" em "biblioteca navegável".

- **Categorias** com páginas próprias `/blog/categoria/:slug` (Gestão, Marketing, Operação, Cases, Novidades)
- **Tags** clicáveis com `/blog/tag/:slug`
- **Posts relacionados** no final (mesmo categoria, ordenado por data)
- **"Mais lidos da semana"** (precisa de contador de views)
- **Newsletter inline** ("receba o melhor do blog")
- **Paginação** real (não scroll infinito) — melhor pra SEO
- **Busca melhorada** com Fuse.js já presente, mas indexando tags+categoria

### Fase 4 — Engajamento e Conversão

O blog precisa **gerar cadastros de lojista**.

- **CTA inteligente** no meio e fim do post: "Crie sua loja grátis" → `/cadastro-lojista`
- **Banner de plano** contextual (post sobre PDV → mostra plano Autonomia)
- **Tempo de leitura** real (já existe campo, validar)
- **Barra de progresso** de leitura no topo
- **Compartilhamento social** (WhatsApp, X, LinkedIn, copiar link)
- **Newsletter** com double opt-in (tabela `newsletter_subscribers`, Edge Function envio via Resend)
- **Comentários** opcionais via Disqus ou tabela própria moderada

### Fase 5 — Performance e Imagens

- **Lazy-load** de imagens abaixo da dobra (`loading="lazy"`)
- **LCP preload** da capa do post
- **Code split**: editor TipTap só carrega em `/admin/blog`
- **Cache Edge** nas listagens (`Cache-Control: s-maxage=300`)
- **Skeleton loaders** em vez de spinners
- Migrar imagens existentes para WebP no Storage

### Fase 6 — Analytics e Autoridade

- Tabela `blog_post_views` com IP hash + user_agent (LGPD-safe)
- Dashboard admin: top posts, tempo médio, taxa de conversão para cadastro
- **UTM tracking** nos CTAs (saber qual post converte mais lojista)
- **Schema `Organization`** + `Person` (autor) — autoridade Google
- **Backlinks internos** automáticos (link de "PDV" sempre aponta para post âncora)
- Submeter sitemap ao Google Search Console + Bing Webmaster

---

### Estratégia de execução

"Trocar o pneu com o carro andando" — `BlogIndex.tsx` e `BlogPost.tsx` continuam funcionando enquanto refatoramos.

**Ordem sugerida:** Fase 1 (SEO, ganho imediato sem mexer em UI) → Fase 2 (editor, destrava produção de conteúdo) → Fase 3 → resto conforme demanda.

### Detalhes técnicos

- Banco: adicionar colunas `view_count`, `meta_description`, `meta_keywords`, `scheduled_at`, `author_id` (FK profiles), `updated_at` em `blog_posts`
- Nova tabela: `blog_categories` (slug, nome, descrição, cor)
- Nova tabela: `newsletter_subscribers` (email, confirmed_at, unsubscribe_token)
- Nova tabela: `blog_post_views` (post_id, viewed_at, ip_hash)
- Bucket Storage: `blog-media` (público, 5MB max, WebP/JPG/PNG)
- Edge Functions: `sitemap-blog`, `rss-blog`, `newsletter-subscribe`, `newsletter-confirm`
- Lib nova: `src/lib/blogSchema.ts` (geradores JSON-LD)
- RLS: leitura pública para `published=true`; escrita só super_admin

---

### Perguntas

1. **Quem vai escrever?** Só você (super admin) ou lojistas também publicam?
2. **Newsletter:** usar Resend (já no projeto?) ou Mailchimp/Brevo?
3. **Comentários:** ativar agora ou deixar pra depois?
4. **Por onde começar:** Fase 1 (SEO) ou Fase 2 (editor) primeiro?
