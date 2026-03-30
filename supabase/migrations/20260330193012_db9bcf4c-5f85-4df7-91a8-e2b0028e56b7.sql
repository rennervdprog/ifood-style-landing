-- Create store category enum
CREATE TYPE public.store_category AS ENUM ('lanches', 'pizzas', 'adegas', 'japonesa', 'saudavel', 'sobremesas', 'cafeteria', 'churrasco');

-- Create stores table
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category store_category NOT NULL,
  image_url TEXT,
  is_open BOOLEAN NOT NULL DEFAULT true,
  rating DECIMAL(2,1) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  description TEXT,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create neighborhood_fees table
CREATE TABLE public.neighborhood_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  fee NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhood_fees ENABLE ROW LEVEL SECURITY;

-- Public read access for all three tables
CREATE POLICY "Anyone can read stores" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Anyone can read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Anyone can read neighborhood_fees" ON public.neighborhood_fees FOR SELECT USING (true);

-- Create indexes
CREATE INDEX idx_products_store_id ON public.products(store_id);
CREATE INDEX idx_stores_category ON public.stores(category);
CREATE INDEX idx_stores_is_open ON public.stores(is_open);