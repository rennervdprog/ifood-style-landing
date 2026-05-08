-- Criar bucket para releases de aplicativos se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-releases', 'app-releases', true)
ON CONFLICT (id) DO NOTHING;

-- Permitir leitura pública dos arquivos no bucket app-releases
CREATE POLICY "Leitura pública para APKs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'app-releases');
