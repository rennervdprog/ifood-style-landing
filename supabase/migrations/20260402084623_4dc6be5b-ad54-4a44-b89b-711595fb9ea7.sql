
-- 1. SECURITY: Create a view for drivers with limited profile data
CREATE OR REPLACE VIEW public.delivery_contacts AS
SELECT 
  user_id,
  full_name,
  phone,
  whatsapp_number,
  neighborhood
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.delivery_contacts TO authenticated;

-- 2. RATINGS TABLE
CREATE TABLE public.order_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  user_id UUID NOT NULL,
  store_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own ratings" ON public.order_ratings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own ratings" ON public.order_ratings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Store owners can read store ratings" ON public.order_ratings
  FOR SELECT TO authenticated USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

CREATE POLICY "Admin can read all ratings" ON public.order_ratings
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can read ratings" ON public.order_ratings
  FOR SELECT TO public USING (true);

-- 3. SAVED ADDRESSES TABLE
CREATE TABLE public.saved_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT 'Casa',
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  reference_point TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own addresses" ON public.saved_addresses
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Function to update store average rating
CREATE OR REPLACE FUNCTION public.update_store_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE stores
  SET rating = (
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM order_ratings
    WHERE store_id = NEW.store_id
  )
  WHERE id = NEW.store_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_rating_insert
  AFTER INSERT ON public.order_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_store_rating();

-- 5. SECURITY: Update store-assets storage policy to require store ownership
-- (Storage policies are managed separately, adding a note here)
