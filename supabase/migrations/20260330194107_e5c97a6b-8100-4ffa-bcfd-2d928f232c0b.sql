
-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('pendente', 'preparando', 'saiu_entrega', 'finalizado');

-- Create orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_id uuid REFERENCES public.stores(id) NOT NULL,
  status order_status NOT NULL DEFAULT 'pendente',
  subtotal numeric NOT NULL,
  delivery_fee numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL,
  payment_method text NOT NULL,
  neighborhood text NOT NULL,
  address_details text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Orders: clients can insert their own orders
CREATE POLICY "Clients can insert own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Orders: clients can read their own orders
CREATE POLICY "Clients can read own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- Order items: clients can insert items for their own orders
CREATE POLICY "Clients can insert own order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.client_id = auth.uid()
    )
  );

-- Order items: clients can read items from their own orders
CREATE POLICY "Clients can read own order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.client_id = auth.uid()
    )
  );

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
