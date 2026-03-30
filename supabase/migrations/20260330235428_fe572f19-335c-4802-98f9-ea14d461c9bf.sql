
-- Add store_id to addon_groups for store-level groups
ALTER TABLE addon_groups ADD COLUMN store_id uuid;

-- Populate store_id from existing product links
UPDATE addon_groups SET store_id = (SELECT store_id FROM products WHERE products.id = addon_groups.product_id);

-- Make store_id NOT NULL after populating
ALTER TABLE addon_groups ALTER COLUMN store_id SET NOT NULL;

-- Make product_id nullable (store-level groups won't have a direct product)
ALTER TABLE addon_groups ALTER COLUMN product_id DROP NOT NULL;

-- Create junction table for linking store-level addon groups to products
CREATE TABLE product_addon_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  addon_group_id uuid NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, addon_group_id)
);

ALTER TABLE product_addon_groups ENABLE ROW LEVEL SECURITY;

-- RLS: anyone can read links
CREATE POLICY "Anyone can read product addon links" ON product_addon_groups FOR SELECT USING (true);

-- RLS: store owners can insert links
CREATE POLICY "Store owners can insert product addon links" ON product_addon_groups FOR INSERT TO authenticated
WITH CHECK (product_id IN (SELECT p.id FROM products p JOIN stores s ON p.store_id = s.id WHERE s.owner_id = auth.uid()));

-- RLS: store owners can delete links
CREATE POLICY "Store owners can delete product addon links" ON product_addon_groups FOR DELETE TO authenticated
USING (product_id IN (SELECT p.id FROM products p JOIN stores s ON p.store_id = s.id WHERE s.owner_id = auth.uid()));

-- Add RLS policies for store-level addon groups (product_id IS NULL)
CREATE POLICY "Store owners can insert store addon groups" ON addon_groups FOR INSERT TO authenticated
WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners can update store addon groups" ON addon_groups FOR UPDATE TO authenticated
USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners can delete store addon groups" ON addon_groups FOR DELETE TO authenticated
USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Update addon_items RLS to also work via store_id path
CREATE POLICY "Store owners can manage addon items via store" ON addon_items FOR INSERT TO authenticated
WITH CHECK (group_id IN (SELECT id FROM addon_groups WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())));

CREATE POLICY "Store owners can update addon items via store" ON addon_items FOR UPDATE TO authenticated
USING (group_id IN (SELECT id FROM addon_groups WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())))
WITH CHECK (group_id IN (SELECT id FROM addon_groups WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())));

CREATE POLICY "Store owners can delete addon items via store" ON addon_items FOR DELETE TO authenticated
USING (group_id IN (SELECT id FROM addon_groups WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())));
