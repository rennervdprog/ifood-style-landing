-- ============================================================================
-- Migration: Pix Direto (com comprovante) — método de pagamento offline
-- Rodar no Supabase EXTERNO qkjhguziuchqsbxzruea via oneshot-pix-direto-external
-- Idempotente.
-- ============================================================================

-- 1) Novos valores no enum order_status
DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'aguardando_comprovante';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'comprovante_enviado';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pix_direto_recusado';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Colunas em stores (config do lojista)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS pix_direto_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pix_direto_key text,
  ADD COLUMN IF NOT EXISTS pix_direto_key_type text,
  ADD COLUMN IF NOT EXISTS pix_direto_beneficiary text,
  ADD COLUMN IF NOT EXISTS pix_direto_instructions text;

DO $$ BEGIN
  ALTER TABLE public.stores
    ADD CONSTRAINT stores_pix_direto_key_type_chk
    CHECK (pix_direto_key_type IS NULL OR pix_direto_key_type IN ('cpf','cnpj','email','phone','random'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Colunas em orders (comprovante + timers)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pix_proof_url text,
  ADD COLUMN IF NOT EXISTS pix_proof_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS pix_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pix_refused_at timestamptz,
  ADD COLUMN IF NOT EXISTS pix_refused_reason text,
  ADD COLUMN IF NOT EXISTS pix_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS anon_session_id text;

-- Index parcial pra query rápida no painel
CREATE INDEX IF NOT EXISTS orders_pix_pending_idx
  ON public.orders(store_id, created_at DESC)
  WHERE status IN ('aguardando_comprovante','comprovante_enviado');

-- 4) Bucket pix-proofs (privado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pix-proofs','pix-proofs', false, 5242880,
  ARRAY['image/jpeg','image/png','application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg','image/png','application/pdf'];

-- Políticas storage
DROP POLICY IF EXISTS "pix_proofs_insert_owner" ON storage.objects;
CREATE POLICY "pix_proofs_insert_owner" ON storage.objects
FOR INSERT TO authenticated, anon
WITH CHECK (
  bucket_id = 'pix-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(name, '/', 2)::text  -- name: {store_id}/{order_id}.{ext}
          -- na verdade validamos via RPC attach_pix_proof; aqui só bloqueia bucket estranho
  )
);

DROP POLICY IF EXISTS "pix_proofs_select_owner_store" ON storage.objects;
CREATE POLICY "pix_proofs_select_owner_store" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pix-proofs'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id::text = split_part(name, '/', 1)
      AND s.owner_id = auth.uid()
  )
);

-- 5) RPCs (SECURITY DEFINER)

-- 5.1 create_pix_direto_order
CREATE OR REPLACE FUNCTION public.create_pix_direto_order(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid := (p_payload->>'store_id')::uuid;
  v_store record;
  v_order_id uuid;
  v_client_id uuid := auth.uid();
  v_anon text := p_payload->>'anon_session_id';
BEGIN
  IF v_client_id IS NULL AND (v_anon IS NULL OR length(v_anon) < 8) THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  SELECT id, pix_direto_enabled, pix_direto_key INTO v_store
  FROM stores WHERE id = v_store_id;
  IF NOT FOUND OR NOT v_store.pix_direto_enabled OR coalesce(v_store.pix_direto_key,'') = '' THEN
    RAISE EXCEPTION 'Loja não aceita Pix direto';
  END IF;

  INSERT INTO orders (
    id, client_id, store_id, status, subtotal, delivery_fee, total_price,
    payment_method, neighborhood, address_details, pix_expires_at, anon_session_id,
    order_source
  ) VALUES (
    gen_random_uuid(),
    coalesce(v_client_id, '00000000-0000-0000-0000-000000000000'::uuid),
    v_store_id,
    'aguardando_comprovante',
    (p_payload->>'subtotal')::numeric,
    coalesce((p_payload->>'delivery_fee')::numeric, 0),
    (p_payload->>'total_price')::numeric,
    'pix_direto',
    coalesce(p_payload->>'neighborhood',''),
    coalesce(p_payload->>'address_details',''),
    now() + interval '20 minutes',
    v_anon,
    coalesce(p_payload->>'order_source','app')
  )
  RETURNING id INTO v_order_id;

  -- items (se vierem)
  IF p_payload ? 'items' THEN
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, name, observations)
    SELECT v_order_id,
           (i->>'product_id')::uuid,
           coalesce((i->>'quantity')::int, 1),
           (i->>'unit_price')::numeric,
           i->>'name',
           i->>'observations'
    FROM jsonb_array_elements(p_payload->'items') AS i;
  END IF;

  RETURN v_order_id;
