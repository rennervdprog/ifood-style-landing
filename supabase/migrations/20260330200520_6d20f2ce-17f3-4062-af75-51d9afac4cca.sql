
-- Create partner_role enum
CREATE TYPE public.partner_role AS ENUM ('cliente', 'lojista', 'motoboy');

-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  role partner_role NOT NULL DEFAULT 'cliente',
  document text,
  vehicle text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own profile (once)
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin can read all profiles
CREATE POLICY "Platform admin can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Create storage bucket for partner images
INSERT INTO storage.buckets (id, name, public) VALUES ('partner-images', 'partner-images', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload partner images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'partner-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view partner images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'partner-images');

CREATE POLICY "Users can update own partner images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'partner-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own partner images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'partner-images' AND (storage.foldername(name))[1] = auth.uid()::text);
