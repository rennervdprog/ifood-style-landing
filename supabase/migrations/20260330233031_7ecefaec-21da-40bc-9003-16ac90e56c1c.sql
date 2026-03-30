
-- Add force_closed to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS force_closed BOOLEAN NOT NULL DEFAULT false;

-- Opening hours table
CREATE TABLE public.opening_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '22:00',
  is_closed_all_day BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (store_id, day_of_week)
);

ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;

-- Anyone can read opening hours (needed to show open/closed status)
CREATE POLICY "Anyone can read opening hours"
  ON public.opening_hours FOR SELECT TO public USING (true);

-- Store owners can manage their own hours
CREATE POLICY "Store owners can insert own hours"
  ON public.opening_hours FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners can update own hours"
  ON public.opening_hours FOR UPDATE TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners can delete own hours"
  ON public.opening_hours FOR DELETE TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));
