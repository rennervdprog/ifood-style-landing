
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS reading_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS meta_keywords TEXT[],
  ADD COLUMN IF NOT EXISTS og_image TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts(category) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON public.blog_posts(featured, published_at DESC) WHERE published = true;

CREATE TABLE IF NOT EXISTS public.blog_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#0ea5e9',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blog_categories TO anon, authenticated;
GRANT ALL ON public.blog_categories TO service_role;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read categories" ON public.blog_categories;
CREATE POLICY "Public can read categories" ON public.blog_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage categories" ON public.blog_categories;
CREATE POLICY "Admins manage categories" ON public.blog_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.blog_post_views (
  id BIGSERIAL PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT
);

GRANT SELECT, INSERT ON public.blog_post_views TO anon, authenticated;
GRANT USAGE ON SEQUENCE public.blog_post_views_id_seq TO anon, authenticated;
GRANT ALL ON public.blog_post_views TO service_role;
ALTER TABLE public.blog_post_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can register view" ON public.blog_post_views;
CREATE POLICY "Anyone can register view" ON public.blog_post_views FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read views" ON public.blog_post_views;
CREATE POLICY "Admins read views" ON public.blog_post_views FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_blog_post_views_post_date ON public.blog_post_views(post_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS public.blog_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','spam')),
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.blog_comments TO anon, authenticated;
GRANT ALL ON public.blog_comments TO service_role;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads approved comments" ON public.blog_comments;
CREATE POLICY "Anyone reads approved comments" ON public.blog_comments FOR SELECT USING (status = 'approved');

DROP POLICY IF EXISTS "Admins read all comments" ON public.blog_comments;
CREATE POLICY "Admins read all comments" ON public.blog_comments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone submits comment" ON public.blog_comments;
CREATE POLICY "Anyone submits comment" ON public.blog_comments FOR INSERT WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "Admins moderate comments" ON public.blog_comments;
CREATE POLICY "Admins moderate comments" ON public.blog_comments FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete comments" ON public.blog_comments;
CREATE POLICY "Admins delete comments" ON public.blog_comments FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_blog_comments_post_status ON public.blog_comments(post_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  confirmed_at TIMESTAMPTZ,
  confirmation_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  unsubscribe_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  unsubscribed_at TIMESTAMPTZ,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone subscribes" ON public.newsletter_subscribers;
CREATE POLICY "Anyone subscribes" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins read subscribers" ON public.newsletter_subscribers FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins manage subscribers" ON public.newsletter_subscribers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.blog_increment_view(_slug TEXT, _ip_hash TEXT DEFAULT NULL, _user_agent TEXT DEFAULT NULL, _referrer TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _post_id UUID;
BEGIN
  SELECT id INTO _post_id FROM public.blog_posts WHERE slug = _slug AND published = true LIMIT 1;
  IF _post_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.blog_post_views (post_id, ip_hash, user_agent, referrer)
    VALUES (_post_id, _ip_hash, _user_agent, _referrer);
  UPDATE public.blog_posts SET view_count = view_count + 1 WHERE id = _post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.blog_increment_view(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

INSERT INTO public.blog_categories (slug, name, description, color, sort_order) VALUES
  ('gestao', 'Gestão', 'Dicas para administrar seu delivery', '#0ea5e9', 1),
  ('marketing', 'Marketing', 'Atraia e fidelize seus clientes', '#f97316', 2),
  ('operacao', 'Operação', 'Cozinha, PDV e entregas', '#10b981', 3),
  ('cases', 'Cases', 'Histórias de lojistas de sucesso', '#a855f7', 4),
  ('novidades', 'Novidades', 'Atualizações da plataforma ItaSuper', '#ef4444', 5)
ON CONFLICT (slug) DO NOTHING;
