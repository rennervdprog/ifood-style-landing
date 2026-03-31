
-- Create store_assets bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for store-assets bucket
-- Anyone can view
CREATE POLICY "Anyone can view store assets"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'store-assets');

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload store assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'store-assets' AND
  split_part(name, '/', 1) = auth.uid()::text
);

-- Authenticated users can update their own files
CREATE POLICY "Users can update own store assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'store-assets' AND
  split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'store-assets' AND
  split_part(name, '/', 1) = auth.uid()::text
);

-- Authenticated users can delete their own files
CREATE POLICY "Users can delete own store assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'store-assets' AND
  split_part(name, '/', 1) = auth.uid()::text
);
