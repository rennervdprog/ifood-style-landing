ALTER TABLE public.store_plans
ADD COLUMN IF NOT EXISTS pix_operational_fee_override numeric NULL,
ADD COLUMN IF NOT EXISTS platform_delivery_split_override numeric NULL;

COMMENT ON COLUMN public.store_plans.pix_operational_fee_override IS 'NULL = use admin_settings global; numeric = override specific to this store (R$ per PIX transaction)';
COMMENT ON COLUMN public.store_plans.platform_delivery_split_override IS 'NULL = use admin_settings global; numeric = override specific to this store (R$ per delivery for platform)';