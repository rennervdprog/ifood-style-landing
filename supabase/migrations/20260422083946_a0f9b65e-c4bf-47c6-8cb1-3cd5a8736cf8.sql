-- 1) Add categories array column to stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS categories store_category[] NOT NULL DEFAULT '{}'::store_category[];

-- 2) Backfill: populate categories with the existing primary category
UPDATE public.stores
SET categories = ARRAY[category]::store_category[]
WHERE (categories IS NULL OR array_length(categories, 1) IS NULL)
  AND category IS NOT NULL;

-- 3) Trigger: keep `category` (primary) inside `categories` automatically
CREATE OR REPLACE FUNCTION public.sync_store_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Ensure categories is never null
  IF NEW.categories IS NULL THEN
    NEW.categories := '{}'::store_category[];
  END IF;

  -- Always include the primary category in the array
  IF NEW.category IS NOT NULL AND NOT (NEW.category = ANY (NEW.categories)) THEN
    NEW.categories := array_prepend(NEW.category, NEW.categories);
  END IF;

  -- If primary category is not set but array has values, set primary to first
  IF NEW.category IS NULL AND array_length(NEW.categories, 1) > 0 THEN
    NEW.category := NEW.categories[1];
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_store_categories_trg ON public.stores;
CREATE TRIGGER sync_store_categories_trg
BEFORE INSERT OR UPDATE OF category, categories ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.sync_store_categories();

-- 4) Recreate stores_public view to include categories
DROP VIEW IF EXISTS public.stores_public;

CREATE VIEW public.stores_public
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.name,
  s.slug,
  s.image_url,
  s.category,
  s.categories,
  s.rating,
  s.is_open,
  s.force_closed,
  s.status,
  s.delivery_mode,
  s.own_delivery_fee,
  s.created_at,
  s.owner_id,
  s.address_cep,
  s.address_city,
  s.address_complement,
  s.address_neighborhood,
  s.address_number,
  s.address_reference,
  s.address_state,
  s.address_street,
  s.settings
FROM public.stores s
WHERE s.is_test = false OR s.is_test IS NULL;

GRANT SELECT ON public.stores_public TO anon, authenticated;

-- 5) Helpful index for category array filtering
CREATE INDEX IF NOT EXISTS idx_stores_categories_gin
  ON public.stores USING GIN (categories);