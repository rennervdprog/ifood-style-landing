
-- Add slug column to stores
ALTER TABLE public.stores ADD COLUMN slug text UNIQUE;

-- Generate initial slugs from store names
UPDATE public.stores 
SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Create index for slug lookups
CREATE INDEX idx_stores_slug ON public.stores (slug);