END $$;

GRANT EXECUTE ON FUNCTION public.create_pix_direto_order(jsonb) TO anon, authenticated;

-- 5.2 attach_pix_proof
CREATE OR REPLACE FUNCTION public.attach_pix_proof(
  p_order_id uuid, p_proof_path text, p_anon_session text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order record;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_order.status <> 'aguardando_comprovante' THEN
    RAISE EXCEPTION 'Pedido não aceita comprovante (status=%)', v_order.status;
  END IF;
  IF now() > v_order.pix_expires_at THEN
    RAISE EXCEPTION 'Prazo para enviar comprovante expirou';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    IF v_order.client_id <> auth.uid() THEN
      RAISE EXCEPTION 'Não autorizado';
    END IF;
  ELSE
    IF coalesce(v_order.anon_session_id,'') <> coalesce(p_anon_session,'') THEN
      RAISE EXCEPTION 'Não autorizado';
    END IF;
  END IF;
  IF coalesce(p_proof_path,'') = '' THEN
    RAISE EXCEPTION 'Comprovante inválido';
  END IF;
  UPDATE orders
     SET pix_proof_url = p_proof_path,
         pix_proof_uploaded_at = now(),
         status = 'comprovante_enviado'
   WHERE id = p_order_id;
END $$;

GRANT EXECUTE ON FUNCTION public.attach_pix_proof(uuid, text, text) TO anon, authenticated;

-- 5.3 confirm_pix_proof
CREATE OR REPLACE FUNCTION public.confirm_pix_proof(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_owner uuid;
  v_status order_status;
  v_path text;
BEGIN
  SELECT s.owner_id, o.status, o.pix_proof_url
    INTO v_store_owner, v_status, v_path
  FROM orders o JOIN stores s ON s.id = o.store_id
  WHERE o.id = p_order_id FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_store_owner <> auth.uid() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF v_status <> 'comprovante_enviado' THEN
    RAISE EXCEPTION 'Pedido não pode ser confirmado (status=%)', v_status;
  END IF;
  UPDATE orders
     SET status = 'preparando',
         pix_confirmed_at = now(),
         confirmed_at = now(),
         pix_proof_url = NULL
   WHERE id = p_order_id AND status = 'comprovante_enviado';
  RETURN v_path;
END $$;

GRANT EXECUTE ON FUNCTION public.confirm_pix_proof(uuid) TO authenticated;

-- 5.4 refuse_pix_proof
CREATE OR REPLACE FUNCTION public.refuse_pix_proof(p_order_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid; v_status order_status;
BEGIN
  IF coalesce(trim(p_reason),'') = '' THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  SELECT s.owner_id, o.status INTO v_owner, v_status
  FROM orders o JOIN stores s ON s.id = o.store_id
  WHERE o.id = p_order_id FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF v_status <> 'comprovante_enviado' THEN
    RAISE EXCEPTION 'Pedido não pode ser recusado (status=%)', v_status;
  END IF;
  UPDATE orders
     SET status = 'pix_direto_recusado',
         pix_refused_at = now(),
         pix_refused_reason = p_reason
   WHERE id = p_order_id;
END $$;

GRANT EXECUTE ON FUNCTION public.refuse_pix_proof(uuid, text) TO authenticated;

-- 5.5 expire_pending_pix_orders
CREATE OR REPLACE FUNCTION public.expire_pending_pix_orders()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  WITH upd AS (
    UPDATE orders SET status = 'cancelado'
    WHERE status = 'aguardando_comprovante'
      AND pix_expires_at IS NOT NULL
      AND now() > pix_expires_at
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN coalesce(v_count, 0);
END $$;

-- 5.6 cleanup_refused_pix_proofs
CREATE OR REPLACE FUNCTION public.cleanup_refused_pix_proofs()
RETURNS TABLE(order_id uuid, proof_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT id, pix_proof_url FROM orders
  WHERE status = 'pix_direto_recusado'
    AND pix_refused_at < now() - interval '7 days'
    AND pix_proof_url IS NOT NULL;
END $$;

-- 6) Trigger: ao inserir order pix_direto sem pix_expires_at, preenche
CREATE OR REPLACE FUNCTION public.tg_orders_pix_expiry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_method = 'pix_direto' AND NEW.pix_expires_at IS NULL THEN
    NEW.pix_expires_at := now() + interval '20 minutes';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_pix_expiry ON public.orders;
CREATE TRIGGER orders_pix_expiry BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_orders_pix_expiry();