
-- Legal documents (terms + privacy) with auto-diff
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('terms','privacy')),
  version text NOT NULL,
  version_num int NOT NULL,
  effective_date timestamptz NOT NULL DEFAULT now(),
  content_md text NOT NULL,
  summary text,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, version),
  UNIQUE (kind, version_num)
);

CREATE TABLE IF NOT EXISTS public.legal_document_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  section text NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('added','modified','removed','fix')),
  summary text NOT NULL,
  legal_basis text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_kind_current ON public.legal_documents(kind, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_legal_documents_kind_versionnum ON public.legal_documents(kind, version_num);
CREATE INDEX IF NOT EXISTS idx_legal_document_changes_doc ON public.legal_document_changes(document_id, display_order);

GRANT SELECT ON public.legal_documents TO anon, authenticated;
GRANT ALL ON public.legal_documents TO service_role;
GRANT SELECT ON public.legal_document_changes TO anon, authenticated;
GRANT ALL ON public.legal_document_changes TO service_role;

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read legal documents"
  ON public.legal_documents FOR SELECT
  USING (true);

CREATE POLICY "Service role manages legal documents"
  ON public.legal_documents FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can read legal changes"
  ON public.legal_document_changes FOR SELECT
  USING (true);

CREATE POLICY "Service role manages legal changes"
  ON public.legal_document_changes FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Only one current per kind
CREATE OR REPLACE FUNCTION public.legal_documents_enforce_single_current()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_current THEN
    UPDATE public.legal_documents SET is_current = false
      WHERE kind = NEW.kind AND id <> NEW.id AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legal_docs_single_current ON public.legal_documents;
CREATE TRIGGER trg_legal_docs_single_current
  AFTER INSERT OR UPDATE OF is_current ON public.legal_documents
  FOR EACH ROW WHEN (NEW.is_current = true)
  EXECUTE FUNCTION public.legal_documents_enforce_single_current();

-- Track privacy version separately on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS privacy_version_accepted text;

-- RPC: get pending changes for a user
CREATE OR REPLACE FUNCTION public.get_pending_legal_changes(
  _terms_accepted text,
  _privacy_accepted text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _terms_num int := 0;
  _privacy_num int := 0;
  _current_terms record;
  _current_privacy record;
  _result jsonb;
BEGIN
  SELECT version_num INTO _terms_num FROM public.legal_documents
    WHERE kind='terms' AND version = _terms_accepted LIMIT 1;
  SELECT version_num INTO _privacy_num FROM public.legal_documents
    WHERE kind='privacy' AND version = _privacy_accepted LIMIT 1;

  _terms_num := COALESCE(_terms_num, 0);
  _privacy_num := COALESCE(_privacy_num, 0);

  SELECT * INTO _current_terms FROM public.legal_documents
    WHERE kind='terms' AND is_current = true LIMIT 1;
  SELECT * INTO _current_privacy FROM public.legal_documents
    WHERE kind='privacy' AND is_current = true LIMIT 1;

  _result := jsonb_build_object(
    'needs_terms', (_current_terms.version_num IS NOT NULL AND _current_terms.version_num > _terms_num),
    'needs_privacy', (_current_privacy.version_num IS NOT NULL AND _current_privacy.version_num > _privacy_num),
    'current_terms_version', _current_terms.version,
    'current_privacy_version', _current_privacy.version,
    'terms_changes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'version', d.version,
        'effective_date', d.effective_date,
        'section', c.section,
        'change_type', c.change_type,
        'summary', c.summary,
        'legal_basis', c.legal_basis
      ) ORDER BY d.version_num, c.display_order)
      FROM public.legal_documents d
      JOIN public.legal_document_changes c ON c.document_id = d.id
      WHERE d.kind='terms' AND d.version_num > _terms_num
        AND d.version_num <= COALESCE(_current_terms.version_num, 0)
    ), '[]'::jsonb),
    'privacy_changes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'version', d.version,
        'effective_date', d.effective_date,
        'section', c.section,
        'change_type', c.change_type,
        'summary', c.summary,
        'legal_basis', c.legal_basis
      ) ORDER BY d.version_num, c.display_order)
      FROM public.legal_documents d
      JOIN public.legal_document_changes c ON c.document_id = d.id
      WHERE d.kind='privacy' AND d.version_num > _privacy_num
        AND d.version_num <= COALESCE(_current_privacy.version_num, 0)
    ), '[]'::jsonb)
  );

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_legal_changes(text, text) TO anon, authenticated;
