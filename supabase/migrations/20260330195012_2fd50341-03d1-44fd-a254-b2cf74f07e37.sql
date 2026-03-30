
-- Add owner_id to stores
ALTER TABLE public.stores ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Allow store owners to UPDATE their own store (for pause functionality)
CREATE POLICY "Store owners can update own store"
ON public.stores
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Allow store owners to SELECT orders for their stores
CREATE POLICY "Store owners can read store orders"
ON public.orders
FOR SELECT
TO authenticated
USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- Allow store owners to UPDATE orders for their stores
CREATE POLICY "Store owners can update store orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- Allow store owners to read order items for their stores
CREATE POLICY "Store owners can read store order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  JOIN public.stores s ON o.store_id = s.id
  WHERE o.id = order_items.order_id AND s.owner_id = auth.uid()
));

-- Allow store owners to manage their products
CREATE POLICY "Store owners can update own products"
ON public.products
FOR UPDATE
TO authenticated
USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners can insert own products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners can delete own products"
ON public.products
FOR DELETE
TO authenticated
USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));
