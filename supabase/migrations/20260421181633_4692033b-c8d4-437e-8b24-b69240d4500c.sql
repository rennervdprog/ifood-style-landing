ALTER TABLE public.addon_groups
ADD COLUMN IF NOT EXISTS price_replaces_base boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.addon_groups.price_replaces_base IS 'When true, the selected addon price REPLACES the product base price instead of being added to it. Useful for size variations (e.g. 200ml, 300ml).';