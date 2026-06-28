
DROP POLICY IF EXISTS "Admins upload blog media" ON storage.objects;
CREATE POLICY "Admins upload blog media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blog-media' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update blog media" ON storage.objects;
CREATE POLICY "Admins update blog media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'blog-media' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete blog media" ON storage.objects;
CREATE POLICY "Admins delete blog media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'blog-media' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public read blog media" ON storage.objects;
CREATE POLICY "Public read blog media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-media');
