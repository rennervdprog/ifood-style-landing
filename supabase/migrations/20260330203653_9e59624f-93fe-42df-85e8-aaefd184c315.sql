
-- Add new categories to store_category enum
ALTER TYPE public.store_category ADD VALUE IF NOT EXISTS 'farmacias';
ALTER TYPE public.store_category ADD VALUE IF NOT EXISTS 'docerias';
