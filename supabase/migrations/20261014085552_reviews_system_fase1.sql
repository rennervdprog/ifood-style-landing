-- Sistema de Avaliação — Fase 1: banco de dados
-- Pesquisa: research_notes/sistema-avaliacao-delivery-20261014-0540
-- Padrão iFood: 1 avaliação por pedido, janela de 7 dias, loja × entrega separados,
-- comentário obrigatório em notas 1–3, pública × privada, resposta do lojista (SLA 5 dias).
--
-- Tabelas: reviews, review_tags, review_responses, review_revisions,
--           store_rating_aggregates, review_moderation_events
-- + delivered_at em orders (a tabela não tinha updated_at/delivered_at)
-- + trigger que recalcula os agregados da loja a cada avaliação

-- 1. delivered_at em orders (necessário p/ janela de 7 dias da avaliação)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_order_delivered_at()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'entregue' AND OLD.status IS DISTINCT FROM 'entregue' THEN
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_delivered_at ON public.orders;
CREATE TRIGGER trg_orders_set_delivered_at
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_delivered_at();

-- Backfill: pedidos já entregues ganham delivered_at = created_at (melhor aproximação disponível)
UPDATE public.orders SET delivered_at = created_at
WHERE status = 'entregue' AND delivered_at IS NULL;

-- 2. Tabela principal de avaliações
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('store', 'courier')),
  target_id uuid NOT NULL, -- store_id ou courier/driver user id
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  -- Para entregador o app apresenta thumbs: 1–2 = 👎, 4–5 = 👍 (3 = neutro, raro)
  comment text CHECK (comment IS NULL OR char_length(comment) <= 2000),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected', 'rejected_fraud', 'hidden')),
  rejection_reason text,
  source text NOT NULL DEFAULT 'post_delivery'
    CHECK (source IN ('post_delivery', 'reopen', 'push', 'order_history')),
  is_verified_order boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 1 avaliação por pedido/alvo (anti-fraude estrutural, padrão DoorDash)
  UNIQUE (order_id, author_id, target_type),
  -- Comentário obrigatório (mín. 12 caracteres) em notas 1–3 (padrão iFood)
  CONSTRAINT reviews_comment_required_low_rating
    CHECK (rating > 3 OR (comment IS NOT NULL AND char_length(comment) >= 12))
);

CREATE INDEX IF NOT EXISTS idx_reviews_store ON public.reviews(target_id)
  WHERE target_type = 'store' AND status = 'approved' AND visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_reviews_order ON public.reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_author ON public.reviews(author_id);

-- 3. Tags/critérios da avaliação (ex.: 'tasty', 'late_delivery')
CREATE TABLE IF NOT EXISTS public.review_tags (
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  tag text NOT NULL,
  sentiment text NOT NULL CHECK (sentiment IN ('positive', 'negative')),
  PRIMARY KEY (review_id, tag)
);

-- 4. Resposta do lojista (1 por review; SLA 5 dias, padrão iFood)
CREATE TABLE IF NOT EXISTS public.review_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES public.reviews(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES auth.users(id),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  coupon_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz, -- permitido até +10 min (padrão iFood)
  responded_within_sla boolean -- <= 5 dias após a avaliação
);

-- 5. Revisão da nota pelo cliente após resposta da loja (padrão iFood, 1x)
CREATE TABLE IF NOT EXISTS public.review_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  old_rating smallint NOT NULL CHECK (old_rating BETWEEN 1 AND 5),
  new_rating smallint NOT NULL CHECK (new_rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Agregados por loja (pré-computados por trigger; nunca on-the-fly)
CREATE TABLE IF NOT EXISTS public.store_rating_aggregates (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  period text NOT NULL DEFAULT '90d' CHECK (period IN ('90d', 'lifetime')),
  avg_rating numeric(3,2) NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0, -- só públicas aprovadas
  dist_1 integer NOT NULL DEFAULT 0,
  dist_2 integer NOT NULL DEFAULT 0,
  dist_3 integer NOT NULL DEFAULT 0,
  dist_4 integer NOT NULL DEFAULT 0,
  dist_5 integer NOT NULL DEFAULT 0,
  novelty_until date, -- selo "Novidade" enquanto < 10 avaliações (padrão iFood)
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, period)
);

-- 7. Trilha de moderação/auditoria
CREATE TABLE IF NOT EXISTS public.review_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  actor text NOT NULL, -- 'system' ou moderator user id
  action text NOT NULL, -- auto_approved|auto_rejected|manual_hide|merchant_reported|merchant_contested
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moderation_review ON public.review_moderation_events(review_id);

-- 8. Função que recalcula os agregados de uma loja
CREATE OR REPLACE FUNCTION public.refresh_store_rating_aggregates(_store_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _cutoff timestamptz := now() - interval '90 days';
  _r record;
BEGIN
  FOR _r IN SELECT '90d' AS w, _cutoff AS c UNION ALL SELECT 'lifetime', NULL LOOP
    INSERT INTO public.store_rating_aggregates
      (store_id, period, avg_rating, review_count,
       dist_1, dist_2, dist_3, dist_4, dist_5, novelty_until, updated_at)
    SELECT
      _store_id,
      _r.w,
      COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0),
      COUNT(*),
      COUNT(*) FILTER (WHERE r.rating = 1),
      COUNT(*) FILTER (WHERE r.rating = 2),
      COUNT(*) FILTER (WHERE r.rating = 3),
      COUNT(*) FILTER (WHERE r.rating = 4),
      COUNT(*) FILTER (WHERE r.rating = 5),
      CASE WHEN COUNT(*) < 10 THEN CURRENT_DATE + 21 ELSE NULL END,
      now()
    FROM public.reviews r
    WHERE r.target_type = 'store'
      AND r.target_id = _store_id
      AND r.status = 'approved'
      AND r.visibility = 'public'
      AND (_r.c IS NULL OR r.created_at >= _r.c)
    ON CONFLICT (store_id, period) DO UPDATE SET
      avg_rating = EXCLUDED.avg_rating,
      review_count = EXCLUDED.review_count,
      dist_1 = EXCLUDED.dist_1,
      dist_2 = EXCLUDED.dist_2,
      dist_3 = EXCLUDED.dist_3,
      dist_4 = EXCLUDED.dist_4,
      dist_5 = EXCLUDED.dist_5,
      novelty_until = EXCLUDED.novelty_until,
      updated_at = now();
  END LOOP;
