
-- Create pizza_borders table
CREATE TABLE public.pizza_borders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Borda Tradicional',
  price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pizza_borders ENABLE ROW LEVEL SECURITY;

-- Anyone can read borders (public menu)
CREATE POLICY "Anyone can read pizza borders"
  ON public.pizza_borders FOR SELECT
  USING (true);

-- Store owners can insert their own borders
CREATE POLICY "Store owners can insert own borders"
  ON public.pizza_borders FOR INSERT
  TO authenticated
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Store owners can update their own borders
CREATE POLICY "Store owners can update own borders"
  ON public.pizza_borders FOR UPDATE
  TO authenticated
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Store owners can delete their own borders
CREATE POLICY "Store owners can delete own borders"
  ON public.pizza_borders FOR DELETE
  TO authenticated
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Platform admin full access
CREATE POLICY "Platform admin can manage all borders"
  ON public.pizza_borders FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- Auto-create default border for existing pizza stores
INSERT INTO public.pizza_borders (store_id, name, price, sort_order)
SELECT id, 'Borda Tradicional', 0, 0
FROM public.stores
WHERE category = 'pizzas'
  AND NOT EXISTS (SELECT 1 FROM public.pizza_borders pb WHERE pb.store_id = stores.id);
