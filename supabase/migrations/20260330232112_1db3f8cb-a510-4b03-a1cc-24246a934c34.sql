
-- Menu sections (categories within a store's menu)
CREATE TABLE public.menu_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read menu sections"
  ON public.menu_sections FOR SELECT TO public USING (true);

CREATE POLICY "Store owners can manage own menu sections"
  ON public.menu_sections FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners can update own menu sections"
  ON public.menu_sections FOR UPDATE TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners can delete own menu sections"
  ON public.menu_sections FOR DELETE TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- Add section_id to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.menu_sections(id) ON DELETE SET NULL;

-- Product addon groups (e.g. "Escolha seu Molho", "Adicionais")
CREATE TABLE public.addon_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_select INTEGER NOT NULL DEFAULT 0,
  max_select INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.addon_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read addon groups"
  ON public.addon_groups FOR SELECT TO public USING (true);

CREATE POLICY "Store owners can manage addon groups"
  ON public.addon_groups FOR INSERT TO authenticated
  WITH CHECK (product_id IN (
    SELECT p.id FROM public.products p
    JOIN public.stores s ON p.store_id = s.id
    WHERE s.owner_id = auth.uid()
  ));

CREATE POLICY "Store owners can update addon groups"
  ON public.addon_groups FOR UPDATE TO authenticated
  USING (product_id IN (
    SELECT p.id FROM public.products p
    JOIN public.stores s ON p.store_id = s.id
    WHERE s.owner_id = auth.uid()
  ))
  WITH CHECK (product_id IN (
    SELECT p.id FROM public.products p
    JOIN public.stores s ON p.store_id = s.id
    WHERE s.owner_id = auth.uid()
  ));

CREATE POLICY "Store owners can delete addon groups"
  ON public.addon_groups FOR DELETE TO authenticated
  USING (product_id IN (
    SELECT p.id FROM public.products p
    JOIN public.stores s ON p.store_id = s.id
    WHERE s.owner_id = auth.uid()
  ));

-- Addon items (individual options within a group)
CREATE TABLE public.addon_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.addon_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.addon_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read addon items"
  ON public.addon_items FOR SELECT TO public USING (true);

CREATE POLICY "Store owners can manage addon items"
  ON public.addon_items FOR INSERT TO authenticated
  WITH CHECK (group_id IN (
    SELECT ag.id FROM public.addon_groups ag
    JOIN public.products p ON ag.product_id = p.id
    JOIN public.stores s ON p.store_id = s.id
    WHERE s.owner_id = auth.uid()
  ));

CREATE POLICY "Store owners can update addon items"
  ON public.addon_items FOR UPDATE TO authenticated
  USING (group_id IN (
    SELECT ag.id FROM public.addon_groups ag
    JOIN public.products p ON ag.product_id = p.id
    JOIN public.stores s ON p.store_id = s.id
    WHERE s.owner_id = auth.uid()
  ))
  WITH CHECK (group_id IN (
    SELECT ag.id FROM public.addon_groups ag
    JOIN public.products p ON ag.product_id = p.id
    JOIN public.stores s ON p.store_id = s.id
    WHERE s.owner_id = auth.uid()
  ));

CREATE POLICY "Store owners can delete addon items"
  ON public.addon_items FOR DELETE TO authenticated
  USING (group_id IN (
    SELECT ag.id FROM public.addon_groups ag
    JOIN public.products p ON ag.product_id = p.id
    JOIN public.stores s ON p.store_id = s.id
    WHERE s.owner_id = auth.uid()
  ));

-- Add observations field to order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS observations TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS addons JSONB DEFAULT '[]'::jsonb;