END;
$$;

-- 9. Trigger: recalcula agregados a cada avaliação inserida/alterada/removida
CREATE OR REPLACE FUNCTION public.trg_refresh_store_aggregates()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _store_id uuid;
BEGIN
  _store_id := COALESCE(
    (CASE WHEN NEW IS NOT NULL AND NEW.target_type = 'store' THEN NEW.target_id END),
    (CASE WHEN OLD IS NOT NULL AND OLD.target_type = 'store' THEN OLD.target_id END)
  );
  IF _store_id IS NOT NULL THEN
    PERFORM public.refresh_store_rating_aggregates(_store_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_refresh_aggregates ON public.reviews;
CREATE TRIGGER trg_reviews_refresh_aggregates
  AFTER INSERT OR UPDATE OF rating, status, visibility OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_store_aggregates();

-- Backfill: cria linhas de agregados zeradas para lojas existentes
-- (o trigger popula a partir da primeira avaliação)
INSERT INTO public.store_rating_aggregates (store_id, period)
SELECT s.id, p.period
FROM public.stores s
CROSS JOIN (VALUES ('90d'), ('lifetime')) AS p(period)
ON CONFLICT (store_id, period) DO NOTHING;

-- 10. RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_rating_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_moderation_events ENABLE ROW LEVEL SECURITY;

-- reviews: cliente insere avaliação do próprio pedido ENTREGUE dentro de 7 dias
CREATE POLICY "Clients can review own delivered orders"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = reviews.order_id
        AND o.client_id = auth.uid()
        AND o.status = 'entregue'
        AND o.delivered_at IS NOT NULL
        AND o.delivered_at >= now() - interval '7 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.reviews r2
      WHERE r2.order_id = reviews.order_id
        AND r2.author_id = auth.uid()
        AND r2.target_type = reviews.target_type
    )
  );

-- reviews: leitura pública das aprovadas/públicas (página da loja)
CREATE POLICY "Public can read approved public reviews"
  ON public.reviews FOR SELECT
  USING (status = 'approved' AND visibility = 'public');

-- reviews: autor lê as próprias; lojista lê as da própria loja (inclui privadas)
CREATE POLICY "Authors and store owners can read reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.stores s ON s.id = o.store_id
      WHERE o.id = reviews.order_id AND s.owner_id = auth.uid()
    )
  );

-- reviews: autor pode editar dentro da janela de 7 dias (revisão de nota)
CREATE POLICY "Authors can update own reviews within 7 days"
  ON public.reviews FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = reviews.order_id
        AND o.delivered_at >= now() - interval '7 days'
    )
  )
  WITH CHECK (author_id = auth.uid());

-- review_tags: acompanha a visibilidade do review pai
CREATE POLICY "Tags follow parent review visibility"
  ON public.review_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_tags.review_id
        AND (r.status = 'approved' AND r.visibility = 'public'
             OR r.author_id = auth.uid())
    )
  );

CREATE POLICY "Authors can tag own reviews"
  ON public.review_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_tags.review_id AND r.author_id = auth.uid()
    )
  );

-- review_responses: lojista responde avaliações da própria loja
CREATE POLICY "Store owners can respond to own store reviews"
  ON public.review_responses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = review_responses.store_id AND s.owner_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.reviews r
      JOIN public.orders o ON o.id = r.order_id
      WHERE r.id = review_responses.review_id AND o.store_id = review_responses.store_id
    )
  );

CREATE POLICY "Anyone can read responses of public reviews"
  ON public.review_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_responses.review_id
        AND r.status = 'approved' AND r.visibility = 'public'
    )
  );

CREATE POLICY "Store owners can read own responses"
  ON public.review_responses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = review_responses.store_id AND s.owner_id = auth.uid()
    )
  );

-- review_revisions: autor registra a revisão (1x, validado na aplicação)
CREATE POLICY "Authors can record own revisions"
  ON public.review_revisions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_revisions.review_id AND r.author_id = auth.uid()
    )
  );

CREATE POLICY "Revisions readable with review"
  ON public.review_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_revisions.review_id
        AND (r.status = 'approved' AND r.visibility = 'public'
             OR r.author_id = auth.uid())
    )
  );

-- store_rating_aggregates: leitura pública (página da loja)
CREATE POLICY "Public can read store aggregates"
  ON public.store_rating_aggregates FOR SELECT USING (true);

-- review_moderation_events: só o próprio autor e o lojista da loja
CREATE POLICY "Moderation events visible to parties"
  ON public.review_moderation_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      LEFT JOIN public.orders o ON o.id = r.order_id
      LEFT JOIN public.stores s ON s.id = o.store_id
      WHERE r.id = review_moderation_events.review_id
        AND (r.author_id = auth.uid() OR s.owner_id = auth.uid())
    )
  );
