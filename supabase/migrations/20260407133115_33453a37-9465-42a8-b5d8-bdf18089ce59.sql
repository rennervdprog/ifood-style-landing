
-- Add driver document columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cnh_number text,
  ADD COLUMN IF NOT EXISTS cnh_front_url text,
  ADD COLUMN IF NOT EXISTS cnh_back_url text,
  ADD COLUMN IF NOT EXISTS selfie_url text;

-- Create private bucket for driver documents (not publicly accessible)
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Only the owner can upload their own documents
CREATE POLICY "Users can upload own driver docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Only the owner and platform admins can view documents
CREATE POLICY "Users can view own driver docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_platform_admin(auth.uid())
  )
);

-- RLS: Only owner can delete their own documents
CREATE POLICY "Users can delete own driver docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
