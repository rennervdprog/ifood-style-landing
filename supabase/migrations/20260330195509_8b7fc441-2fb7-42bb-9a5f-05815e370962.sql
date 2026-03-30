
-- Add new status values to order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pronto_para_entrega' AFTER 'preparando';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'em_transito' AFTER 'pronto_para_entrega';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'entregue' AFTER 'em_transito';
